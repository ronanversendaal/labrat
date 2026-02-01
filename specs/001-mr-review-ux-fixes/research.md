# Research: MR Review UX Fixes

**Feature**: 001-mr-review-ux-fixes
**Date**: 2026-02-01
**Purpose**: Resolve technical unknowns before implementation

## Research Topics

### 1. Dark Theme Implementation in Tauri/React

**Question**: How to properly propagate theme setting to Tailwind's dark mode?

**Decision**: Use class-based dark mode with document root class toggle

**Rationale**:
- Tailwind CSS v4 uses `dark:` variants that respond to `.dark` class on an ancestor
- Current implementation in `globals.css` defines `.dark` and `.light` classes with CSS variables
- The settingsStore already tracks `theme: 'light' | 'dark' | 'system'`
- Missing: Effect to apply class to `document.documentElement`

**Implementation**:
```typescript
// In App.tsx or main.tsx
useEffect(() => {
  const root = document.documentElement;
  const theme = useSettingsStore.getState().theme;

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}, [theme]);
```

**Alternatives Considered**:
- Media query only: Rejected - doesn't support manual override
- CSS variables only: Rejected - Tailwind dark: variants won't work

---

### 2. Tauri External URL Handling

**Question**: Does `<a href={url} target="_blank">` work in Tauri, or is shell.open needed?

**Decision**: Use Tauri's `shell.open` API for reliable cross-platform behavior

**Rationale**:
- Standard `<a>` tags with `target="_blank"` may not work in Tauri's webview
- Tauri 2.x provides `@tauri-apps/plugin-shell` for opening external URLs
- More reliable across platforms (macOS, Windows, Linux)

**Implementation**:
```typescript
import { open } from '@tauri-apps/plugin-shell';

const handleOpenInGitLab = async () => {
  await open(mr.web_url);
};
```

**Alternatives Considered**:
- Standard anchor tag: May work but unreliable in webview context
- window.open: Blocked in many contexts

---

### 3. GitLab Approval API

**Question**: What API endpoints are needed for MR approval?

**Decision**: Use GitLab Merge Request Approvals API

**Rationale**: GitLab provides dedicated approval endpoints with proper permission handling

**API Endpoints**:

```
# Get approval state
GET /projects/:id/merge_requests/:mr_iid/approval_state

# Get approvals
GET /projects/:id/merge_requests/:mr_iid/approvals

# Approve MR
POST /projects/:id/merge_requests/:mr_iid/approve

# Unapprove MR
POST /projects/:id/merge_requests/:mr_iid/unapprove
```

**Response Structure** (approval_state):
```json
{
  "approval_rules_overwritten": false,
  "rules": [
    {
      "id": 1,
      "name": "rule1",
      "rule_type": "regular",
      "eligible_approvers": [...],
      "approvals_required": 1,
      "approved_by": [...],
      "approved": true
    }
  ]
}
```

**Required Scopes**: `api` or `read_api` + `write_repository`

**Alternatives Considered**:
- Using MR update endpoint: Doesn't support approval actions
- Comments only: Doesn't formally approve

---

### 4. MR Update Detection Strategy

**Question**: How to detect meaningful MR updates vs. noise?

**Decision**: Track specific meaningful fields instead of `updated_at`

**Rationale**:
- `updated_at` changes for any modification including views, label changes
- Users only care about code changes, state changes, and new discussions

**Fields to Track**:
```typescript
interface MRChangeDetection {
  sha: string;              // HEAD commit changed = code updated
  state: string;            // open/merged/closed changed
  merge_status: string;     // can_be_merged status changed
  has_conflicts: boolean;   // conflict state changed
  discussion_locked: boolean;
  // Counts that indicate activity
  user_notes_count: number;
  changes_count: number;
}
```

**Implementation**:
```typescript
const initialSnapshot = useRef({
  sha: mr.sha,
  state: mr.state,
  user_notes_count: mr.user_notes_count,
});

const hasRealUpdate = currentMR && (
  currentMR.sha !== initialSnapshot.current.sha ||
  currentMR.state !== initialSnapshot.current.state ||
  currentMR.user_notes_count > initialSnapshot.current.user_notes_count
);
```

**Alternatives Considered**:
- Keep using updated_at: Too noisy, causes false positives
- Polling diff content: Too expensive

---

### 5. File View Mode Persistence

**Question**: Where to store file view preference (flat vs tree)?

**Decision**: Add to existing settingsStore with localStorage persistence

**Rationale**:
- settingsStore already uses Zustand persist middleware
- Consistent with other preference storage (theme, font size, etc.)
- Survives app restarts

**Implementation**:
```typescript
// In settingsStore.ts
interface SettingsState {
  // ... existing
  fileViewMode: 'flat' | 'tree';
  setFileViewMode: (mode: 'flat' | 'tree') => void;
}
```

**Alternatives Considered**:
- mrStore: Rejected - that's for MR-specific state, not preferences
- Separate store: Rejected - over-engineering for one preference

---

### 6. Keyboard Shortcut Registration

**Question**: How to add 'v' key for marking files as viewed?

**Decision**: Use existing useKeyboardShortcuts hook

**Rationale**:
- Hook already exists at `src/hooks/useKeyboardShortcuts.ts`
- Already used in MRDetailView for quick file picker (Cmd+P)
- Supports scope isolation to prevent conflicts

**Implementation**:
```typescript
useKeyboardShortcuts([
  {
    id: 'mark-file-viewed',
    label: 'Mark Viewed',
    description: 'Toggle file viewed status',
    keys: ['v'],
    category: 'diff',
    handler: toggleCurrentFileViewed,
    preventDefault: true,
  },
], { scope: 'mr-detail' });
```

**Alternatives Considered**:
- Direct keydown listener: Rejected - conflicts with other shortcuts
- Mousetrap library: Rejected - already have custom hook

---

### 7. Search Filter Syntax Parsing

**Question**: How to parse filter queries like "author:john status:draft"?

**Decision**: Simple regex-based parser with known filter types

**Rationale**:
- Limited set of filter types (author, project, status, label)
- No need for complex parser library
- Can iterate to add more filters

**Implementation**:
```typescript
interface ParsedFilter {
  type: 'author' | 'project' | 'status' | 'label' | 'text';
  value: string;
}

function parseFilterQuery(query: string): ParsedFilter[] {
  const filters: ParsedFilter[] = [];
  const filterRegex = /(\w+):(\S+)/g;
  let match;
  let remaining = query;

  while ((match = filterRegex.exec(query)) !== null) {
    const [full, type, value] = match;
    if (['author', 'project', 'status', 'label'].includes(type)) {
      filters.push({ type: type as ParsedFilter['type'], value });
      remaining = remaining.replace(full, '');
    }
  }

  const textSearch = remaining.trim();
  if (textSearch) {
    filters.push({ type: 'text', value: textSearch });
  }

  return filters;
}
```

**Alternatives Considered**:
- Full parser generator: Over-engineering
- GitLab's exact syntax: Too complex for MVP

---

## Summary of Decisions

| Topic | Decision | Risk Level |
|-------|----------|------------|
| Dark theme | Class-based with document root toggle | Low |
| External URLs | Tauri shell.open API | Low |
| Approval API | GitLab Approvals API endpoints | Medium (permissions) |
| Update detection | Track sha, state, notes_count | Low |
| View preference | settingsStore with persist | Low |
| Keyboard shortcut | Existing useKeyboardShortcuts hook | Low |
| Filter parsing | Simple regex parser | Low |

All research topics resolved. Ready for Phase 1 design.
