# LabRat

A native desktop application for reviewing GitLab merge requests with AI-powered code suggestions. Built with Tauri, React, and Rust for a fast, secure, cross-platform experience.

## Features

### Three Main Views
- **My Reviews** — Merge requests where you're a reviewer, with impediment indicators (conflicts, failing pipelines, unresolved threads, draft status)
- **My MRs** — Your authored merge requests with merge-readiness detection
- **Pipelines Browser** — Browse pipelines across projects with stage visualization, job logs, test reports, and artifact downloads

### MR Detail Tabs
- **Changes** — Monaco-powered diffs (split or unified) with inline comment threads, code suggestions, and file tree with viewed-state tracking
- **Pipeline** — Pipeline stage visualization with job log streaming (ANSI color support) and test reports
- **Activity** — Chronological timeline of all MR events (comments, approvals, pushes, status changes)
- **AI** — AI-powered code review with categorized suggestions

### Diff & Code Review
- Monaco Editor split/unified diffs with syntax highlighting
- Inline comment threads with rich text editor (Tiptap)
- Code suggestions with diff preview
- File tree with viewed-state tracking
- Quick file picker with fuzzy search (`Cmd/Ctrl+P`)
- Virtualized rendering for large diffs (10,000+ lines)

### Pipelines
- Project sidebar for browsing pipelines across accounts
- Pipeline stage visualization with job status
- Job log streaming with ANSI color rendering
- Test report summaries
- Artifact download to `~/Downloads`

### AI Code Review
- Support for Claude, GPT-4, and local models
- Categorized suggestions: bugs, code quality, performance, best practices
- Batch-post AI suggestions as comments to GitLab

### Customization
- 16 themes (8 dark + 8 light) plus system auto-detect
  - Dark: Default Dark, Kanagawa Wave, Catppuccin Mocha, Rosé Pine, Tokyo Night, Nord, Everforest Dark, Dracula
  - Light: Default Light, GitHub Light, Solarized Light, Gruvbox Light, Everforest Light, Catppuccin Latte, Rosé Pine Dawn, One Light
- UI and code font selection with live preview
- Configurable font size

### Multi-Account Support
- Multiple GitLab instances (gitlab.com and self-hosted)
- Credentials stored securely in system keychain

### Performance
- SQLite caching for fast loading and offline access
- Virtualized rendering for large diffs
- Request deduplication and batching
- Auto-updates via GitHub releases

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Tauri 2.x](https://tauri.app/) |
| Frontend | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) + [TanStack Query](https://tanstack.com/query) |
| Diff Editor | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| Rich Text | [Tiptap](https://tiptap.dev/) |
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
git clone https://github.com/ronanversendaal/labrat.git
cd labrat

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

1. Open Settings (`Cmd/Ctrl+,`)
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
- **macOS**: `src-tauri/target/release/bundle/macos/LabRat.app`
- **Linux**: `src-tauri/target/release/bundle/appimage/labrat_*.AppImage`
- **Windows**: `src-tauri/target/release/bundle/msi/LabRat_*.msi`

## Project Structure

```
labrat/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── activity/       # Activity timeline
│   │   ├── ai/             # AI review panel
│   │   ├── comments/       # Comment threads & editor
│   │   ├── common/         # Reusable components (Button, Modal, etc.)
│   │   ├── layout/         # App layout (Sidebar, Header)
│   │   ├── mr-list/        # MR list view components
│   │   ├── mr-detail/      # MR detail view components
│   │   ├── my-mrs/         # My MRs view
│   │   ├── pipeline/       # Pipeline detail (stages, jobs, logs)
│   │   ├── pipelines/      # Pipelines browser view
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
| `/` | Focus search |
| `Shift+R` | Go to My Reviews |
| `Shift+M` | Go to My MRs |
| `Shift+P` | Go to Pipelines |
| `Cmd/Ctrl+,` | Open settings |
| `Cmd/Ctrl+R` | Refresh |

### MR List
| Shortcut | Action |
|----------|--------|
| `j` / `k` | Navigate down / up |
| `Enter` or `o` | Open selected MR |
| `g` | Toggle group & sort toolbar |

### File Navigation (diff view)
| Shortcut | Action |
|----------|--------|
| `j` / `k` | Next / previous file |
| `Enter` | Enter line navigation |
| `Cmd/Ctrl+P` or `t` | Quick file picker |
| `v` | Toggle file viewed |
| `n` / `p` | Scroll down / up |
| `Esc` | Close detail / go back |

### Line Navigation (inside diff)
| Shortcut | Action |
|----------|--------|
| `j` / `k` | Next / previous line |
| `c` | Add comment on current line |
| `s` | Suggest a change on current line |
| `Shift+A` | Approve merge request |
| `Esc` | Back to file navigation |

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
| macOS | `~/Library/Application Support/com.labrat.app/` |
| Linux | `~/.local/share/com.labrat.app/` |
| Windows | `%APPDATA%\com.labrat.app\` |

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
