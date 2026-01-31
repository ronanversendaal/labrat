# Research: GitLab MR Review App

**Date**: 2026-01-31
**Feature**: 001-gitlab-mr-review-app

## Technology Decisions

### 1. Desktop Framework: Tauri 2.x

**Decision**: Use Tauri 2.x as the desktop application framework.

**Rationale**:
- **Performance**: Rust backend provides near-native performance for API calls, caching, and data processing
- **Bundle Size**: ~10MB vs Electron's 150MB+ (user specified efficiency as priority)
- **Memory**: Uses system webview, significantly lower memory footprint
- **Security**: Rust's memory safety, no Node.js attack surface
- **Cross-platform**: Single codebase for macOS, Windows, Linux

**Alternatives Considered**:
- **Electron**: Rejected due to large bundle size, higher memory usage, slower startup
- **Flutter Desktop**: Rejected due to less mature desktop support, Dart ecosystem smaller than Rust
- **Native per-platform**: Rejected due to 3x development effort

### 2. Local Database: SQLite via sqlx

**Decision**: Use SQLite with the sqlx crate for local data persistence and caching.

**Rationale**:
- **Performance**: Excellent read performance for cached data, supports 60fps scrolling use case
- **Reliability**: Battle-tested, ACID-compliant, single-file database
- **Rust Ecosystem**: sqlx provides compile-time query checking, async support
- **Portability**: Single file, easy backup, cross-platform
- **Offline Support**: Full functionality without network

**Alternatives Considered**:
- **RocksDB**: Rejected—overkill for this use case, more complex
- **Sled**: Rejected—less mature, embedded Rust DB with fewer features
- **IndexedDB**: Rejected—webview-only, can't access from Rust backend

**Schema Strategy**: Migrations via sqlx-cli, versioned schema evolution

### 3. HTTP Client: reqwest + tokio

**Decision**: Use reqwest for HTTP with tokio async runtime.

**Rationale**:
- **Async**: Non-blocking API calls, essential for responsive UI
- **Features**: Built-in connection pooling, timeout handling, retry support
- **TLS**: Native TLS support for secure GitLab connections
- **Ecosystem**: Most popular Rust HTTP client, well-maintained

**Alternatives Considered**:
- **hyper**: Lower-level, more boilerplate for simple REST calls
- **ureq**: Blocking only, not suitable for async architecture

### 4. Credential Storage: keyring crate

**Decision**: Use the keyring crate for OS-native secure credential storage.

**Rationale**:
- **Security**: Uses macOS Keychain, Windows Credential Manager, Linux Secret Service
- **User Trust**: Credentials stored in familiar OS locations
- **No Encryption Key Management**: OS handles encryption

**Alternatives Considered**:
- **File-based encryption**: Requires managing encryption keys, less secure
- **In-memory only**: Lost on restart, poor UX

### 5. Syntax Highlighting: syntect

**Decision**: Use syntect for diff syntax highlighting in the Rust backend.

**Rationale**:
- **Performance**: Rust-native, can process large diffs on background thread
- **Sublime Syntax**: Uses Sublime Text syntax definitions, excellent language coverage
- **Themes**: Built-in theme support

**Alternatives Considered**:
- **tree-sitter**: More powerful but overkill for highlighting; better for LSP features
- **Frontend highlighting (Shiki)**: Would require sending raw code to frontend, less efficient

### 6. Frontend: React 18 + TanStack Query

**Decision**: Use React 18 with TanStack Query for the Tauri webview frontend.

**Rationale**:
- **React**: Largest ecosystem, excellent component libraries, team familiarity
- **TanStack Query**: Best-in-class data fetching, caching, background refetch
- **Concurrent Features**: React 18's useTransition for non-blocking UI updates

**Alternatives Considered**:
- **Svelte**: Smaller ecosystem, less talent pool
- **SolidJS**: Smaller ecosystem, less mature tooling
- **Vanilla JS**: Too much boilerplate for complex UI

### 7. Diff View: Monaco Editor

**Decision**: Use Monaco Editor (VS Code's editor) for diff rendering.

**Rationale**:
- **Performance**: Virtualized rendering, handles large files efficiently
- **Features**: Built-in diff view, syntax highlighting, line numbers
- **Familiarity**: Users know VS Code's interface
- **Accessibility**: Good keyboard navigation support

**Alternatives Considered**:
- **CodeMirror 6**: Good alternative, slightly less feature-rich diff view
- **Custom implementation**: Too much effort, would reinvent the wheel

### 8. AI Provider Integration

**Decision**: Pluggable provider architecture with Claude CLI as primary.

**Implementation**:
```rust
#[async_trait]
pub trait AIProvider: Send + Sync {
    async fn analyze_diff(&self, diff: &str, context: &AnalysisContext) -> Result<Vec<Suggestion>>;
    fn name(&self) -> &str;
    fn is_available(&self) -> bool;
}

// Implementations:
// 1. ClaudeCLI - invokes `claude` binary
// 2. AnthropicAPI - direct API calls
// 3. OpenAIAPI - direct API calls
```

**Claude CLI Integration**:
- Spawn subprocess with `tokio::process::Command`
- Pass diff via stdin, receive suggestions via stdout
- Parse JSON output
- Handle CLI not installed gracefully

**Rationale**:
- **Flexibility**: User can use preferred/available provider
- **No Lock-in**: Easy to add new providers
- **Max Subscription**: Claude CLI leverages existing subscription

### 9. State Management: Zustand

**Decision**: Use Zustand for frontend state management.

**Rationale**:
- **Simplicity**: Minimal boilerplate compared to Redux
- **TypeScript**: Excellent TypeScript support
- **Performance**: Selective re-renders, no context provider hell
- **Size**: ~1KB, minimal bundle impact

**Alternatives Considered**:
- **Redux Toolkit**: More boilerplate, overkill for app of this size
- **Jotai/Recoil**: Atom-based, less intuitive for this data model
- **Context API**: Performance issues with frequent updates

### 10. Styling: TailwindCSS

**Decision**: Use TailwindCSS for styling.

**Rationale**:
- **Consistency**: Design tokens enforced via config
- **Performance**: Purged CSS, minimal bundle
- **Productivity**: Rapid UI development
- **Accessibility**: Good defaults for focus states

## Performance Optimizations

### Caching Strategy

1. **MR List Cache**:
   - Store in SQLite with TTL
   - Background refresh every 5 minutes (configurable)
   - Instant display from cache on app open

2. **Diff Cache**:
   - Store full diff content in SQLite with compression
   - Keyed by MR ID + commit SHA (invalidates on update)
   - LRU eviction when cache exceeds size limit

3. **Prefetching**:
   - When MR list loads, prefetch diffs for first 5 visible MRs
   - Use `requestIdleCallback` equivalent in Rust (low-priority tokio tasks)

### Large Diff Handling

1. **Streaming**: Parse and render diffs incrementally
2. **Virtualization**: Only render visible lines (react-window or custom)
3. **Chunking**: Load diff in chunks, show progress for large files
4. **Background Processing**: Syntax highlighting on background thread

### Network Optimization

1. **Request Batching**: Combine multiple API calls where possible
2. **Request Deduplication**: Don't re-fetch in-flight requests
3. **Cancellation**: Cancel pending requests on navigation
4. **Retry with Backoff**: Automatic retry for transient failures

## Security Considerations

1. **Credential Storage**: OS keychain only, never in config files
2. **Token Scope**: Document minimum required GitLab scopes
3. **HTTPS Only**: Reject non-HTTPS GitLab instances (except localhost)
4. **No Eval**: CSP in Tauri config prevents eval/inline scripts
5. **Subprocess Safety**: Sanitize inputs to Claude CLI

## GitLab API Integration

### Required Scopes

Personal Access Token needs:
- `read_api` - Read MRs, diffs, comments
- `write_repository` - Post comments/suggestions (optional, for posting)

### Key Endpoints

| Feature | Endpoint |
|---------|----------|
| List assigned MRs | `GET /api/v4/merge_requests?reviewer_username=:me&state=opened` |
| MR details | `GET /api/v4/projects/:id/merge_requests/:iid` |
| MR diff | `GET /api/v4/projects/:id/merge_requests/:iid/changes` |
| MR discussions | `GET /api/v4/projects/:id/merge_requests/:iid/discussions` |
| Post comment | `POST /api/v4/projects/:id/merge_requests/:iid/discussions` |
| Pipeline status | `GET /api/v4/projects/:id/merge_requests/:iid/pipelines` |

### Rate Limiting

- GitLab.com: 2000 requests/minute (authenticated)
- Self-hosted: Varies, typically higher
- Strategy: Implement token bucket, backoff on 429

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| Which database for caching? | SQLite via sqlx |
| How to handle large diffs? | Virtualization + chunking + background processing |
| Claude CLI integration method? | Subprocess with stdin/stdout JSON |
| State management approach? | Zustand for simplicity |
| Diff rendering component? | Monaco Editor |
