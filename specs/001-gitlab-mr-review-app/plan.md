# Implementation Plan: GitLab MR Review App

**Branch**: `001-gitlab-mr-review-app` | **Date**: 2026-01-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-gitlab-mr-review-app/spec.md`

## Summary

A native cross-platform desktop application for reviewing GitLab merge requests locally with AI-powered code suggestions. Built with Rust and Tauri for performance, the app provides a keyboard-first interface matching GitLab conventions, intelligent caching for instant responsiveness, and pluggable AI backends (Claude CLI primary, with API fallbacks). Core value: faster MR reviews than the GitLab web interface with AI assistance.

## Technical Context

**Language/Version**: Rust 1.75+ (stable)
**Primary Dependencies**:
- Tauri 2.x (desktop app framework with webview)
- reqwest (async HTTP client for GitLab API)
- tokio (async runtime)
- serde/serde_json (serialization)
- sqlx with SQLite (local database/cache)
- keyring (OS secure credential storage)
- syntect (syntax highlighting)

**Frontend Stack**:
- TypeScript + React 18 (Tauri webview UI)
- TailwindCSS (styling)
- Monaco Editor or CodeMirror (diff view)
- tanstack-query (data fetching/caching)

**Storage**: SQLite (via sqlx) for local cache + settings persistence
**Testing**: cargo test (Rust), vitest (TypeScript), Playwright (E2E)
**Target Platform**: macOS, Windows, Linux (cross-platform via Tauri)
**Project Type**: Desktop application (Tauri: Rust backend + web frontend)

**Performance Goals**:
- MR list display: <2s (instant from cache)
- Diff rendering start: <1s
- UI interactions: <100ms perceived latency
- Smooth scrolling: 60fps for 5000+ line diffs

**Constraints**:
- <200MB memory baseline
- Offline-capable (cached data)
- Must handle 10,000+ line diffs without freezing

**Scale/Scope**:
- Single user, multiple GitLab accounts
- Typical: 10-50 active MRs, diffs up to 5000 lines
- Cache size: 100MB-1GB configurable

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality ✅

| Requirement | Compliance |
|-------------|------------|
| Readability First | Rust's strong typing + clippy lints enforce clear code |
| Single Responsibility | Modular architecture: separate crates for core, api, cache, ui |
| No Dead Code | `#[warn(dead_code)]` + clippy `--deny warnings` in CI |
| Consistent Formatting | rustfmt + prettier (TypeScript) enforced via pre-commit |
| Explicit Over Implicit | Rust's explicit error handling; no hidden side effects |

### II. Testing Standards ✅

| Requirement | Compliance |
|-------------|------------|
| Test-First Development | TDD workflow: write failing tests → implement → refactor |
| Coverage Requirements | cargo-tarpaulin for Rust, vitest coverage for TS |
| Unit Tests | All business logic in Rust core crate, fully tested |
| Integration Tests | API client tests with mock server, cache tests with temp DB |
| Contract Tests | GitLab API contract tests with recorded responses |
| Test Quality | <100ms unit tests, deterministic, no flaky tests policy |

### III. User Experience Consistency ✅

| Requirement | Compliance |
|-------------|------------|
| Design System | TailwindCSS design tokens, consistent component library |
| Feedback Patterns | Skeleton loaders, progress indicators, toast notifications |
| Error Handling | User-friendly error messages, no stack traces exposed |
| Accessibility | WCAG 2.1 AA: keyboard nav, ARIA labels, color contrast |
| Responsive Behavior | Tauri window resizing, responsive layouts |
| State Persistence | SQLite for settings, preferences preserved across sessions |

### IV. Performance Requirements ✅

| Requirement | Compliance |
|-------------|------------|
| Response Time <200ms | Rust backend ensures fast processing; async throughout |
| UI Interactions <100ms | React concurrent features, virtualized lists |
| Memory Efficiency | Rust memory safety, no leaks; streaming large diffs |
| No N+1 Queries | Batched GitLab API calls, SQLite with proper indexes |
| Graceful Degradation | Timeout handling, offline mode, circuit breaker pattern |
| Monitoring | Tracing crate for performance instrumentation |

**Gate Status**: ✅ PASSED - All constitution principles satisfied by design.

## Project Structure

### Documentation (this feature)

```text
specs/001-gitlab-mr-review-app/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API schemas)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src-tauri/                    # Rust backend
├── Cargo.toml
├── src/
│   ├── main.rs              # Tauri app entry point
│   ├── lib.rs               # Library root
│   ├── commands/            # Tauri IPC commands
│   │   ├── mod.rs
│   │   ├── gitlab.rs        # GitLab API commands
│   │   ├── ai.rs            # AI analysis commands
│   │   ├── settings.rs      # Settings commands
│   │   └── cache.rs         # Cache management commands
│   ├── gitlab/              # GitLab API client
│   │   ├── mod.rs
│   │   ├── client.rs        # HTTP client wrapper
│   │   ├── types.rs         # API response types
│   │   ├── merge_requests.rs
│   │   ├── diffs.rs
│   │   └── comments.rs
│   ├── ai/                  # AI provider abstraction
│   │   ├── mod.rs
│   │   ├── provider.rs      # Provider trait
│   │   ├── claude_cli.rs    # Claude CLI backend
│   │   ├── anthropic.rs     # Direct Anthropic API
│   │   └── openai.rs        # OpenAI API
│   ├── cache/               # Local caching layer
│   │   ├── mod.rs
│   │   ├── db.rs            # SQLite operations
│   │   ├── mr_cache.rs      # MR metadata cache
│   │   └── diff_cache.rs    # Diff content cache
│   ├── settings/            # Configuration management
│   │   ├── mod.rs
│   │   ├── config.rs        # Settings structure
│   │   └── credentials.rs   # Secure credential storage
│   └── utils/
│       ├── mod.rs
│       └── diff_parser.rs   # Unified diff parsing
└── tests/
    ├── integration/
    └── fixtures/

src/                          # TypeScript/React frontend
├── main.tsx                 # React entry point
├── App.tsx                  # Root component
├── components/
│   ├── common/              # Shared UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Skeleton.tsx
│   │   └── Toast.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── MainContent.tsx
│   ├── mr-list/
│   │   ├── MRList.tsx
│   │   ├── MRCard.tsx
│   │   ├── MRFilters.tsx
│   │   └── ImpedimentBadge.tsx
│   ├── mr-detail/
│   │   ├── MRDetail.tsx
│   │   ├── MRDescription.tsx
│   │   ├── DiffView.tsx
│   │   ├── FileTree.tsx
│   │   └── CommitList.tsx
│   ├── ai/
│   │   ├── AISuggestions.tsx
│   │   ├── SuggestionCard.tsx
│   │   └── PostSuggestionModal.tsx
│   └── settings/
│       ├── SettingsPage.tsx
│       ├── GitLabSettings.tsx
│       ├── AISettings.tsx
│       └── GeneralSettings.tsx
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── useGitLab.ts
│   ├── useAI.ts
│   └── useSettings.ts
├── services/
│   ├── tauri.ts             # Tauri IPC wrapper
│   └── keyboard.ts          # Keyboard shortcut registry
├── stores/
│   ├── mrStore.ts           # MR state management
│   ├── uiStore.ts           # UI state (filters, selection)
│   └── settingsStore.ts     # Settings state
├── types/
│   ├── gitlab.ts            # GitLab API types
│   ├── ai.ts                # AI types
│   └── settings.ts          # Settings types
└── styles/
    └── globals.css          # TailwindCSS imports

tests/
├── e2e/                     # Playwright E2E tests
│   ├── mr-list.spec.ts
│   ├── mr-detail.spec.ts
│   ├── ai-suggestions.spec.ts
│   └── settings.spec.ts
└── unit/                    # Vitest unit tests
    └── components/
```

**Structure Decision**: Tauri architecture with clear separation between Rust backend (performance-critical operations, API calls, caching) and TypeScript/React frontend (UI rendering, keyboard handling). This enables maximum performance while maintaining developer productivity for UI work.

## Complexity Tracking

> No violations - architecture aligns with constitution principles.

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Tauri over Electron | Smaller bundle, better performance, Rust backend | Electron (larger, slower), native per-platform (3x effort) |
| SQLite over IndexedDB | Cross-process access, better query support, Rust ecosystem | IndexedDB (webview-only), RocksDB (overkill) |
| React over vanilla | Component reuse, ecosystem, TanStack Query for caching | Svelte (smaller ecosystem), Solid (less mature) |
