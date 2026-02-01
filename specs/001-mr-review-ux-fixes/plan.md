# Implementation Plan: MR Review UX Fixes

**Branch**: `001-mr-review-ux-fixes` | **Date**: 2026-02-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mr-review-ux-fixes/spec.md`

## Summary

This plan addresses 9 prioritized bug fixes and UX enhancements for the GitLab MR Review App. The critical P1-P3 items fix broken core functionality (dark theme readability, Open in GitLab button, false update notifications). P4+ items add new capabilities (MR approval, file view toggle, keyboard shortcuts, search filtering, UI reorganization).

**Technical Approach**: Incremental fixes leveraging existing Tauri/React architecture. Dark theme fix requires CSS variable propagation. MR approval requires new GitLab API integration. File view and search features extend existing Zustand stores.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Rust 1.75+ (backend)
**Primary Dependencies**: React 19, Tauri 2.x, Zustand, TanStack Query, Monaco Editor, Tailwind CSS v4
**Storage**: SQLite (sqlx) for caching, localStorage for preferences
**Testing**: Vitest (frontend), cargo test (backend)
**Target Platform**: macOS, Windows, Linux desktop (Tauri)
**Project Type**: Desktop app with web frontend + Rust backend
**Performance Goals**: <100ms UI interactions, <200ms API responses
**Constraints**: Offline-capable for cached data, GitLab API rate limits
**Scale/Scope**: Single-user desktop app, 100s of MRs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | PASS | Follows existing patterns, no dead code |
| II. Testing Standards | PASS | Unit tests for stores, integration for API |
| III. UX Consistency | PASS | P1 specifically fixes WCAG compliance |
| IV. Performance | PASS | No new heavy operations, maintains <100ms |

**Quality Gates Applicable**:
- Lint: ESLint + Clippy must pass
- Tests: Vitest + cargo test coverage maintained
- Accessibility: P1 specifically addresses WCAG AA contrast

## Project Structure

### Documentation (this feature)

```text
specs/001-mr-review-ux-fixes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── approval-api.md  # GitLab approval API contract
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
# Tauri Desktop App Structure

src/                          # React frontend
├── components/
│   ├── mr-detail/
│   │   ├── MRDetailView.tsx  # P8: Merge description, P9: Rename tab
│   │   ├── FileTree.tsx      # P5: View toggle, P6: Mark as viewed
│   │   └── MonacoDiffView.tsx
│   ├── mr-list/
│   │   └── MRFilters.tsx     # P7: Search-based filtering
│   └── common/
│       └── ApprovalButton.tsx # P4: New component
├── hooks/
│   └── useGitLab.ts          # P4: Add approval hooks
├── stores/
│   ├── settingsStore.ts      # P1: Theme, P5: View preference
│   └── mrStore.ts            # P6: Viewed files tracking
├── services/
│   └── tauri.ts              # P4: Approval command wrapper
├── styles/
│   └── globals.css           # P1: Dark theme fixes
└── types/
    └── gitlab.ts             # P4: Approval types

src-tauri/src/                # Rust backend
├── commands/
│   └── gitlab.rs             # P4: Approval commands
├── gitlab/
│   ├── merge_requests.rs     # P3: Update detection, P4: Approval API
│   └── types.rs              # P4: Approval types
└── lib.rs
```

**Structure Decision**: Existing Tauri desktop app structure. Changes are additive to existing files with minimal new components (ApprovalButton.tsx).

## Complexity Tracking

No constitution violations. All changes follow existing patterns:
- State management: Extend existing Zustand stores
- API calls: Add to existing GitLab client
- UI components: Modify existing or add small new components
- Styling: Use existing Tailwind dark: variants

## Implementation Phases

### Phase 1: Critical Bug Fixes (P1-P3)

**P1 - Dark Theme Fix**
- Fix CSS variable propagation from settingsStore to document root
- Ensure all components use Tailwind `dark:` variants correctly
- Validate WCAG AA contrast (4.5:1 minimum)

**P2 - Open in GitLab Button**
- Button already exists in MRDetailView.tsx (line 208-215)
- Uses `<a href={mr.web_url}>` which should work
- Investigate if Tauri shell.open is needed for external URLs

**P3 - False Update Notifications**
- Current logic compares `updated_at` timestamps (MRDetailView.tsx:41-44)
- Issue: Minor metadata changes trigger false positives
- Fix: Track specific fields (state, sha, discussions_count)

### Phase 2: Core Enhancement (P4)

**P4 - MR Approval Actions**
- Backend: Add GitLab approval API calls
- Frontend: Add ApprovalButton component
- State: Track approval status in MR data

### Phase 3: UX Improvements (P5-P6)

**P5 - File View Toggle**
- Add view mode to settingsStore (flat/tree)
- Modify FileTree to support both modes
- Persist preference

**P6 - Mark as Viewed Shortcut**
- Add viewedFiles Set to mrStore
- Add keyboard handler for 'v' key
- Visual indicator in FileTree

### Phase 4: Advanced Features (P7-P9)

**P7 - Search-Based Filtering**
- Replace checkbox filters with search input
- Implement filter syntax parser (author:, status:, etc.)
- Autocomplete suggestions

**P8 - Merge Description into Changes**
- Add collapsible description section to Changes tab
- Preserve existing Description tab for full view

**P9 - Rename Discussions Tab**
- Simple label change: "Discussions" → "Activity"
- Ensure content reflects activity/history

## Dependencies

```
P1 (Dark Theme) ─── No dependencies, start first
P2 (Open GitLab) ── No dependencies
P3 (Notifications) ─ No dependencies

P4 (Approval) ───── Requires GitLab API research
                    └── research.md

P5 (View Toggle) ── Depends on P1 (theme must work)
P6 (Mark Viewed) ── Depends on P5 (FileTree changes)

P7 (Search Filter) ─ No dependencies, parallel track
P8 (Merge Tabs) ──── Depends on P9 (tab structure)
P9 (Rename Tab) ──── No dependencies
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| GitLab API approval permissions | Medium | High | Check API scopes, document requirements |
| Dark theme CSS conflicts | Low | Medium | Systematic audit of all components |
| Search filter complexity | Medium | Medium | Start simple, iterate |
| Monaco Editor theme sync | Low | Low | Already has theme support |

## Success Metrics

Per spec.md SC-001 through SC-008:
- 100% text contrast in dark theme (testable via color contrast tools)
- Open in GitLab works 100% of attempts
- Zero false notifications in 30-min sessions
- Approval completes in <5 seconds
- Preferences persist across restarts
- Search suggestions appear in <200ms
- Keyboard shortcut responds in <100ms
- Description accessible without tab switching
