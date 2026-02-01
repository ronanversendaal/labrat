# Data Model: MR Review UX Fixes

**Feature**: 001-mr-review-ux-fixes
**Date**: 2026-02-01

## New Entities

### ApprovalState

Represents the approval status of a merge request.

```typescript
interface ApprovalState {
  // From GitLab API
  approved: boolean;
  approved_by: Approver[];
  approvals_required: number;
  approvals_left: number;
  user_has_approved: boolean;
  user_can_approve: boolean;

  // Computed
  approval_summary: string; // e.g., "2 of 3 approvals"
}

interface Approver {
  user: {
    id: number;
    username: string;
    name: string;
    avatar_url: string;
  };
  approved_at: string; // ISO timestamp
}
```

**Relationships**:
- ApprovalState → MergeRequest (1:1, fetched separately)
- Approver.user → Author (same structure)

**Validation Rules**:
- `approvals_required >= 0`
- `approvals_left = approvals_required - approved_by.length`
- `user_can_approve = false` if user authored the MR

**State Transitions**:
```
Not Approved ──[approve]──> Approved
Approved ──[unapprove]──> Not Approved
```

---

### ViewedFile

Tracks which files a user has marked as viewed during review.

```typescript
interface ViewedFile {
  mrId: number;        // MR identifier
  filePath: string;    // File path within the MR
  viewedAt: number;    // Timestamp when marked
}

// Stored in mrStore as a Map
type ViewedFilesMap = Map<string, ViewedFile>; // key: `${mrId}:${filePath}`
```

**Validation Rules**:
- `mrId > 0`
- `filePath` must be non-empty string
- `viewedAt` must be valid timestamp

**State Transitions**:
```
Not Viewed ──[press 'v']──> Viewed
Viewed ──[press 'v']──> Not Viewed
Viewed ──[MR sha changes]──> Not Viewed (auto-reset)
```

---

### ParsedFilter

Represents a parsed search filter from user input.

```typescript
interface ParsedFilter {
  type: FilterType;
  value: string;
  operator?: 'equals' | 'contains' | 'not'; // Future extension
}

type FilterType = 'author' | 'project' | 'status' | 'label' | 'text';

// Example parsing
"author:john status:draft fix bug" -> [
  { type: 'author', value: 'john' },
  { type: 'status', value: 'draft' },
  { type: 'text', value: 'fix bug' }
]
```

**Validation Rules**:
- `type` must be known filter type
- `value` must be non-empty after trimming
- Unknown filter types treated as text search

---

### FileViewMode

User preference for file tree display.

```typescript
type FileViewMode = 'flat' | 'tree';

// Added to SettingsState
interface SettingsState {
  // ... existing fields
  fileViewMode: FileViewMode;
}
```

**Default**: `'flat'` (per spec requirement FR-011)

---

## Extended Entities

### MergeRequest (Extended)

Add approval-related fields to existing MergeRequest type.

```typescript
interface MergeRequest {
  // ... existing fields

  // New fields for approval (P4)
  approvals_required?: number;
  approvals_left?: number;
  approved?: boolean;
  approved_by?: Author[];

  // Fields for update detection (P3)
  sha: string;                 // Already exists
  user_notes_count: number;    // May need to add
  changes_count?: number;      // Optional
}
```

---

### MRChangeSnapshot

For tracking meaningful changes (P3 - false notifications).

```typescript
interface MRChangeSnapshot {
  sha: string;
  state: MRState;
  user_notes_count: number;
  has_conflicts: boolean;
}

// Usage in component
const initialSnapshot = useRef<MRChangeSnapshot | null>(null);
```

---

## Store Updates

### settingsStore.ts

```typescript
interface SettingsState {
  // Existing
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  // ...

  // New (P5)
  fileViewMode: FileViewMode;
  setFileViewMode: (mode: FileViewMode) => void;
}
```

### mrStore.ts

```typescript
interface MRState {
  // Existing
  selectedMrId: number | null;
  filter: MergeRequestFilter;
  // ...

  // New (P6)
  viewedFiles: Map<string, ViewedFile>;
  markFileViewed: (mrId: number, filePath: string) => void;
  unmarkFileViewed: (mrId: number, filePath: string) => void;
  isFileViewed: (mrId: number, filePath: string) => boolean;
  clearViewedFiles: (mrId: number) => void;

  // New (P7)
  searchQuery: string;  // Already exists, but update usage
  parsedFilters: ParsedFilter[];
  setSearchQuery: (query: string) => void;
}
```

---

## Backend Types (Rust)

### src-tauri/src/gitlab/types.rs

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalState {
    pub approved: bool,
    pub approved_by: Vec<Approver>,
    pub approvals_required: i32,
    pub approvals_left: i32,
    pub user_has_approved: bool,
    pub user_can_approve: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Approver {
    pub user: Author,
    pub approved_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApproveResponse {
    pub approved: bool,
    pub approvals_required: i32,
    pub approvals_left: i32,
}
```

---

## Database Schema

No database changes required. All new data is either:
- Fetched from GitLab API (approvals)
- Stored in localStorage via Zustand persist (preferences, viewed files)

---

## Entity Relationship Diagram

```
┌─────────────────┐     ┌──────────────────┐
│  MergeRequest   │────>│  ApprovalState   │
│                 │ 1:1 │                  │
│  - id           │     │  - approved      │
│  - sha          │     │  - approved_by[] │
│  - state        │     │  - user_can_     │
│  - web_url      │     │    approve       │
└────────┬────────┘     └──────────────────┘
         │
         │ 1:n
         ▼
┌─────────────────┐
│   ViewedFile    │
│                 │
│  - mrId         │
│  - filePath     │
│  - viewedAt     │
└─────────────────┘

┌─────────────────┐     ┌──────────────────┐
│  SettingsState  │     │    MRState       │
│  (Zustand)      │     │   (Zustand)      │
│                 │     │                  │
│  - theme        │     │  - viewedFiles   │
│  - fileViewMode │     │  - parsedFilters │
└─────────────────┘     └──────────────────┘
```
