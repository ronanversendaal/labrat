# API Contract: MR Approval

**Feature**: 001-mr-review-ux-fixes (P4)
**Date**: 2026-02-01

## Overview

This contract defines the Tauri commands for MR approval functionality, which wrap GitLab's Merge Request Approvals API.

## Tauri Commands

### gitlab_get_approval_state

Get the current approval state for a merge request.

**Command**: `gitlab_get_approval_state`

**Input**:
```typescript
interface GetApprovalStateInput {
  account_id: string;
  project_id: number;
  mr_iid: number;
}
```

**Output**:
```typescript
interface ApprovalState {
  approved: boolean;
  approved_by: Approver[];
  approvals_required: number;
  approvals_left: number;
  user_has_approved: boolean;
  user_can_approve: boolean;
}

interface Approver {
  user: {
    id: number;
    username: string;
    name: string;
    avatar_url: string;
  };
  approved_at: string;
}
```

**Errors**:
| Code | Message | Cause |
|------|---------|-------|
| `NOT_FOUND` | MR not found | Invalid project_id or mr_iid |
| `UNAUTHORIZED` | Insufficient permissions | Token lacks required scope |
| `NETWORK_ERROR` | Connection failed | Network or GitLab unavailable |

**GitLab API**: `GET /projects/:id/merge_requests/:mr_iid/approval_state`

---

### gitlab_approve_mr

Approve a merge request.

**Command**: `gitlab_approve_mr`

**Input**:
```typescript
interface ApproveMRInput {
  account_id: string;
  project_id: number;
  mr_iid: number;
  sha?: string; // Optional: specific commit to approve
}
```

**Output**:
```typescript
interface ApproveResponse {
  approved: boolean;
  approvals_required: number;
  approvals_left: number;
}
```

**Errors**:
| Code | Message | Cause |
|------|---------|-------|
| `NOT_FOUND` | MR not found | Invalid project_id or mr_iid |
| `UNAUTHORIZED` | Cannot approve | User is MR author or lacks permission |
| `CONFLICT` | Already approved | User has already approved this MR |
| `PRECONDITION_FAILED` | SHA mismatch | MR was updated since page load |
| `NETWORK_ERROR` | Connection failed | Network or GitLab unavailable |

**GitLab API**: `POST /projects/:id/merge_requests/:mr_iid/approve`

**Request Body** (to GitLab):
```json
{
  "sha": "optional-commit-sha"
}
```

---

### gitlab_unapprove_mr

Remove approval from a merge request.

**Command**: `gitlab_unapprove_mr`

**Input**:
```typescript
interface UnapproveMRInput {
  account_id: string;
  project_id: number;
  mr_iid: number;
}
```

**Output**:
```typescript
interface ApproveResponse {
  approved: boolean;
  approvals_required: number;
  approvals_left: number;
}
```

**Errors**:
| Code | Message | Cause |
|------|---------|-------|
| `NOT_FOUND` | MR not found | Invalid project_id or mr_iid |
| `CONFLICT` | Not approved | User hasn't approved this MR |
| `NETWORK_ERROR` | Connection failed | Network or GitLab unavailable |

**GitLab API**: `POST /projects/:id/merge_requests/:mr_iid/unapprove`

---

## Frontend Service Layer

### tauri.ts additions

```typescript
export async function getApprovalState(
  accountId: string,
  projectId: number,
  mrIid: number
): Promise<ApprovalState> {
  return invoke<ApprovalState>('gitlab_get_approval_state', {
    account_id: accountId,
    project_id: projectId,
    mr_iid: mrIid,
  });
}

export async function approveMR(
  accountId: string,
  projectId: number,
  mrIid: number,
  sha?: string
): Promise<ApproveResponse> {
  return invoke<ApproveResponse>('gitlab_approve_mr', {
    account_id: accountId,
    project_id: projectId,
    mr_iid: mrIid,
    sha,
  });
}

export async function unapproveMR(
  accountId: string,
  projectId: number,
  mrIid: number
): Promise<ApproveResponse> {
  return invoke<ApproveResponse>('gitlab_unapprove_mr', {
    account_id: accountId,
    project_id: projectId,
    mr_iid: mrIid,
  });
}
```

---

## React Query Hooks

### useGitLab.ts additions

```typescript
export function useApprovalState(projectId: number, mrIid: number) {
  const { activeAccount } = useAccounts();

  return useQuery({
    queryKey: ['approval-state', projectId, mrIid],
    queryFn: () => getApprovalState(activeAccount!.id, projectId, mrIid),
    enabled: !!activeAccount && !!projectId && !!mrIid,
    staleTime: 30_000, // 30 seconds
  });
}

export function useApproveMR() {
  const queryClient = useQueryClient();
  const { activeAccount } = useAccounts();

  return useMutation({
    mutationFn: ({ projectId, mrIid, sha }: {
      projectId: number;
      mrIid: number;
      sha?: string;
    }) => approveMR(activeAccount!.id, projectId, mrIid, sha),
    onSuccess: (_, { projectId, mrIid }) => {
      // Invalidate approval state
      queryClient.invalidateQueries({
        queryKey: ['approval-state', projectId, mrIid],
      });
      // Invalidate MR details
      queryClient.invalidateQueries({
        queryKey: ['merge-request', projectId, mrIid],
      });
    },
  });
}

export function useUnapproveMR() {
  const queryClient = useQueryClient();
  const { activeAccount } = useAccounts();

  return useMutation({
    mutationFn: ({ projectId, mrIid }: {
      projectId: number;
      mrIid: number;
    }) => unapproveMR(activeAccount!.id, projectId, mrIid),
    onSuccess: (_, { projectId, mrIid }) => {
      queryClient.invalidateQueries({
        queryKey: ['approval-state', projectId, mrIid],
      });
      queryClient.invalidateQueries({
        queryKey: ['merge-request', projectId, mrIid],
      });
    },
  });
}
```

---

## Backend Implementation

### src-tauri/src/commands/gitlab.rs

```rust
#[tauri::command]
pub async fn gitlab_get_approval_state(
    state: State<'_, AppState>,
    account_id: String,
    project_id: i64,
    mr_iid: i64,
) -> Result<ApprovalState, TauriError> {
    let client = get_client_for_account(&state, &account_id).await?;
    client.get_approval_state(project_id, mr_iid).await
        .map_err(TauriError::from)
}

#[tauri::command]
pub async fn gitlab_approve_mr(
    state: State<'_, AppState>,
    account_id: String,
    project_id: i64,
    mr_iid: i64,
    sha: Option<String>,
) -> Result<ApproveResponse, TauriError> {
    let client = get_client_for_account(&state, &account_id).await?;
    client.approve_mr(project_id, mr_iid, sha).await
        .map_err(TauriError::from)
}

#[tauri::command]
pub async fn gitlab_unapprove_mr(
    state: State<'_, AppState>,
    account_id: String,
    project_id: i64,
    mr_iid: i64,
) -> Result<ApproveResponse, TauriError> {
    let client = get_client_for_account(&state, &account_id).await?;
    client.unapprove_mr(project_id, mr_iid).await
        .map_err(TauriError::from)
}
```

### src-tauri/src/gitlab/merge_requests.rs

```rust
impl GitLabClient {
    pub async fn get_approval_state(
        &self,
        project_id: i64,
        mr_iid: i64,
    ) -> Result<ApprovalState, GitLabError> {
        let path = format!(
            "/projects/{}/merge_requests/{}/approval_state",
            project_id, mr_iid
        );
        self.get(&path).await
    }

    pub async fn approve_mr(
        &self,
        project_id: i64,
        mr_iid: i64,
        sha: Option<String>,
    ) -> Result<ApproveResponse, GitLabError> {
        let path = format!(
            "/projects/{}/merge_requests/{}/approve",
            project_id, mr_iid
        );
        let body = sha.map(|s| json!({ "sha": s }));
        self.post(&path, body).await
    }

    pub async fn unapprove_mr(
        &self,
        project_id: i64,
        mr_iid: i64,
    ) -> Result<ApproveResponse, GitLabError> {
        let path = format!(
            "/projects/{}/merge_requests/{}/unapprove",
            project_id, mr_iid
        );
        self.post::<(), _>(&path, None).await
    }
}
```

---

## Sequence Diagram

```
User            Frontend           Tauri            GitLab
 │                 │                 │                │
 │──[Click Approve]│                 │                │
 │                 │                 │                │
 │                 │──[approveMR()]──│                │
 │                 │                 │                │
 │                 │                 │──[POST /approve]
 │                 │                 │                │
 │                 │                 │◄─[200 OK]──────│
 │                 │                 │                │
 │                 │◄─[ApproveResponse]              │
 │                 │                 │                │
 │                 │──[invalidateQueries()]          │
 │                 │                 │                │
 │◄─[UI Updated]───│                 │                │
 │                 │                 │                │
```
