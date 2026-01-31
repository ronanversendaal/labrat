# GitLab API Contract

**Date**: 2026-01-31
**Feature**: 001-gitlab-mr-review-app

This document defines the GitLab API endpoints used by the application.

## Authentication

All requests require a Personal Access Token (PAT) in the header:

```
PRIVATE-TOKEN: <your_access_token>
```

### Required Token Scopes

| Scope | Purpose |
|-------|---------|
| `read_api` | Read MRs, projects, users, pipelines |
| `api` | Post comments/suggestions (write access) |

## Base URL

- GitLab.com: `https://gitlab.com/api/v4`
- Self-hosted: `https://{instance}/api/v4`

## Endpoints

### User Information

#### GET /user

Get the authenticated user's information.

```
GET /api/v4/user
```

**Response 200:**
```json
{
  "id": 1,
  "username": "johndoe",
  "name": "John Doe",
  "state": "active",
  "avatar_url": "https://gitlab.com/uploads/-/system/user/avatar/1/avatar.png",
  "web_url": "https://gitlab.com/johndoe",
  "email": "john@example.com"
}
```

### Merge Requests

#### GET /merge_requests

List merge requests where the user is a reviewer.

```
GET /api/v4/merge_requests?reviewer_username={username}&state=opened&scope=all
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `reviewer_username` | string | Filter by reviewer |
| `author_username` | string | Filter by author |
| `state` | string | `opened`, `closed`, `merged`, `all` |
| `scope` | string | `all` for cross-project |
| `labels` | string | Comma-separated labels |
| `milestone` | string | Milestone title |
| `search` | string | Search in title/description |
| `order_by` | string | `created_at`, `updated_at` |
| `sort` | string | `asc`, `desc` |
| `per_page` | int | Results per page (max 100) |
| `page` | int | Page number |

**Response 200:**
```json
[
  {
    "id": 1,
    "iid": 1,
    "project_id": 3,
    "title": "Feature: Add user authentication",
    "description": "Implements OAuth2 authentication...",
    "state": "opened",
    "created_at": "2026-01-15T12:00:00Z",
    "updated_at": "2026-01-30T15:30:00Z",
    "merged_at": null,
    "source_branch": "feature/auth",
    "target_branch": "main",
    "author": {
      "id": 2,
      "username": "janedoe",
      "name": "Jane Doe",
      "avatar_url": "https://...",
      "web_url": "https://gitlab.com/janedoe"
    },
    "assignees": [],
    "reviewers": [
      {
        "id": 1,
        "username": "johndoe",
        "name": "John Doe",
        "avatar_url": "https://...",
        "web_url": "https://gitlab.com/johndoe"
      }
    ],
    "labels": ["feature", "needs-review"],
    "milestone": {
      "id": 5,
      "iid": 1,
      "title": "v1.0",
      "state": "active",
      "due_date": "2026-02-28"
    },
    "draft": false,
    "work_in_progress": false,
    "has_conflicts": false,
    "blocking_discussions_resolved": true,
    "web_url": "https://gitlab.com/group/project/-/merge_requests/1",
    "references": {
      "full": "group/project!1"
    },
    "user_notes_count": 5,
    "head_pipeline": {
      "id": 100,
      "status": "success",
      "web_url": "https://gitlab.com/group/project/-/pipelines/100"
    }
  }
]
```

**Response Headers:**
- `X-Total`: Total number of results
- `X-Total-Pages`: Total pages
- `X-Page`: Current page
- `X-Per-Page`: Results per page
- `X-Next-Page`: Next page number (if exists)

#### GET /projects/:id/merge_requests/:iid

Get a single merge request.

```
GET /api/v4/projects/{project_id}/merge_requests/{iid}
```

**Response 200:** Same structure as list item above.

#### GET /projects/:id/merge_requests/:iid/changes

Get the diff/changes for a merge request.

```
GET /api/v4/projects/{project_id}/merge_requests/{iid}/changes
```

**Response 200:**
```json
{
  "id": 1,
  "iid": 1,
  "project_id": 3,
  "title": "Feature: Add user authentication",
  "diff_refs": {
    "base_sha": "abc123",
    "head_sha": "def456",
    "start_sha": "abc123"
  },
  "changes": [
    {
      "old_path": "src/auth.rs",
      "new_path": "src/auth.rs",
      "a_mode": "100644",
      "b_mode": "100644",
      "new_file": false,
      "renamed_file": false,
      "deleted_file": false,
      "generated_file": false,
      "diff": "@@ -1,5 +1,10 @@\n use std::sync::Arc;\n+use oauth2::{Client, Token};\n \n pub struct Auth {\n-    token: String,\n+    client: Client,\n+    token: Option<Token>,\n }\n"
    }
  ],
  "overflow": false
}
```

**Note:** For large diffs, `overflow` may be `true`. Use pagination or fetch individual file diffs.

### Discussions & Comments

#### GET /projects/:id/merge_requests/:iid/discussions

Get all discussions on a merge request.

```
GET /api/v4/projects/{project_id}/merge_requests/{iid}/discussions
```

**Response 200:**
```json
[
  {
    "id": "abc123def456",
    "individual_note": false,
    "notes": [
      {
        "id": 1001,
        "type": "DiffNote",
        "body": "This could be simplified",
        "attachment": null,
        "author": {
          "id": 1,
          "username": "johndoe",
          "name": "John Doe",
          "avatar_url": "https://..."
        },
        "created_at": "2026-01-30T10:00:00Z",
        "updated_at": "2026-01-30T10:00:00Z",
        "system": false,
        "noteable_id": 1,
        "noteable_type": "MergeRequest",
        "resolvable": true,
        "resolved": false,
        "position": {
          "base_sha": "abc123",
          "start_sha": "abc123",
          "head_sha": "def456",
          "old_path": "src/auth.rs",
          "new_path": "src/auth.rs",
          "position_type": "text",
          "old_line": null,
          "new_line": 5
        }
      }
    ]
  }
]
```

#### POST /projects/:id/merge_requests/:iid/discussions

Create a new discussion (comment/suggestion).

```
POST /api/v4/projects/{project_id}/merge_requests/{iid}/discussions
Content-Type: application/json
```

**Request Body (general comment):**
```json
{
  "body": "This looks good overall!"
}
```

**Request Body (line comment):**
```json
{
  "body": "Consider using `Option<T>` here for null safety.",
  "position": {
    "base_sha": "abc123",
    "start_sha": "abc123",
    "head_sha": "def456",
    "position_type": "text",
    "new_path": "src/auth.rs",
    "new_line": 5
  }
}
```

**Request Body (suggestion):**
```json
{
  "body": "Consider this improvement:\n\n```suggestion:-0+0\nlet value = input.unwrap_or_default();\n```",
  "position": {
    "base_sha": "abc123",
    "start_sha": "abc123",
    "head_sha": "def456",
    "position_type": "text",
    "new_path": "src/auth.rs",
    "new_line": 5
  }
}
```

**Response 201:**
```json
{
  "id": "new_discussion_id",
  "individual_note": true,
  "notes": [
    {
      "id": 1002,
      "body": "Consider using `Option<T>` here for null safety.",
      "author": { ... },
      "created_at": "2026-01-31T10:00:00Z",
      ...
    }
  ]
}
```

### Pipelines

#### GET /projects/:id/merge_requests/:iid/pipelines

Get pipelines for a merge request.

```
GET /api/v4/projects/{project_id}/merge_requests/{iid}/pipelines
```

**Response 200:**
```json
[
  {
    "id": 100,
    "sha": "def456",
    "ref": "feature/auth",
    "status": "success",
    "source": "merge_request_event",
    "created_at": "2026-01-30T14:00:00Z",
    "updated_at": "2026-01-30T14:30:00Z",
    "web_url": "https://gitlab.com/group/project/-/pipelines/100"
  }
]
```

**Pipeline Status Values:**
- `pending` - Waiting to run
- `running` - Currently executing
- `success` - All jobs passed
- `failed` - One or more jobs failed
- `canceled` - Manually canceled
- `skipped` - Skipped due to rules

### Projects

#### GET /projects/:id

Get project details.

```
GET /api/v4/projects/{project_id}
```

**Response 200:**
```json
{
  "id": 3,
  "name": "My Project",
  "name_with_namespace": "My Group / My Project",
  "path": "my-project",
  "path_with_namespace": "my-group/my-project",
  "web_url": "https://gitlab.com/my-group/my-project",
  "avatar_url": "https://...",
  "last_activity_at": "2026-01-30T12:00:00Z"
}
```

## Rate Limiting

GitLab.com rate limits:
- **Authenticated**: 2,000 requests per minute
- **Unauthenticated**: 500 requests per hour

Self-hosted limits vary by configuration.

**Rate Limit Headers:**
- `RateLimit-Limit`: Max requests per period
- `RateLimit-Remaining`: Remaining requests
- `RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds to wait (when rate limited)

**Handling:**
```rust
// Pseudocode
if response.status == 429 {
    let retry_after = response.headers.get("Retry-After");
    sleep(retry_after.unwrap_or(60));
    retry();
}
```

## Error Responses

**401 Unauthorized:**
```json
{
  "message": "401 Unauthorized"
}
```

**403 Forbidden:**
```json
{
  "message": "403 Forbidden"
}
```

**404 Not Found:**
```json
{
  "message": "404 Project Not Found"
}
```

**422 Unprocessable Entity:**
```json
{
  "message": {
    "body": ["is too long (maximum is 1000000 characters)"]
  }
}
```

**429 Too Many Requests:**
```json
{
  "message": "429 Too Many Requests"
}
```

## Pagination Strategy

Use keyset pagination for large result sets:

```
GET /api/v4/merge_requests?per_page=100&pagination=keyset&order_by=updated_at&sort=desc
```

Parse `Link` header for next page:
```
Link: <https://gitlab.com/api/v4/merge_requests?...&cursor=eyJpZCI6...>; rel="next"
```

## Webhook Events (Future Enhancement)

For real-time updates, consider GitLab webhooks:

| Event | Trigger |
|-------|---------|
| `merge_request` | MR created, updated, merged, closed |
| `note` | Comment added |
| `pipeline` | Pipeline status changed |

Not implemented in MVP - polling used instead.
