# Tasks: MR Review UX Fixes and Enhancements

**Input**: Design documents from `/specs/001-mr-review-ux-fixes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/approval-api.md

**Tests**: Not explicitly requested - test tasks omitted. Manual validation per quickstart.md.

**Organization**: Tasks are grouped by user story (P1-P9) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US9)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `src/` (React + TypeScript)
- **Backend**: `src-tauri/src/` (Rust)
- **Styles**: `src/styles/`
- **Types**: `src/types/` (frontend), `src-tauri/src/*/types.rs` (backend)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify environment and ensure dependencies are ready

- [ ] T001 Verify Tauri shell plugin is configured for external URLs in src-tauri/tauri.conf.json
- [ ] T002 [P] Verify @tauri-apps/plugin-shell is installed in package.json

**Checkpoint**: Environment ready for feature development

---

## Phase 2: Foundational (No blocking prerequisites)

**Purpose**: This feature extends existing infrastructure - no foundational tasks required

All user stories modify existing files or add to existing patterns. No new infrastructure needed.

**Checkpoint**: Ready to begin user story implementation

---

## Phase 3: User Story 1 - Fix Dark Theme Readability (Priority: P1)

**Goal**: Make all text readable in dark theme with WCAG AA contrast (4.5:1 minimum)

**Independent Test**: Switch to dark theme and verify all text throughout the application is clearly visible with appropriate contrast.

### Implementation for User Story 1

- [ ] T003 [US1] Add theme class synchronization effect in src/App.tsx to apply dark/light class to document.documentElement
- [ ] T004 [US1] Ensure settingsStore theme change triggers document class update in src/stores/settingsStore.ts
- [ ] T005 [P] [US1] Audit and fix text colors in src/components/mr-list/MRCard.tsx for dark mode
- [ ] T006 [P] [US1] Audit and fix text colors in src/components/mr-list/MRFilters.tsx for dark mode
- [ ] T007 [P] [US1] Audit and fix text colors in src/components/mr-detail/MRDetailView.tsx for dark mode
- [ ] T008 [P] [US1] Audit and fix text colors in src/components/mr-detail/FileTree.tsx for dark mode
- [ ] T009 [P] [US1] Verify Monaco Editor theme syncs with app theme in src/components/mr-detail/MonacoDiffView.tsx
- [ ] T010 [US1] Verify CSS variables in src/styles/globals.css have sufficient contrast ratios

**Checkpoint**: Dark theme fully functional - all text readable with 4.5:1+ contrast

---

## Phase 4: User Story 2 - Fix "Open in GitLab" Button (Priority: P2)

**Goal**: Make "Open in GitLab" button open the correct URL in the default browser

**Independent Test**: Click "Open in GitLab" button and verify the correct MR page opens in the default browser.

### Implementation for User Story 2

- [ ] T011 [US2] Replace anchor tag with Tauri shell.open() call in src/components/mr-detail/MRDetailView.tsx
- [ ] T012 [US2] Import and configure shell plugin from @tauri-apps/plugin-shell in src/components/mr-detail/MRDetailView.tsx
- [ ] T013 [US2] Add error handling for shell.open() failures with user feedback in src/components/mr-detail/MRDetailView.tsx

**Checkpoint**: Open in GitLab button works reliably across all platforms

---

## Phase 5: User Story 3 - Fix False "MR Updated" Notifications (Priority: P3)

**Goal**: Only show update notifications when meaningful changes occur (sha, state, notes count)

**Independent Test**: Open an MR that has not been modified and verify no false update notifications appear over a 5-minute period.

### Implementation for User Story 3

- [ ] T014 [US3] Create MRChangeSnapshot interface in src/types/gitlab.ts for tracking meaningful fields
- [ ] T015 [US3] Refactor update detection in src/components/mr-detail/MRDetailView.tsx to compare sha, state, user_notes_count instead of updated_at
- [ ] T016 [US3] Store initial snapshot on MR open in src/components/mr-detail/MRDetailView.tsx
- [ ] T017 [US3] Update hasUpdates logic to only trigger on meaningful field changes in src/components/mr-detail/MRDetailView.tsx

**Checkpoint**: No false update notifications - only triggers on real changes

---

## Phase 6: User Story 4 - Add MR Approval and Actions (Priority: P4)

**Goal**: Enable users to approve/unapprove MRs directly from the application

**Independent Test**: Complete a full review and approval workflow entirely within the application.

### Implementation for User Story 4

- [ ] T018 [P] [US4] Add ApprovalState and Approver types to src/types/gitlab.ts
- [ ] T019 [P] [US4] Add ApprovalState and ApproveResponse structs to src-tauri/src/gitlab/types.rs
- [ ] T020 [US4] Add get_approval_state method to GitLabClient in src-tauri/src/gitlab/merge_requests.rs
- [ ] T021 [US4] Add approve_mr method to GitLabClient in src-tauri/src/gitlab/merge_requests.rs
- [ ] T022 [US4] Add unapprove_mr method to GitLabClient in src-tauri/src/gitlab/merge_requests.rs
- [ ] T023 [US4] Add gitlab_get_approval_state Tauri command in src-tauri/src/commands/gitlab.rs
- [ ] T024 [US4] Add gitlab_approve_mr Tauri command in src-tauri/src/commands/gitlab.rs
- [ ] T025 [US4] Add gitlab_unapprove_mr Tauri command in src-tauri/src/commands/gitlab.rs
- [ ] T026 [US4] Register new commands in src-tauri/src/lib.rs
- [ ] T027 [US4] Add getApprovalState, approveMR, unapproveMR wrappers in src/services/tauri.ts
- [ ] T028 [US4] Add useApprovalState query hook in src/hooks/useGitLab.ts
- [ ] T029 [US4] Add useApproveMR mutation hook in src/hooks/useGitLab.ts
- [ ] T030 [US4] Add useUnapproveMR mutation hook in src/hooks/useGitLab.ts
- [ ] T031 [US4] Create ApprovalButton component in src/components/common/ApprovalButton.tsx
- [ ] T032 [US4] Integrate ApprovalButton into MRDetailView header in src/components/mr-detail/MRDetailView.tsx
- [ ] T033 [US4] Add approval status display showing approvers and count in src/components/mr-detail/MRDetailView.tsx
- [ ] T034 [US4] Handle self-approval restriction (disable button for MR author) in src/components/common/ApprovalButton.tsx

**Checkpoint**: Full approval workflow functional - approve, unapprove, status display

---

## Phase 7: User Story 5 - File List View Mode Toggle (Priority: P5)

**Goal**: Support both flat list and folder hierarchy views with preference persistence

**Independent Test**: Toggle between folder and list views, close and reopen the app, verify preference is preserved.

### Implementation for User Story 5

- [ ] T035 [US5] Add FileViewMode type and fileViewMode state to src/stores/settingsStore.ts with default 'flat'
- [ ] T036 [US5] Add setFileViewMode action to src/stores/settingsStore.ts
- [ ] T037 [US5] Add flat list rendering mode to src/components/mr-detail/FileTree.tsx
- [ ] T038 [US5] Add view mode toggle button UI in src/components/mr-detail/FileTree.tsx header
- [ ] T039 [US5] Connect FileTree to settingsStore for view mode in src/components/mr-detail/FileTree.tsx
- [ ] T040 [US5] Ensure view mode persists via Zustand persist middleware in src/stores/settingsStore.ts

**Checkpoint**: File view toggle works with persistent preference

---

## Phase 8: User Story 6 - Mark File as Viewed Shortcut (Priority: P6)

**Goal**: Allow users to mark files as viewed using 'v' keyboard shortcut with visual indicator

**Independent Test**: Use keyboard shortcut to mark a file as viewed and verify visual indication updates.

### Implementation for User Story 6

- [ ] T041 [US6] Add ViewedFile interface and viewedFiles Map to src/stores/mrStore.ts
- [ ] T042 [US6] Add markFileViewed, unmarkFileViewed, isFileViewed, clearViewedFiles actions to src/stores/mrStore.ts
- [ ] T043 [US6] Configure viewedFiles persistence in Zustand persist middleware in src/stores/mrStore.ts
- [ ] T044 [US6] Register 'v' keyboard shortcut using useKeyboardShortcuts in src/components/mr-detail/MRDetailView.tsx
- [ ] T045 [US6] Add visual indicator (checkmark) for viewed files in src/components/mr-detail/FileTree.tsx
- [ ] T046 [US6] Connect FileTree to mrStore for viewed status in src/components/mr-detail/FileTree.tsx
- [ ] T047 [US6] Clear viewed files when MR sha changes (file content updated) in src/components/mr-detail/MRDetailView.tsx

**Checkpoint**: Mark as viewed shortcut works with persistent visual indicator

---

## Phase 9: User Story 7 - Search-Based Filtering (Priority: P7)

**Goal**: Replace checkbox filters with search bar supporting filter syntax (author:, status:, etc.)

**Independent Test**: Type filter queries in the search bar and verify suggestions appear and filters apply correctly.

### Implementation for User Story 7

- [ ] T048 [US7] Add ParsedFilter interface and FilterType type to src/types/gitlab.ts
- [ ] T049 [US7] Add parsedFilters state to src/stores/mrStore.ts
- [ ] T050 [US7] Create parseFilterQuery utility function in src/utils/filterParser.ts
- [ ] T051 [US7] Replace checkbox filter UI with search input in src/components/mr-list/MRFilters.tsx
- [ ] T052 [US7] Add filter type suggestions dropdown (author:, project:, status:, label:) in src/components/mr-list/MRFilters.tsx
- [ ] T053 [US7] Add autocomplete for filter values from recent MRs in src/components/mr-list/MRFilters.tsx
- [ ] T054 [US7] Apply parsed filters to MR list filtering logic in src/components/mr-list/MRFilters.tsx
- [ ] T055 [US7] Support free-text search across titles and descriptions in src/components/mr-list/MRFilters.tsx
- [ ] T056 [US7] Add filter chip display for active filters in src/components/mr-list/MRFilters.tsx

**Checkpoint**: Search-based filtering fully functional with autocomplete

---

## Phase 10: User Story 8 - Merge Description into Changes Tab (Priority: P8)

**Goal**: Display MR description in a collapsible section within the Changes tab

**Independent Test**: View an MR and verify description appears alongside changes without needing to switch tabs.

### Implementation for User Story 8

- [ ] T057 [US8] Create CollapsibleDescription component in src/components/mr-detail/CollapsibleDescription.tsx
- [ ] T058 [US8] Add CollapsibleDescription above file list in Changes tab in src/components/mr-detail/MRDetailView.tsx
- [ ] T059 [US8] Implement collapse/expand toggle with state persistence in src/components/mr-detail/CollapsibleDescription.tsx
- [ ] T060 [US8] Render markdown description using existing MRDescription rendering in src/components/mr-detail/CollapsibleDescription.tsx

**Checkpoint**: Description visible in Changes tab without switching tabs

---

## Phase 11: User Story 9 - Rename Discussions to Activity/History (Priority: P9)

**Goal**: Rename "Discussions" tab to "Activity" for clarity

**Independent Test**: Verify the tab is renamed and content accurately represents activity/history.

### Implementation for User Story 9

- [ ] T061 [US9] Rename "Discussions" tab to "Activity" in src/components/mr-detail/MRDetailView.tsx
- [ ] T062 [US9] Update Tab type from 'discussions' to 'activity' in src/components/mr-detail/MRDetailView.tsx
- [ ] T063 [US9] Verify DiscussionList component name still makes sense or rename to ActivityList in src/components/mr-detail/MRDetailView.tsx

**Checkpoint**: Tab renamed to Activity - content unchanged

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T064 Run ESLint and fix any warnings in modified files
- [ ] T065 Run cargo clippy and fix any warnings in modified Rust files
- [ ] T066 Verify TypeScript compilation passes with no errors
- [ ] T067 Run through quickstart.md validation scenarios for all user stories
- [ ] T068 Verify all user story independent tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: N/A - no foundational tasks
- **User Stories (Phases 3-11)**: Can proceed after Setup
- **Polish (Phase 12)**: After all user stories complete

### User Story Dependencies

```
P1 (US1) Dark Theme ────── No dependencies, start first
P2 (US2) Open GitLab ───── No dependencies, parallel with P1
P3 (US3) Notifications ─── No dependencies, parallel with P1/P2

P4 (US4) Approval ──────── No dependencies, parallel track

P5 (US5) View Toggle ───── Soft dependency on P1 (theme must work for visibility)
P6 (US6) Mark Viewed ───── Depends on P5 (modifies same FileTree component)

P7 (US7) Search Filter ─── No dependencies, parallel track

P8 (US8) Merge Tabs ────── Soft dependency on P9 (tab structure clarity)
P9 (US9) Rename Tab ────── No dependencies, very quick
```

### Recommended Execution Order

1. **Critical Bugs First**: P1 → P2 → P3 (sequential, quick wins)
2. **Core Feature**: P4 (larger, can run in parallel with critical bugs)
3. **UX Improvements**: P5 → P6 (sequential due to FileTree dependency)
4. **Parallel Track**: P7, P8, P9 (independent)

### Within Each User Story

- Types/interfaces before implementations
- Backend before frontend (for P4)
- Store updates before component updates
- Core logic before UI polish

### Parallel Opportunities

Within each phase, tasks marked [P] can run simultaneously:

**Phase 3 (P1)**: T005, T006, T007, T008, T009 (different component files)
**Phase 6 (P4)**: T018, T019 (TypeScript and Rust types in parallel)

---

## Parallel Example: User Story 4 (Approval)

```bash
# First, create types in parallel:
Task: "Add ApprovalState types to src/types/gitlab.ts"
Task: "Add ApprovalState structs to src-tauri/src/gitlab/types.rs"

# Then backend methods sequentially:
Task: "Add get_approval_state to GitLabClient"
Task: "Add approve_mr to GitLabClient"
Task: "Add unapprove_mr to GitLabClient"

# Then Tauri commands and frontend wrappers
# Finally, UI components
```

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 3: User Story 1 - Dark Theme (T003-T010)
3. Complete Phase 4: User Story 2 - Open GitLab (T011-T013)
4. Complete Phase 5: User Story 3 - Notifications (T014-T017)
5. **STOP and VALIDATE**: Test all critical bug fixes
6. Deploy/demo - core usability restored

### Incremental Delivery

1. **MVP**: P1 + P2 + P3 → Critical bugs fixed
2. **v1.1**: Add P4 (Approval) → Core workflow complete
3. **v1.2**: Add P5 + P6 (File view, shortcuts) → Power user features
4. **v1.3**: Add P7 (Search) → Advanced filtering
5. **v1.4**: Add P8 + P9 (UI polish) → Final UX refinements

### Single Developer Strategy

Work in priority order:
1. P1 (1 day) → P2 (0.5 day) → P3 (0.5 day) = 2 days for MVP
2. P4 (2 days) → P5 (0.5 day) → P6 (0.5 day) = 3 days
3. P7 (1-2 days) → P8 (0.5 day) → P9 (0.25 day) = 2-3 days

**Total estimated**: 7-8 days for complete implementation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable
- Commit after each task or logical group
- P1-P3 are bug fixes (highest priority)
- P4+ are enhancements (can be deferred if needed)
- Run quickstart.md validation after each phase
