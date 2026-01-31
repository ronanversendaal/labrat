//! Request batching and deduplication for GitLab API
//!
//! This module provides utilities for batching and deduplicating
//! API requests to reduce network overhead and improve performance.

use std::collections::HashMap;
use std::future::Future;
use std::hash::Hash;
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};
use tracing::debug;

/// Error type for batch operations
#[derive(Debug, Clone)]
pub enum BatchError {
    /// The request was cancelled
    Cancelled,
    /// The request failed
    Failed(String),
}

impl std::fmt::Display for BatchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BatchError::Cancelled => write!(f, "Request cancelled"),
            BatchError::Failed(msg) => write!(f, "Request failed: {}", msg),
        }
    }
}

impl std::error::Error for BatchError {}

/// A request deduplicator that coalesces identical in-flight requests
///
/// When multiple identical requests are made concurrently, only one actual
/// request is executed and all callers receive the same result.
pub struct RequestDeduplicator<K, V>
where
    K: Eq + Hash + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    in_flight: Arc<Mutex<HashMap<K, broadcast::Sender<Result<V, BatchError>>>>>,
}

impl<K, V> Default for RequestDeduplicator<K, V>
where
    K: Eq + Hash + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    fn default() -> Self {
        Self::new()
    }
}

impl<K, V> RequestDeduplicator<K, V>
where
    K: Eq + Hash + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    /// Create a new request deduplicator
    pub fn new() -> Self {
        Self {
            in_flight: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Execute a request, deduplicating with any identical in-flight requests
    ///
    /// If a request with the same key is already in flight, this will wait for
    /// that request to complete and return the same result.
    pub async fn execute<F, Fut, E>(&self, key: K, request: F) -> Result<V, BatchError>
    where
        F: FnOnce() -> Fut + Send,
        Fut: Future<Output = Result<V, E>> + Send,
        E: std::fmt::Display,
    {
        // Check if there's already an in-flight request for this key
        let receiver = {
            let in_flight = self.in_flight.lock().await;
            if let Some(sender) = in_flight.get(&key) {
                // Subscribe to the existing request
                Some(sender.subscribe())
            } else {
                None
            }
        };

        if let Some(mut rx) = receiver {
            debug!("Deduplicating request - waiting for in-flight request");
            // Wait for the in-flight request to complete
            match rx.recv().await {
                Ok(result) => return result,
                Err(_) => return Err(BatchError::Cancelled),
            }
        }

        // No in-flight request, we need to execute it
        let (tx, _) = broadcast::channel(1);
        {
            let mut in_flight = self.in_flight.lock().await;
            in_flight.insert(key.clone(), tx.clone());
        }

        // Execute the actual request
        let result = request().await;

        // Convert result and broadcast to all waiters
        let broadcast_result = match result {
            Ok(value) => Ok(value),
            Err(e) => Err(BatchError::Failed(e.to_string())),
        };

        // Broadcast result (ignore send errors - no receivers is fine)
        let _ = tx.send(broadcast_result.clone());

        // Remove from in-flight
        {
            let mut in_flight = self.in_flight.lock().await;
            in_flight.remove(&key);
        }

        broadcast_result
    }

    /// Get the number of in-flight requests
    pub async fn in_flight_count(&self) -> usize {
        self.in_flight.lock().await.len()
    }
}

/// A batch collector for grouping multiple requests into batches
///
/// Collects requests over a short time window and executes them together.
pub struct BatchCollector<K, V>
where
    K: Eq + Hash + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    deduplicator: RequestDeduplicator<K, V>,
    batch_window_ms: u64,
    max_batch_size: usize,
}

impl<K, V> BatchCollector<K, V>
where
    K: Eq + Hash + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    /// Create a new batch collector
    ///
    /// # Arguments
    /// * `batch_window_ms` - Time window in milliseconds to collect requests
    /// * `max_batch_size` - Maximum number of requests in a batch
    pub fn new(batch_window_ms: u64, max_batch_size: usize) -> Self {
        Self {
            deduplicator: RequestDeduplicator::new(),
            batch_window_ms,
            max_batch_size,
        }
    }

    /// Execute a single request, potentially batched with others
    pub async fn execute<F, Fut, E>(&self, key: K, request: F) -> Result<V, BatchError>
    where
        F: FnOnce() -> Fut + Send,
        Fut: Future<Output = Result<V, E>> + Send,
        E: std::fmt::Display,
    {
        self.deduplicator.execute(key, request).await
    }

    /// Get batch configuration
    pub fn batch_window_ms(&self) -> u64 {
        self.batch_window_ms
    }

    /// Get max batch size
    pub fn max_batch_size(&self) -> usize {
        self.max_batch_size
    }
}

/// A multi-request batcher that groups requests by endpoint
///
/// Useful for batching requests like fetching multiple MRs or projects
pub struct MultiBatcher {
    /// Deduplicator for MR requests (project_id, mr_iid) -> MR
    pub mr_requests: RequestDeduplicator<(i64, i64), String>,
    /// Deduplicator for diff requests (project_id, mr_iid) -> Diff
    pub diff_requests: RequestDeduplicator<(i64, i64), String>,
    /// Deduplicator for discussion requests (project_id, mr_iid) -> Discussions
    pub discussion_requests: RequestDeduplicator<(i64, i64), String>,
}

impl Default for MultiBatcher {
    fn default() -> Self {
        Self::new()
    }
}

impl MultiBatcher {
    /// Create a new multi-batcher
    pub fn new() -> Self {
        Self {
            mr_requests: RequestDeduplicator::new(),
            diff_requests: RequestDeduplicator::new(),
            discussion_requests: RequestDeduplicator::new(),
        }
    }

    /// Execute an MR fetch request with deduplication
    pub async fn get_mr<F, Fut, E>(
        &self,
        project_id: i64,
        mr_iid: i64,
        request: F,
    ) -> Result<String, BatchError>
    where
        F: FnOnce() -> Fut + Send,
        Fut: Future<Output = Result<String, E>> + Send,
        E: std::fmt::Display,
    {
        self.mr_requests
            .execute((project_id, mr_iid), request)
            .await
    }

    /// Execute a diff fetch request with deduplication
    pub async fn get_diff<F, Fut, E>(
        &self,
        project_id: i64,
        mr_iid: i64,
        request: F,
    ) -> Result<String, BatchError>
    where
        F: FnOnce() -> Fut + Send,
        Fut: Future<Output = Result<String, E>> + Send,
        E: std::fmt::Display,
    {
        self.diff_requests
            .execute((project_id, mr_iid), request)
            .await
    }

    /// Execute a discussions fetch request with deduplication
    pub async fn get_discussions<F, Fut, E>(
        &self,
        project_id: i64,
        mr_iid: i64,
        request: F,
    ) -> Result<String, BatchError>
    where
        F: FnOnce() -> Fut + Send,
        Fut: Future<Output = Result<String, E>> + Send,
        E: std::fmt::Display,
    {
        self.discussion_requests
            .execute((project_id, mr_iid), request)
            .await
    }

    /// Get total in-flight request count
    pub async fn total_in_flight(&self) -> usize {
        self.mr_requests.in_flight_count().await
            + self.diff_requests.in_flight_count().await
            + self.discussion_requests.in_flight_count().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;

    #[tokio::test]
    async fn test_deduplication() {
        let deduplicator: RequestDeduplicator<String, i32> = RequestDeduplicator::new();
        let call_count = Arc::new(AtomicUsize::new(0));

        // Spawn multiple concurrent requests with the same key
        let mut handles = vec![];
        for _ in 0..5 {
            let dedup = RequestDeduplicator {
                in_flight: deduplicator.in_flight.clone(),
            };
            let count = call_count.clone();
            handles.push(tokio::spawn(async move {
                dedup
                    .execute("test-key".to_string(), || async {
                        count.fetch_add(1, Ordering::SeqCst);
                        tokio::time::sleep(Duration::from_millis(50)).await;
                        Ok::<_, String>(42)
                    })
                    .await
            }));
        }

        // All should succeed
        for handle in handles {
            let result = handle.await.unwrap();
            assert_eq!(result.unwrap(), 42);
        }

        // But only one actual request should have been made
        assert_eq!(call_count.load(Ordering::SeqCst), 1);
    }
}
