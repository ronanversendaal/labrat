# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Development - run with hot reload
pnpm tauri dev

# Frontend only (no Tauri)
pnpm dev

# Build for production
pnpm tauri build

# Type checking
pnpm tsc --noEmit

# Linting
pnpm lint

# Rust tests
cargo test --manifest-path src-tauri/Cargo.toml

# Format code
cargo fmt --manifest-path src-tauri/Cargo.toml
pnpm format
```

## Architecture Overview

This is a **Tauri 2.x** desktop application with a React frontend and Rust backend for reviewing GitLab merge requests.

### Frontend (React + TypeScript)

**State Management:**
- `src/stores/mrStore.ts` - Merge request list, filters, grouping
- `src/stores/uiStore.ts` - UI state (modals, sidebar, diff view mode)
- `src/stores/settingsStore.ts` - User preferences

**Data Fetching:**
- `src/hooks/useGitLab.ts` - TanStack Query hooks for GitLab data
- `src/hooks/useAI.ts` - AI analysis hooks
- `src/services/tauri.ts` - Type-safe IPC wrapper for all Tauri commands

**Key Components:**
- `src/components/mr-detail/MonacoDiffView.tsx` - Monaco Editor-based diff viewer
- `src/components/mr-detail/VirtualizedDiff.tsx` - react-window fallback for large diffs

### Backend (Rust)

**Command Structure:**
- All Tauri commands are in `src-tauri/src/commands/`
- Commands are registered in `src-tauri/src/lib.rs` via `tauri::generate_handler!`

**GitLab API:**
- `src-tauri/src/gitlab/client.rs` - HTTP client with auth, pagination, rate limiting
- `src-tauri/src/gitlab/merge_requests.rs` - MR fetching and filtering
- `src-tauri/src/gitlab/diffs.rs` - Diff retrieval

**Data Storage:**
- SQLite database via sqlx (`src-tauri/src/cache/db.rs`)
- Credentials in system keychain via keyring crate (`src-tauri/src/settings/credentials.rs`)
- Database migrations in `src-tauri/migrations/`

### Adding a Tauri Command

1. Define command in `src-tauri/src/commands/`:
```rust
#[tauri::command]
pub async fn my_command(state: State<'_, SharedAppState>, arg: String) -> TauriResult<Response> {
    // Implementation
}
```

2. Register in `src-tauri/src/lib.rs` in the `invoke_handler` macro

3. Add TypeScript types in `src/types/`

4. Add wrapper in `src/services/tauri.ts`:
```typescript
export async function myCommand(arg: string): Promise<Response> {
  return invoke<Response>('my_command', { arg });
}
```

## Key Dependencies

**Frontend:** React 19, TanStack Query, Zustand, Monaco Editor, react-window, Tailwind CSS 4

**Backend:** Tauri 2, reqwest, sqlx (SQLite), keyring, syntect (syntax highlighting)

## Error Handling

Backend errors use `TauriError` with standardized codes: `not_authenticated`, `network_error`, `api_error`, `rate_limited`, `invalid_token`, etc.

Frontend catches these via `TauriCommandError` class in `src/services/tauri.ts`.
