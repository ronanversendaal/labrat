# Quickstart: MR Review UX Fixes

**Feature**: 001-mr-review-ux-fixes
**Date**: 2026-02-01

## Prerequisites

- Node.js 18+ and pnpm
- Rust 1.75+ with cargo
- Tauri CLI v2
- GitLab account with API token (scopes: `api` or `read_api` + `write_repository`)

## Setup

```bash
# Clone and install dependencies
git clone <repo-url>
cd gitlab-review-app
git checkout 001-mr-review-ux-fixes
pnpm install

# Start development server
pnpm tauri:dev
```

## Feature-Specific Development

### P1: Dark Theme Fix

**Files to modify**:
- `src/App.tsx` - Add theme class effect
- `src/styles/globals.css` - Verify CSS variables

**Test**:
1. Open app
2. Go to Settings > Appearance
3. Switch between Light/Dark/System themes
4. Verify all text is readable in dark mode

### P2: Open in GitLab Button

**Files to modify**:
- `src/components/mr-detail/MRDetailView.tsx` - Update button handler

**Test**:
1. Open any MR detail view
2. Click "Open in GitLab" button
3. Verify correct URL opens in default browser

### P3: False Update Notifications

**Files to modify**:
- `src/components/mr-detail/MRDetailView.tsx` - Update change detection logic

**Test**:
1. Open an MR that hasn't changed
2. Wait 30+ seconds (poll interval)
3. Verify no false "MR Updated" notification appears

### P4: MR Approval

**Files to modify**:
- `src-tauri/src/gitlab/types.rs` - Add ApprovalState types
- `src-tauri/src/gitlab/merge_requests.rs` - Add approval API methods
- `src-tauri/src/commands/gitlab.rs` - Add Tauri commands
- `src/types/gitlab.ts` - Add TypeScript types
- `src/services/tauri.ts` - Add command wrappers
- `src/hooks/useGitLab.ts` - Add React Query hooks
- `src/components/mr-detail/MRDetailView.tsx` - Add approval UI

**Test**:
1. Open an MR you can approve (not your own)
2. Click Approve button
3. Verify approval status updates
4. Verify you can unapprove

### P5: File View Toggle

**Files to modify**:
- `src/stores/settingsStore.ts` - Add fileViewMode
- `src/components/mr-detail/FileTree.tsx` - Add flat view support

**Test**:
1. Open an MR with multiple files
2. Toggle between Flat and Tree views
3. Close and reopen app
4. Verify preference persists

### P6: Mark File as Viewed

**Files to modify**:
- `src/stores/mrStore.ts` - Add viewedFiles tracking
- `src/hooks/useKeyboardShortcuts.ts` - (already exists)
- `src/components/mr-detail/FileTree.tsx` - Add visual indicator
- `src/components/mr-detail/MRDetailView.tsx` - Register shortcut

**Test**:
1. Open an MR diff
2. Select a file
3. Press 'v' key
4. Verify checkmark/indicator appears
5. Press 'v' again to toggle off

### P7: Search-Based Filtering

**Files to modify**:
- `src/components/mr-list/MRFilters.tsx` - Replace with search input
- `src/stores/mrStore.ts` - Add filter parsing

**Test**:
1. Type `author:yourname` in search
2. Verify autocomplete suggestions
3. Verify MR list filters correctly
4. Try `status:draft` and combined filters

### P8: Merge Description into Changes

**Files to modify**:
- `src/components/mr-detail/MRDetailView.tsx` - Add collapsible description

**Test**:
1. Open an MR
2. Go to Changes tab
3. Verify description appears above file list
4. Toggle collapse/expand

### P9: Rename Discussions Tab

**Files to modify**:
- `src/components/mr-detail/MRDetailView.tsx` - Change tab label

**Test**:
1. Open any MR
2. Verify tab says "Activity" instead of "Discussions"

## Running Tests

```bash
# Frontend tests
pnpm test

# Backend tests
cd src-tauri
cargo test

# Lint
pnpm lint
cargo clippy
```

## Common Issues

### Theme not applying
- Check that `.dark` class is on `document.documentElement`
- Verify settingsStore subscription in App.tsx

### Approval fails with 401
- Verify GitLab token has `api` scope
- Check you're not trying to approve your own MR

### External URL doesn't open
- Ensure `@tauri-apps/plugin-shell` is configured in `tauri.conf.json`
- Check allowlist includes `shell.open`

## Architecture Reference

```
┌────────────────────────────────────────────────┐
│                   Frontend                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Components│  │  Hooks   │  │   Stores     │ │
│  │          │  │          │  │              │ │
│  │ MRDetail │◄─│useGitLab │◄─│ mrStore      │ │
│  │ FileTree │  │useApprove│  │ settingsStore│ │
│  │ Filters  │  │          │  │              │ │
│  └──────────┘  └──────────┘  └──────────────┘ │
│        │              │                        │
│        └──────────────┼────────────────────────┤
│                       │                        │
│               ┌───────▼───────┐               │
│               │  tauri.ts     │               │
│               │  (invoke)     │               │
│               └───────┬───────┘               │
└───────────────────────┼────────────────────────┘
                        │ IPC
┌───────────────────────┼────────────────────────┐
│                       │       Backend          │
│               ┌───────▼───────┐               │
│               │  commands/    │               │
│               │  gitlab.rs    │               │
│               └───────┬───────┘               │
│                       │                        │
│               ┌───────▼───────┐               │
│               │  gitlab/      │               │
│               │  client.rs    │───► GitLab API│
│               └───────────────┘               │
└────────────────────────────────────────────────┘
```
