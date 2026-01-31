# GitLab MR Review App

A native desktop application for reviewing GitLab merge requests with AI-powered code suggestions. Built with Tauri, React, and Rust for a fast, secure, cross-platform experience.

## Features

### Core Functionality
- **Unified MR Dashboard** - View all merge requests assigned to you across multiple GitLab projects in one place
- **Rich MR Details** - See project name, author, labels, milestones, and linked issues at a glance
- **Impediment Indicators** - Clear visual indicators for merge conflicts, failing pipelines, unresolved threads, and draft status
- **Syntax-Highlighted Diffs** - View code changes with proper syntax highlighting in unified or split view modes

### Filtering & Search
- Filter by project, author, or impediment status
- Full-text search across MR titles and descriptions
- Save custom filter presets for quick access
- Sort by creation date, update date, or priority

### AI-Powered Code Review
- Analyze diffs with AI to get improvement suggestions
- Categorized suggestions: bugs, code quality, performance, best practices
- One-click to add AI suggestions as comments on the MR
- Support for Claude CLI and direct API integration

### Keyboard-Driven Workflow
- GitLab-compatible keyboard shortcuts
- Full navigation without mouse
- Quick file picker with fuzzy search (Cmd/Ctrl+P)
- Customizable shortcuts

### Performance
- Virtualized rendering for large diffs (10,000+ lines)
- Request deduplication and batching
- Local SQLite caching for offline access
- Progressive loading with skeleton states

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Tauri 2.x](https://tauri.app/) |
| Frontend | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) + [TanStack Query](https://tanstack.com/query) |
| Backend | [Rust](https://www.rust-lang.org/) |
| Database | [SQLite](https://www.sqlite.org/) via [sqlx](https://github.com/launchbadge/sqlx) |
| HTTP | [reqwest](https://github.com/seanmonstar/reqwest) |
| Virtualization | [react-window](https://github.com/bvaughn/react-window) |

## Prerequisites

- **Rust** 1.75+ ([rustup](https://rustup.rs/))
- **Node.js** 20+ LTS
- **pnpm** 8+ (or npm/yarn)
- **Tauri CLI**: `cargo install tauri-cli`

### Platform-Specific

- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: `webkit2gtk-4.1`, `libappindicator3-dev`, `librsvg2-dev`
- **Windows**: WebView2 (pre-installed on Windows 10/11)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-org/gitlab-mr-review-app.git
cd gitlab-mr-review-app

# Install frontend dependencies
pnpm install

# Build Rust dependencies (first time takes a while)
cargo build
```

### 2. Run in Development Mode

```bash
pnpm tauri dev
```

This starts the Vite dev server and launches the app with hot reload.

### 3. Configure GitLab

1. Open Settings (gear icon or press `,`)
2. Navigate to "GitLab Accounts"
3. Click "Add Account" and enter:
   - **Instance URL**: `https://gitlab.com` or your self-hosted URL
   - **Personal Access Token**: [Generate one](https://gitlab.com/-/user_settings/personal_access_tokens) with `read_api` and `api` scopes

### 4. Configure AI (Optional)

For AI-powered suggestions, configure one of:

- **Claude CLI** (recommended): Install and authenticate the [Claude CLI](https://claude.ai/cli)
- **Direct API**: Add your Anthropic or OpenAI API key in Settings

## Building for Production

```bash
# Release build
pnpm tauri build
```

Build outputs:
- **macOS**: `src-tauri/target/release/bundle/macos/GitLab MR Review.app`
- **Linux**: `src-tauri/target/release/bundle/appimage/gitlab-mr-review_*.AppImage`
- **Windows**: `src-tauri/target/release/bundle/msi/GitLab MR Review_*.msi`

## Project Structure

```
gitlab-mr-review-app/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── common/         # Reusable components (Button, Modal, etc.)
│   │   ├── layout/         # App layout (Sidebar, Header)
│   │   ├── mr-list/        # MR list view components
│   │   ├── mr-detail/      # MR detail view components
│   │   └── settings/       # Settings components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Tauri IPC wrappers
│   ├── stores/             # Zustand state stores
│   └── types/              # TypeScript type definitions
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   ├── gitlab/         # GitLab API client
│   │   ├── ai/             # AI provider abstraction
│   │   ├── cache/          # SQLite caching layer
│   │   └── settings/       # Configuration management
│   ├── migrations/         # Database migrations
│   └── Cargo.toml
├── specs/                  # Feature specifications
└── package.json
```

## Keyboard Shortcuts

### Global
| Shortcut | Action |
|----------|--------|
| `?` | Show keyboard shortcuts help |
| `s` or `/` | Focus search |
| `f` | Focus filters |
| `Shift+M` | Go to my merge requests |
| `Shift+R` | Go to review requests |
| `,` | Open settings |
| `Esc` | Close dialogs/popovers |
| `Cmd/Ctrl+\` | Toggle sidebar |

### MR List
| Shortcut | Action |
|----------|--------|
| `j` / `k` | Navigate down/up |
| `Enter` | Open selected MR |
| `o` | Open in GitLab |
| `r` | Refresh list |

### MR Detail
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+P` or `t` | Quick file picker |
| `]` / `[` | Next/previous file |
| `n` / `p` | Next/previous change |
| `c` | Expand/collapse all |
| `v` | Toggle unified/split view |
| `w` | Toggle whitespace |
| `a` | Request AI analysis |

## Development

### Commands

```bash
# Development
pnpm tauri dev          # Run with hot reload
pnpm dev                # Frontend only

# Testing
cargo test              # Rust tests
pnpm lint               # Lint TypeScript

# Formatting
cargo fmt               # Format Rust
pnpm format             # Format TypeScript

# Building
pnpm build              # Build frontend
pnpm tauri build        # Build full app
```

### Adding a Tauri Command

1. Define in `src-tauri/src/commands/`:
```rust
#[tauri::command]
pub async fn my_command(arg: String) -> Result<Response, Error> {
    // Implementation
}
```

2. Register in `src-tauri/src/lib.rs`

3. Call from frontend:
```typescript
import { invoke } from '@tauri-apps/api/core';
const result = await invoke<Response>('my_command', { arg: 'value' });
```

## Data Storage

The app stores data locally:

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/com.gitlab-mr-review/` |
| Linux | `~/.local/share/gitlab-mr-review/` |
| Windows | `%APPDATA%\gitlab-mr-review\` |

- `data.db` - SQLite database (cached MRs, settings)
- Credentials are stored in the system keychain

## Troubleshooting

### App Won't Start
```bash
cargo build              # Check Rust compilation
pnpm build               # Check frontend build
pnpm tauri info          # Check Tauri setup
```

### GitLab Connection Issues
1. Verify token has `read_api` and `api` scopes
2. Check instance URL includes `https://`
3. Test token: `curl -H "PRIVATE-TOKEN: xxx" https://gitlab.com/api/v4/user`

### Performance Issues
1. Clear cache in Settings if corrupted
2. Large diffs automatically use virtualized rendering
3. Set `RUST_LOG=debug` to diagnose slow operations

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Tauri](https://tauri.app/) for the amazing framework
- [GitLab](https://gitlab.com/) for the comprehensive API
- [Anthropic](https://anthropic.com/) for Claude AI capabilities
