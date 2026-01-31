# Quickstart: GitLab MR Review App

**Date**: 2026-01-31
**Feature**: 001-gitlab-mr-review-app

## Prerequisites

### Development Environment

- **Rust**: 1.75+ (install via [rustup](https://rustup.rs/))
- **Node.js**: 20+ LTS
- **pnpm**: 8+ (or npm/yarn)
- **Platform-specific**:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `webkit2gtk-4.1`, `libappindicator3-dev`, `librsvg2-dev`
  - **Windows**: WebView2 (usually pre-installed on Windows 10/11)

### Tauri CLI

```bash
cargo install tauri-cli
```

## Project Setup

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/your-org/gitlab-mr-review-app.git
cd gitlab-mr-review-app

# Install frontend dependencies
pnpm install

# Build Rust dependencies (first time takes a while)
cargo build
```

### 2. Environment Configuration

Create `.env` file in project root:

```bash
# Development settings
RUST_LOG=debug
TAURI_DEBUG=1

# Optional: Override Claude CLI path
CLAUDE_CLI_PATH=/usr/local/bin/claude
```

### 3. Database Setup

The SQLite database is created automatically on first run at:
- **macOS**: `~/Library/Application Support/com.gitlab-mr-review/data.db`
- **Linux**: `~/.local/share/gitlab-mr-review/data.db`
- **Windows**: `%APPDATA%\gitlab-mr-review\data.db`

For development, you can reset the database:
```bash
rm -rf ~/Library/Application\ Support/com.gitlab-mr-review/  # macOS
```

## Development Workflow

### Running in Development Mode

```bash
# Start Tauri dev server (hot reload for frontend + backend)
pnpm tauri dev
```

This will:
1. Start Vite dev server for the frontend
2. Compile Rust backend
3. Launch the app window with dev tools enabled

### Running Tests

```bash
# Rust tests
cargo test

# Frontend tests
pnpm test

# E2E tests (requires app to be built)
pnpm test:e2e

# All tests
pnpm test:all
```

### Linting and Formatting

```bash
# Rust
cargo fmt --check
cargo clippy -- -D warnings

# TypeScript
pnpm lint
pnpm lint:fix

# Format all
pnpm format
```

## Building for Production

### Debug Build

```bash
pnpm tauri build --debug
```

### Release Build

```bash
pnpm tauri build
```

Build outputs:
- **macOS**: `src-tauri/target/release/bundle/macos/GitLab MR Review.app`
- **Linux**: `src-tauri/target/release/bundle/appimage/gitlab-mr-review_*.AppImage`
- **Windows**: `src-tauri/target/release/bundle/msi/GitLab MR Review_*.msi`

## First Run Configuration

### 1. Add GitLab Account

1. Launch the app
2. Click "Settings" (gear icon) or press `,`
3. Navigate to "GitLab Accounts"
4. Click "Add Account"
5. Enter:
   - **Name**: Friendly name (e.g., "Work GitLab")
   - **Instance URL**: `https://gitlab.com` or your self-hosted URL
   - **Personal Access Token**: Generate at GitLab → Settings → Access Tokens
     - Required scopes: `read_api`, `api`

### 2. Configure AI Provider

1. In Settings, navigate to "AI Providers"
2. **Option A: Claude CLI** (recommended if you have Claude Max)
   - Ensure `claude` CLI is installed and authenticated
   - Click "Add Claude CLI"
   - App will auto-detect if CLI is available
3. **Option B: Direct API**
   - Click "Add API Provider"
   - Select provider (Anthropic, OpenAI)
   - Enter API key
   - Select model

### 3. Verify Setup

1. Return to main view
2. You should see your pending merge requests
3. Open any MR to verify diff loading
4. Click "Analyze with AI" to test AI integration

## Project Structure Overview

```
gitlab-mr-review-app/
├── src/                    # TypeScript/React frontend
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks
│   ├── services/           # Tauri IPC wrappers
│   ├── stores/             # Zustand stores
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri IPC handlers
│   │   ├── gitlab/         # GitLab API client
│   │   ├── ai/             # AI provider abstraction
│   │   ├── cache/          # SQLite caching layer
│   │   └── settings/       # Configuration management
│   └── Cargo.toml
├── tests/                  # Test files
│   ├── e2e/                # Playwright E2E tests
│   └── unit/               # Vitest unit tests
├── specs/                  # Feature specifications
└── package.json
```

## Common Development Tasks

### Adding a New Tauri Command

1. Define the command in `src-tauri/src/commands/`:
```rust
#[tauri::command]
pub async fn my_new_command(arg: String) -> Result<MyResponse, Error> {
    // Implementation
}
```

2. Register in `src-tauri/src/main.rs`:
```rust
.invoke_handler(tauri::generate_handler![
    commands::my_new_command,
    // ... other commands
])
```

3. Call from frontend:
```typescript
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke<MyResponse>('my_new_command', { arg: 'value' });
```

### Adding a New React Component

1. Create component in `src/components/`:
```tsx
// src/components/my-feature/MyComponent.tsx
export function MyComponent() {
  return <div>...</div>;
}
```

2. Add tests:
```tsx
// tests/unit/components/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/my-feature/MyComponent';

test('renders correctly', () => {
  render(<MyComponent />);
  expect(screen.getByText('...')).toBeInTheDocument();
});
```

### Database Migrations

Migrations are in `src-tauri/migrations/`. To add a new migration:

1. Create `src-tauri/migrations/YYYYMMDDHHMMSS_description.sql`
2. Migrations run automatically on app start

### Debugging

- **Frontend**: Use browser dev tools (Cmd+Shift+I in app window)
- **Backend**: Check terminal output, use `RUST_LOG=debug`
- **IPC**: Enable Tauri logging in dev mode

## Troubleshooting

### App Won't Start

1. Check Rust compilation: `cargo build`
2. Check frontend build: `pnpm build`
3. Check Tauri: `pnpm tauri info`

### GitLab Connection Issues

1. Verify token has correct scopes
2. Check instance URL (include `https://`)
3. Test token: `curl -H "PRIVATE-TOKEN: xxx" https://gitlab.com/api/v4/user`

### AI Analysis Not Working

1. **Claude CLI**: Verify `claude --version` works
2. **API**: Check API key is valid
3. Check console for error messages

### Performance Issues

1. Check cache size in Settings
2. Clear cache if corrupted: Settings → Cache → Clear All
3. Check `RUST_LOG=debug` output for slow operations

## Useful Commands

```bash
# Clean build
cargo clean && pnpm clean

# Update dependencies
cargo update && pnpm update

# Generate Rust documentation
cargo doc --open

# Check for security vulnerabilities
cargo audit
pnpm audit

# Profile release build
cargo build --release --timings
```

## Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [GitLab API Docs](https://docs.gitlab.com/ee/api/)
- [Rust Book](https://doc.rust-lang.org/book/)
- [React Documentation](https://react.dev/)
