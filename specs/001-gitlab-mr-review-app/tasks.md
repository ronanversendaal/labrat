# Tasks: GitLab MR Review App

**Input**: Design documents from `/specs/001-gitlab-mr-review-app/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Tauri/React structure

- [x] T001 Initialize Tauri 2.x project with `pnpm create tauri-app`
- [x] T002 [P] Configure Cargo.toml with dependencies: reqwest, tokio, serde, sqlx, keyring, syntect, uuid, chrono
- [ ] T003 [P] Configure package.json with dependencies: react, typescript, tailwindcss, @tanstack/react-query, zustand, monaco-editor
- [ ] T004 [P] Configure TailwindCSS in `src/styles/globals.css` and `tailwind.config.js`
- [ ] T005 [P] Configure rustfmt.toml and .prettierrc for consistent formatting
- [ ] T006 [P] Configure ESLint and clippy settings for linting
- [ ] T007 Create base folder structure per plan.md: `src-tauri/src/commands/`, `src-tauri/src/gitlab/`, `src-tauri/src/ai/`, `src-tauri/src/cache/`, `src-tauri/src/settings/`
- [ ] T008 [P] Create frontend folder structure: `src/components/`, `src/hooks/`, `src/services/`, `src/stores/`, `src/types/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database & Storage

- [ ] T009 Create SQLite schema migration in `src-tauri/migrations/001_initial_schema.sql` per data-model.md
- [ ] T010 Implement database connection pool in `src-tauri/src/cache/db.rs` using sqlx
- [ ] T011 Implement secure credential storage wrapper in `src-tauri/src/settings/credentials.rs` using keyring crate

### Base Types & Models

- [ ] T012 [P] Define GitLabAccount struct in `src-tauri/src/gitlab/types.rs`
- [ ] T013 [P] Define Project struct in `src-tauri/src/gitlab/types.rs`
- [ ] T014 [P] Define MergeRequest struct with all fields in `src-tauri/src/gitlab/types.rs`
- [ ] T015 [P] Define Author, Milestone, PipelineStatus enums in `src-tauri/src/gitlab/types.rs`
- [ ] T016 [P] Define Diff, DiffFile structs in `src-tauri/src/gitlab/types.rs`
- [ ] T017 [P] Define AIProvider, AISuggestion structs in `src-tauri/src/ai/mod.rs`
- [ ] T018 [P] Define Settings struct in `src-tauri/src/settings/config.rs`
- [ ] T019 [P] Define TauriError struct with error codes in `src-tauri/src/lib.rs`

### Frontend Base Types

- [ ] T020 [P] Define TypeScript types for GitLab entities in `src/types/gitlab.ts` per contracts/tauri-commands.md
- [ ] T021 [P] Define TypeScript types for AI entities in `src/types/ai.ts`
- [ ] T022 [P] Define TypeScript types for Settings in `src/types/settings.ts`

### Tauri IPC Infrastructure

- [ ] T023 Implement Tauri command registration in `src-tauri/src/main.rs` (empty handlers initially)
- [ ] T024 Create Tauri IPC wrapper service in `src/services/tauri.ts` with typed invoke helper

### UI Foundation

- [ ] T025 [P] Create Button component in `src/components/common/Button.tsx`
- [ ] T026 [P] Create Input component in `src/components/common/Input.tsx`
- [ ] T027 [P] Create Modal component in `src/components/common/Modal.tsx`
- [ ] T028 [P] Create Skeleton loader component in `src/components/common/Skeleton.tsx`
- [ ] T029 [P] Create Toast notification component in `src/components/common/Toast.tsx`
- [ ] T030 Create app layout with Sidebar, Header, MainContent in `src/components/layout/`
- [ ] T031 Setup React Query provider in `src/App.tsx`
- [ ] T032 Setup Zustand stores structure in `src/stores/` (mrStore, uiStore, settingsStore)

### GitLab API Client Foundation

- [ ] T033 Implement base HTTP client with auth headers in `src-tauri/src/gitlab/client.rs`
- [ ] T034 Implement rate limit handling and retry logic in `src-tauri/src/gitlab/client.rs`
- [ ] T035 Implement error mapping for GitLab API errors in `src-tauri/src/gitlab/client.rs`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View My Pending Reviews (Priority: P1) 🎯 MVP

**Goal**: Display all merge requests assigned to the user for review with project, author, and impediment info

**Independent Test**: Connect to GitLab and display a list of assigned MRs with impediment indicators

### Backend Implementation for US1

- [ ] T036 [US1] Implement `GET /user` endpoint wrapper in `src-tauri/src/gitlab/client.rs`
- [ ] T037 [US1] Implement `GET /merge_requests` endpoint with reviewer filter in `src-tauri/src/gitlab/merge_requests.rs`
- [ ] T038 [US1] Implement pagination handling (keyset) for MR list in `src-tauri/src/gitlab/merge_requests.rs`
- [ ] T039 [US1] Implement MR cache storage/retrieval in `src-tauri/src/cache/mr_cache.rs`
- [ ] T040 [US1] Implement `gitlab_list_accounts` command in `src-tauri/src/commands/gitlab.rs`
- [ ] T041 [US1] Implement `gitlab_add_account` command with token validation in `src-tauri/src/commands/gitlab.rs`
- [ ] T042 [US1] Implement `gitlab_validate_token` command in `src-tauri/src/commands/gitlab.rs`
- [ ] T043 [US1] Implement `gitlab_set_active_account` command in `src-tauri/src/commands/gitlab.rs`
- [ ] T044 [US1] Implement `gitlab_list_merge_requests` command in `src-tauri/src/commands/gitlab.rs`
- [ ] T045 [US1] Implement background refresh with configurable interval in `src-tauri/src/commands/gitlab.rs`
- [ ] T046 [US1] Implement `mr:list_updated` event emission in `src-tauri/src/commands/gitlab.rs`

### Frontend Implementation for US1

- [ ] T047 [US1] Implement MR list Zustand store with loading states in `src/stores/mrStore.ts`
- [ ] T048 [US1] Implement useGitLab hook for MR list fetching in `src/hooks/useGitLab.ts`
- [ ] T049 [US1] Create MRCard component displaying title, project, author, avatar in `src/components/mr-list/MRCard.tsx`
- [ ] T050 [US1] Create ImpedimentBadge component for conflicts, pipeline, threads, draft in `src/components/mr-list/ImpedimentBadge.tsx`
- [ ] T051 [US1] Create MRList component with skeleton loading in `src/components/mr-list/MRList.tsx`
- [ ] T052 [US1] Implement grouping/sorting by project, date, author in `src/components/mr-list/MRList.tsx`
- [ ] T053 [US1] Wire MRList to Tauri backend and display real data

**Checkpoint**: User Story 1 complete - Users can view their pending MR reviews with impediment indicators

---

## Phase 4: User Story 2 - Filter and Search MRs (Priority: P2)

**Goal**: Enable filtering by project, author, impediment, labels, and text search

**Independent Test**: Apply filters and verify the MR list updates correctly

### Backend Implementation for US2

- [ ] T054 [US2] Extend `gitlab_list_merge_requests` command to accept filter parameters in `src-tauri/src/commands/gitlab.rs`
- [ ] T055 [US2] Implement filter logic for project_id, author_username, labels, state in `src-tauri/src/gitlab/merge_requests.rs`
- [ ] T056 [US2] Implement client-side filtering for impediment types (conflicts, pipeline_failed, draft) in `src-tauri/src/commands/gitlab.rs`
- [ ] T057 [US2] Implement text search across MR title/description in `src-tauri/src/commands/gitlab.rs`
- [ ] T058 [US2] Implement filter preset storage in `filter_presets` table in `src-tauri/src/cache/db.rs`

### Frontend Implementation for US2

- [ ] T059 [US2] Implement UI store for filter state in `src/stores/uiStore.ts`
- [ ] T060 [US2] Create MRFilters component with dropdowns for project, author, impediment in `src/components/mr-list/MRFilters.tsx`
- [ ] T061 [US2] Implement search input with debounced text search in `src/components/mr-list/MRFilters.tsx`
- [ ] T062 [US2] Implement "Clear all filters" button in `src/components/mr-list/MRFilters.tsx`
- [ ] T063 [US2] Implement filter combination logic in `src/hooks/useGitLab.ts`
- [ ] T064 [US2] Persist filter state across sessions via settings in `src/stores/uiStore.ts`

**Checkpoint**: User Story 2 complete - Users can filter and search their MR queue

---

## Phase 5: User Story 3 - View MR Details and Diff (Priority: P3)

**Goal**: Display full MR details with syntax-highlighted diff, file navigation, and line numbers

**Independent Test**: Open any MR and verify all details and diff content display correctly

### Backend Implementation for US3

- [ ] T065 [US3] Implement `GET /projects/:id/merge_requests/:iid` wrapper in `src-tauri/src/gitlab/merge_requests.rs`
- [ ] T066 [US3] Implement `GET /projects/:id/merge_requests/:iid/changes` wrapper in `src-tauri/src/gitlab/diffs.rs`
- [ ] T067 [US3] Implement diff parsing and line number extraction in `src-tauri/src/utils/diff_parser.rs`
- [ ] T068 [US3] Implement syntax highlighting with syntect in `src-tauri/src/utils/diff_parser.rs`
- [ ] T069 [US3] Implement diff cache storage/retrieval in `src-tauri/src/cache/diff_cache.rs`
- [ ] T070 [US3] Implement `gitlab_get_merge_request` command in `src-tauri/src/commands/gitlab.rs`
- [ ] T071 [US3] Implement `gitlab_get_diff` command with progressive loading in `src-tauri/src/commands/gitlab.rs`
- [ ] T072 [US3] Implement `GET /projects/:id/merge_requests/:iid/discussions` wrapper in `src-tauri/src/gitlab/comments.rs`
- [ ] T073 [US3] Implement `gitlab_get_discussions` command in `src-tauri/src/commands/gitlab.rs`
- [ ] T074 [US3] Implement diff prefetching for visible MRs in `src-tauri/src/commands/gitlab.rs`

### Frontend Implementation for US3

- [ ] T075 [US3] Create MRDetail container component in `src/components/mr-detail/MRDetail.tsx`
- [ ] T076 [US3] Create MRDescription component showing description, labels, milestone in `src/components/mr-detail/MRDescription.tsx`
- [ ] T077 [US3] Integrate Monaco Editor for diff rendering in `src/components/mr-detail/DiffView.tsx`
- [ ] T078 [US3] Implement unified/split diff view modes in `src/components/mr-detail/DiffView.tsx`
- [ ] T079 [US3] Implement line numbers with addition/deletion/modification highlighting in `src/components/mr-detail/DiffView.tsx`
- [ ] T080 [US3] Create FileTree component with expand/collapse in `src/components/mr-detail/FileTree.tsx`
- [ ] T081 [US3] Implement file navigation (next/previous file) in `src/components/mr-detail/DiffView.tsx`
- [ ] T082 [US3] Create CommitList component in `src/components/mr-detail/CommitList.tsx`
- [ ] T083 [US3] Implement "Open in GitLab" button with external link in `src/components/mr-detail/MRDetail.tsx`
- [ ] T084 [US3] Implement progressive loading UI with skeleton for large diffs in `src/components/mr-detail/DiffView.tsx`
- [ ] T085 [US3] Implement virtualized scrolling for smooth 60fps on large diffs in `src/components/mr-detail/DiffView.tsx`

**Checkpoint**: User Story 3 complete - Users can view MR details and navigate syntax-highlighted diffs

---

## Phase 6: User Story 4 - AI-Powered Code Suggestions (Priority: P4)

**Goal**: Analyze MR diffs with AI and display categorized improvement suggestions

**Independent Test**: Open an MR with code changes and verify AI suggestions appear with actionable recommendations

### Backend Implementation for US4

- [ ] T086 [US4] Define AIProvider trait in `src-tauri/src/ai/provider.rs`
- [ ] T087 [US4] Implement Claude CLI backend in `src-tauri/src/ai/claude_cli.rs` (subprocess with stdin/stdout JSON)
- [ ] T088 [US4] Implement `ai_check_cli_available` command to detect Claude CLI in `src-tauri/src/commands/ai.rs`
- [ ] T089 [US4] Implement Anthropic API backend in `src-tauri/src/ai/anthropic.rs`
- [ ] T090 [US4] Implement OpenAI API backend in `src-tauri/src/ai/openai.rs`
- [ ] T091 [US4] Implement AI provider storage in `ai_providers` table in `src-tauri/src/cache/db.rs`
- [ ] T092 [US4] Implement `ai_list_providers` command in `src-tauri/src/commands/ai.rs`
- [ ] T093 [US4] Implement `ai_add_provider` command with API key storage in keychain in `src-tauri/src/commands/ai.rs`
- [ ] T094 [US4] Implement `ai_set_default_provider` command in `src-tauri/src/commands/ai.rs`
- [ ] T095 [US4] Implement diff analysis prompt construction in `src-tauri/src/ai/mod.rs`
- [ ] T096 [US4] Implement `ai_analyze_diff` command with streaming progress in `src-tauri/src/commands/ai.rs`
- [ ] T097 [US4] Implement `ai:analysis_progress` event emission in `src-tauri/src/commands/ai.rs`
- [ ] T098 [US4] Implement AISuggestion storage in `ai_suggestions` table in `src-tauri/src/cache/db.rs`
- [ ] T099 [US4] Implement `ai_update_suggestion_status` command (pending/accepted/dismissed) in `src-tauri/src/commands/ai.rs`

### Frontend Implementation for US4

- [ ] T100 [US4] Implement useAI hook for analysis triggering in `src/hooks/useAI.ts`
- [ ] T101 [US4] Create AISuggestions panel component in `src/components/ai/AISuggestions.tsx`
- [ ] T102 [US4] Create SuggestionCard showing location, category, severity, description in `src/components/ai/SuggestionCard.tsx`
- [ ] T103 [US4] Implement suggestion category badges (code_quality, potential_bug, performance, security, etc.) in `src/components/ai/SuggestionCard.tsx`
- [ ] T104 [US4] Implement "Analyze with AI" button for manual triggering in `src/components/mr-detail/MRDetail.tsx`
- [ ] T105 [US4] Implement analysis progress indicator in `src/components/ai/AISuggestions.tsx`
- [ ] T106 [US4] Implement dismiss suggestion action in `src/components/ai/SuggestionCard.tsx`
- [ ] T107 [US4] Link suggestion to diff line (scroll to line on click) in `src/components/ai/SuggestionCard.tsx`

**Checkpoint**: User Story 4 complete - Users can analyze MRs with AI and view categorized suggestions

---

## Phase 7: User Story 5 - Keyboard-Driven Navigation (Priority: P5)

**Goal**: Full keyboard navigation matching GitLab conventions with help dialog

**Independent Test**: Navigate through all app features using only keyboard

### Implementation for US5

- [ ] T108 [US5] Create keyboard shortcut registry in `src/services/keyboard.ts`
- [ ] T109 [US5] Implement platform-aware modifier detection (⌘ on macOS, Ctrl on Windows/Linux) in `src/services/keyboard.ts`
- [ ] T110 [US5] Implement useKeyboardShortcuts hook in `src/hooks/useKeyboardShortcuts.ts`
- [ ] T111 [US5] Create KeyboardHelpModal listing all shortcuts in `src/components/common/KeyboardHelpModal.tsx`
- [ ] T112 [US5] Implement `?` shortcut to show help modal
- [ ] T113 [P] [US5] Implement global shortcuts: `s`/`/` search, `f` filter, `Esc` close dialogs, `⌘+\` toggle sidebar
- [ ] T114 [P] [US5] Implement MR list navigation: `Shift+m` my MRs, `Shift+r` review requests
- [ ] T115 [P] [US5] Implement diff navigation: `]`/`j` next file, `[`/`k` previous file, `n`/`p` threads
- [ ] T116 [P] [US5] Implement file browser shortcuts: arrows, `Enter` open, `y` permalink, `Shift+f` toggle, `v` mark viewed
- [ ] T117 [P] [US5] Implement editing shortcuts: `⌘+b` bold, `⌘+i` italic, `⌘+k` link, `⌘+Shift+x` strikethrough, `⌘+Shift+p` preview
- [ ] T118 [P] [US5] Implement commit navigation: `c` next, `x` previous
- [ ] T119 [P] [US5] Implement context shortcuts: `e` edit, `l` labels, `a` assignee, `m` milestone, `b` copy branch
- [ ] T120 [P] [US5] Implement review shortcuts: `⌘+Enter` add to review, `Shift+⌘+Enter` publish, `r` reply with quote
- [ ] T121 [US5] Implement `⌘+p`/`t` quick file picker modal in `src/components/mr-detail/QuickFilePicker.tsx`
- [ ] T122 [US5] Ensure all interactive elements are focusable and keyboard-accessible

**Checkpoint**: User Story 5 complete - Users can navigate the entire app using keyboard shortcuts

---

## Phase 8: User Story 6 - Configure Application Settings (Priority: P6)

**Goal**: Comprehensive settings UI for GitLab accounts, AI providers, and app preferences

**Independent Test**: Modify settings and verify changes persist and take effect

### Backend Implementation for US6

- [ ] T123 [US6] Implement settings initialization with defaults in `src-tauri/src/settings/config.rs`
- [ ] T124 [US6] Implement `settings_get` command in `src-tauri/src/commands/settings.rs`
- [ ] T125 [US6] Implement `settings_update` command in `src-tauri/src/commands/settings.rs`
- [ ] T126 [US6] Implement `settings_reset` command in `src-tauri/src/commands/settings.rs`
- [ ] T127 [US6] Implement `gitlab_remove_account` command in `src-tauri/src/commands/gitlab.rs`
- [ ] T128 [US6] Implement `ai_remove_provider` command in `src-tauri/src/commands/ai.rs`
- [ ] T129 [US6] Implement `cache_get_stats` command in `src-tauri/src/commands/cache.rs`
- [ ] T130 [US6] Implement `cache_clear` command in `src-tauri/src/commands/cache.rs`
- [ ] T131 [US6] Implement `cache_evict_old` command in `src-tauri/src/commands/cache.rs`
- [ ] T132 [US6] Implement `connection:status` event for account connectivity in `src-tauri/src/commands/gitlab.rs`

### Frontend Implementation for US6

- [ ] T133 [US6] Implement settings Zustand store in `src/stores/settingsStore.ts`
- [ ] T134 [US6] Implement useSettings hook in `src/hooks/useSettings.ts`
- [ ] T135 [US6] Create SettingsPage layout with navigation in `src/components/settings/SettingsPage.tsx`
- [ ] T136 [US6] Create GitLabSettings panel with account management in `src/components/settings/GitLabSettings.tsx`
- [ ] T137 [US6] Implement add/edit/remove GitLab account forms in `src/components/settings/GitLabSettings.tsx`
- [ ] T138 [US6] Create AISettings panel with provider management in `src/components/settings/AISettings.tsx`
- [ ] T139 [US6] Implement Claude CLI detection and configuration in `src/components/settings/AISettings.tsx`
- [ ] T140 [US6] Implement API key entry for Anthropic/OpenAI in `src/components/settings/AISettings.tsx`
- [ ] T141 [US6] Implement auto-analyze toggle in `src/components/settings/AISettings.tsx`
- [ ] T142 [US6] Create GeneralSettings panel (theme, refresh interval, cache) in `src/components/settings/GeneralSettings.tsx`
- [ ] T143 [US6] Implement "Reset to defaults" with confirmation dialog in `src/components/settings/SettingsPage.tsx`
- [ ] T144 [US6] Display connection status indicators for each service in settings

**Checkpoint**: User Story 6 complete - Users can configure all app settings

---

## Phase 9: User Story 7 - Post AI Suggestions to GitLab (Priority: P7)

**Goal**: Post AI suggestions as comments or code suggestions on GitLab MRs

**Independent Test**: Accept an AI suggestion and verify it appears on the MR in GitLab

### Backend Implementation for US7

- [ ] T145 [US7] Implement `POST /projects/:id/merge_requests/:iid/discussions` wrapper in `src-tauri/src/gitlab/comments.rs`
- [ ] T146 [US7] Implement GitLab suggestion syntax formatting (```suggestion block) in `src-tauri/src/gitlab/comments.rs`
- [ ] T147 [US7] Implement `gitlab_post_comment` command with position data in `src-tauri/src/commands/gitlab.rs`
- [ ] T148 [US7] Update suggestion status to 'posted' after successful post in `src-tauri/src/commands/gitlab.rs`

### Frontend Implementation for US7

- [ ] T149 [US7] Create PostSuggestionModal for editing before posting in `src/components/ai/PostSuggestionModal.tsx`
- [ ] T150 [US7] Implement "Post as comment" action in `src/components/ai/SuggestionCard.tsx`
- [ ] T151 [US7] Implement "Post as suggestion" action (GitLab apply-able format) in `src/components/ai/SuggestionCard.tsx`
- [ ] T152 [US7] Implement suggestion text editing in `src/components/ai/PostSuggestionModal.tsx`
- [ ] T153 [US7] Implement additional context input in `src/components/ai/PostSuggestionModal.tsx`
- [ ] T154 [US7] Show success confirmation with link to posted comment in `src/components/ai/PostSuggestionModal.tsx`
- [ ] T155 [US7] Update suggestion card to show "Posted" status after successful post

**Checkpoint**: User Story 7 complete - Users can post AI suggestions to GitLab

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Error Handling & Edge Cases

- [ ] T156 Handle expired/invalid GitLab token with re-authentication prompt
- [ ] T157 Handle extremely large diffs (10,000+ lines) with chunked loading
- [ ] T158 Handle "no MRs assigned" empty state with helpful message
- [ ] T159 Handle GitLab unreachable with offline mode fallback
- [ ] T160 Handle MR updated/closed while viewing with refresh prompt
- [ ] T161 Handle project access revoked gracefully
- [ ] T162 Handle AI analysis timeout with retry option
- [ ] T163 Handle posting to merged/closed MR with error message
- [ ] T164 Handle Claude CLI not installed with setup instructions
- [ ] T165 Handle invalid/rate-limited API keys with clear feedback
- [ ] T166 Handle account switching mid-session safely
- [ ] T167 Handle corrupted settings with reset option
- [ ] T168 Handle secure storage unavailable with fallback warning
- [ ] T169 Handle cache full condition with auto-eviction
- [ ] T170 Handle slow network with timeout and retry

### Performance Optimization

- [ ] T171 [P] Implement request cancellation when navigating away in `src-tauri/src/gitlab/client.rs`
- [ ] T172 [P] Implement request batching for GitLab API calls in `src-tauri/src/gitlab/client.rs`
- [ ] T173 [P] Optimize diff rendering with virtualization in `src/components/mr-detail/DiffView.tsx`
- [ ] T174 [P] Implement lazy loading for off-screen diff content
- [ ] T175 [P] Add performance tracing with tracing crate in Rust backend

### Final Polish

- [ ] T176 Run quickstart.md validation - verify all setup steps work
- [ ] T177 Review and update all loading states and skeleton UIs
- [ ] T178 Audit keyboard shortcuts for consistency and conflicts
- [ ] T179 Ensure all error messages are user-friendly
- [ ] T180 Final accessibility audit (WCAG 2.1 AA compliance)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
  - User stories can then proceed in priority order (P1 → P2 → ... → P7)
  - Some parallelization possible: US1/US2 backend can inform US6 backend
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Builds on US1 MR list - can run after US1 backend is complete
- **User Story 3 (P3)**: Builds on US1/US2 list selection - can start once MR list displays
- **User Story 4 (P4)**: Requires US3 diff view to be complete for AI analysis display
- **User Story 5 (P5)**: Can be implemented in parallel once US1-US4 have UI components
- **User Story 6 (P6)**: Backend can start early (T123-T132), frontend needs layout from Phase 2
- **User Story 7 (P7)**: Requires US4 AI suggestions to be complete

### Within Each User Story

- Backend implementations before corresponding frontend
- Models/types before services
- Services before UI components
- Core functionality before polish/edge cases

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational type definitions (T012-T022) can run in parallel
- All common UI components (T025-T029) can run in parallel
- Within US5, most shortcut implementations (T113-T120) can run in parallel

---

## Implementation Strategy

### MVP First (User Stories 1-3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (View MRs)
4. Complete Phase 4: User Story 2 (Filter/Search)
5. Complete Phase 5: User Story 3 (Details/Diff)
6. **STOP and VALIDATE**: Test core review workflow independently
7. Deploy/demo as MVP

### Full Feature Set

1. Continue with US4: AI Suggestions
2. Add US5: Keyboard Navigation
3. Add US6: Settings (can partially overlap with US4-5)
4. Add US7: Post to GitLab
5. Complete Phase 10: Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Monaco Editor is recommended for diff view per research.md
- Claude CLI integration uses subprocess with JSON stdin/stdout per research.md
- All keyboard shortcuts must support platform-appropriate modifiers per FR-045
