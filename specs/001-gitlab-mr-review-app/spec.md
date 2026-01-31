# Feature Specification: GitLab MR Review App

**Feature Branch**: `001-gitlab-mr-review-app`
**Created**: 2026-01-31
**Status**: Draft
**Input**: User description: "Build an app that can connect to GitLab and allow me to locally review merge requests. I should be able to use common filters and provide a nice overview page of open merge requests I have to review, which project it is, what impediments the MR has, and who the author is. Essentially what the Web UI has. Furthermore this app should also include the creation of improvements or suggestions to a MR made by AI through reading the diff once a MR has been opened in the app. If I agree to an improvement, I should add a suggestion or comment to the MR."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View My Pending Reviews (Priority: P1)

As a developer, I want to see all merge requests assigned to me for review in a single overview so that I can prioritize my code review workload without navigating through multiple GitLab projects.

**Why this priority**: This is the core value proposition—without the ability to see pending MRs, the app has no purpose. This delivers immediate value by consolidating review tasks.

**Independent Test**: Can be fully tested by connecting to GitLab and displaying a list of assigned MRs. Delivers value as a standalone MR dashboard.

**Acceptance Scenarios**:

1. **Given** I have authenticated with GitLab, **When** I open the app, **Then** I see a list of all merge requests where I am assigned as a reviewer
2. **Given** I am viewing the MR list, **When** I look at any MR entry, **Then** I can see the project name, MR title, author name, and author avatar
3. **Given** I am viewing the MR list, **When** an MR has impediments (merge conflicts, failing pipelines, unresolved threads, draft status), **Then** I see clear visual indicators for each impediment type
4. **Given** I have MRs across multiple projects, **When** I view the list, **Then** MRs are grouped or sortable by project

---

### User Story 2 - Filter and Search MRs (Priority: P2)

As a developer, I want to filter and search through my merge requests so that I can quickly find specific MRs or focus on a subset of my review queue.

**Why this priority**: Filtering becomes essential once the user has multiple MRs to manage, but the core view (P1) must work first.

**Independent Test**: Can be tested by applying filters and verifying the list updates correctly. Delivers value by reducing cognitive load when managing many MRs.

**Acceptance Scenarios**:

1. **Given** I am viewing my MR list, **When** I filter by project, **Then** only MRs from that project are displayed
2. **Given** I am viewing my MR list, **When** I filter by author, **Then** only MRs by that author are displayed
3. **Given** I am viewing my MR list, **When** I filter by impediment status (e.g., "has conflicts", "pipeline failed"), **Then** only MRs matching that status are displayed
4. **Given** I am viewing my MR list, **When** I search by MR title or description keywords, **Then** matching MRs are displayed
5. **Given** I have applied filters, **When** I want to see all MRs again, **Then** I can clear all filters with one action

---

### User Story 3 - View MR Details and Diff (Priority: P3)

As a developer, I want to open a merge request and see its full details including the code diff so that I can understand what changes are being proposed.

**Why this priority**: Viewing details is necessary before AI suggestions (P4) can be useful, but the overview (P1) and filtering (P2) provide value independently.

**Independent Test**: Can be tested by opening any MR and verifying all details and diff content are displayed correctly.

**Acceptance Scenarios**:

1. **Given** I am viewing the MR list, **When** I select an MR, **Then** I see the full MR description, labels, milestone, and linked issues
2. **Given** I have opened an MR, **When** I view the changes tab, **Then** I see the complete diff with syntax highlighting
3. **Given** I am viewing a diff, **When** I look at changed files, **Then** I can expand/collapse files and navigate between them
4. **Given** I am viewing a diff, **When** a file has many changes, **Then** I can see line numbers and easily identify additions, deletions, and modifications
5. **Given** I have opened an MR, **When** I want to view it in GitLab, **Then** I can open the MR in my browser with one click

---

### User Story 4 - AI-Powered Code Suggestions (Priority: P4)

As a developer, I want the app to analyze the MR diff and suggest improvements so that I can provide higher-quality code reviews faster.

**Why this priority**: This is a differentiating feature but depends on being able to view MRs (P3) first. It adds significant value but is not essential for basic functionality.

**Independent Test**: Can be tested by opening an MR with code changes and verifying AI suggestions appear with actionable recommendations.

**Acceptance Scenarios**:

1. **Given** I have opened an MR with code changes, **When** I request AI analysis, **Then** the app analyzes the diff and displays improvement suggestions
2. **Given** AI has generated suggestions, **When** I view a suggestion, **Then** I see the specific code location, the issue identified, and the recommended improvement
3. **Given** I am viewing AI suggestions, **When** a suggestion relates to code quality, bugs, or best practices, **Then** the suggestion includes a clear explanation of why the change is recommended
4. **Given** I am viewing AI suggestions, **When** I disagree with a suggestion, **Then** I can dismiss it without taking action

---

### User Story 5 - Keyboard-Driven Navigation (Priority: P5)

As a developer, I want to navigate the app entirely using keyboard shortcuts that match GitLab conventions so that I can review code efficiently and leverage my existing muscle memory.

**Why this priority**: Keyboard navigation dramatically improves review speed for power users but requires core features (viewing, filtering, details) to be in place first.

**Independent Test**: Can be tested by navigating through all app features using only the keyboard and verifying shortcuts match GitLab conventions.

**Acceptance Scenarios**:

**Global Shortcuts:**
1. **Given** I am anywhere in the app, **When** I press `?`, **Then** a help dialog appears listing all available keyboard shortcuts
2. **Given** I am anywhere in the app, **When** I press `s` or `/`, **Then** the search input receives focus
3. **Given** I am anywhere in the app, **When** I press `f`, **Then** the filter bar receives focus
4. **Given** I am anywhere in the app, **When** I press `Shift + m`, **Then** I navigate to my merge requests view
5. **Given** I am anywhere in the app, **When** I press `Shift + r`, **Then** I navigate to my review requests view
6. **Given** I am anywhere in the app, **When** I press `Esc`, **Then** any open tooltips, popovers, or dialogs are closed
7. **Given** I am anywhere in the app, **When** I press `⌘ + \`, **Then** the navigation sidebar toggles visibility

**Editing Shortcuts:**
8. **Given** I am editing text, **When** I press `⌘ + b`, **Then** the selected text is wrapped in bold markdown
9. **Given** I am editing text, **When** I press `⌘ + i`, **Then** the selected text is wrapped in italic markdown
10. **Given** I am editing text, **When** I press `⌘ + Shift + x`, **Then** the selected text is wrapped in strikethrough markdown
11. **Given** I am editing text, **When** I press `⌘ + k`, **Then** a link is inserted for the selected text
12. **Given** I am editing text, **When** I press `⌘ + Shift + p`, **Then** the markdown preview toggles
13. **Given** I am in an empty comment textarea, **When** I press `↑`, **Then** my most recent comment in the thread becomes editable
14. **Given** I am editing, **When** I press `⌘ + Enter`, **Then** the changes are submitted/saved

**Merge Request Diff Navigation:**
15. **Given** I am viewing a diff, **When** I press `]` or `j`, **Then** I navigate to the next file in the diff
16. **Given** I am viewing a diff, **When** I press `[` or `k`, **Then** I navigate to the previous file in the diff
17. **Given** I am viewing an MR, **When** I press `⌘ + p` or `t`, **Then** a quick file picker opens to jump to a specific file
18. **Given** I am viewing an MR with threads, **When** I press `n`, **Then** I navigate to the next open discussion thread
19. **Given** I am viewing an MR with threads, **When** I press `p`, **Then** I navigate to the previous open discussion thread
20. **Given** I am viewing an MR, **When** I press `b`, **Then** the source branch name is copied to my clipboard
21. **Given** I am viewing a diff, **When** I press `f`, **Then** the file browser receives focus
22. **Given** I am viewing a diff, **When** I press `Shift + f`, **Then** the file browser toggles visibility
23. **Given** I am viewing a file in the diff, **When** I press `v`, **Then** the file is marked as "Viewed by me"

**Review & Comment Shortcuts:**
24. **Given** I am composing a comment, **When** I press `⌘ + Enter`, **Then** my comment is added to my review draft
25. **Given** I am composing a comment, **When** I press `Shift + ⌘ + Enter`, **Then** my comment is published immediately
26. **Given** I have text selected in the diff, **When** I press `r`, **Then** a reply is started quoting the selected text

**Commit Navigation:**
27. **Given** I am viewing MR commits, **When** I press `c`, **Then** I navigate to the next commit
28. **Given** I am viewing MR commits, **When** I press `x`, **Then** I navigate to the previous commit

**Issue & MR Context Shortcuts:**
29. **Given** I am viewing an MR, **When** I press `e`, **Then** I can edit the description
30. **Given** I am viewing an MR, **When** I press `l`, **Then** the label picker opens
31. **Given** I am viewing an MR, **When** I press `a`, **Then** the assignee picker opens
32. **Given** I am viewing an MR, **When** I press `m`, **Then** the milestone picker opens
33. **Given** I am viewing an MR, **When** I press `c` then `r`, **Then** the MR reference is copied to clipboard

**File Browser Shortcuts:**
34. **Given** I am in the file browser, **When** I press `↑`, **Then** the selection moves up
35. **Given** I am in the file browser, **When** I press `↓`, **Then** the selection moves down
36. **Given** I am in the file browser, **When** I press `Enter`, **Then** the selected file opens
37. **Given** I am searching in file browser, **When** I press `Esc`, **Then** I return to the previous view
38. **Given** I am viewing a file, **When** I press `y`, **Then** the file permalink is copied

---

### User Story 6 - Configure Application Settings (Priority: P6)

As a developer, I want to configure all application settings in one place so that I can customize the app to my workflow, manage credentials securely, and control AI behavior.

**Why this priority**: Configuration is essential for first-time setup and ongoing customization, but the core review features must exist first.

**Independent Test**: Can be tested by opening settings, modifying each configurable option, and verifying changes persist and take effect.

**Acceptance Scenarios**:

**GitLab Configuration:**
1. **Given** I am setting up the app for the first time, **When** I open settings, **Then** I can enter my GitLab instance URL (gitlab.com or self-hosted)
2. **Given** I need to authenticate, **When** I enter my GitLab personal access token, **Then** the app validates and stores it securely
3. **Given** I have multiple GitLab accounts, **When** I want to switch accounts, **Then** I can add and manage multiple GitLab connections
4. **Given** my token has expired, **When** the app detects an authentication failure, **Then** I am prompted to update my credentials

**AI Provider Configuration:**
5. **Given** I want to use the Claude CLI, **When** I configure AI settings, **Then** I can set `claude` CLI as my AI backend
6. **Given** I want to use direct API access, **When** I configure AI settings, **Then** I can enter API keys for Anthropic, OpenAI, or other providers
7. **Given** I have multiple AI providers configured, **When** I open AI settings, **Then** I can select which provider to use as default
8. **Given** I want to change AI models, **When** I configure an API-based provider, **Then** I can select from available models for that provider

**AI Behavior Settings:**
9. **Given** I don't want automatic AI suggestions, **When** I toggle the "Auto-analyze MRs" setting off, **Then** AI analysis only runs when I explicitly request it
10. **Given** AI is set to manual mode, **When** I open an MR, **Then** I see a button to trigger AI analysis on demand
11. **Given** I want automatic AI suggestions, **When** I toggle "Auto-analyze MRs" on, **Then** AI analysis runs automatically when I open an MR

**General Settings:**
12. **Given** I want to change refresh intervals, **When** I adjust the "MR list refresh interval" setting, **Then** the app refreshes at my specified interval
13. **Given** I have configured settings, **When** I close and reopen the app, **Then** all my settings are preserved
14. **Given** I want to reset settings, **When** I choose "Reset to defaults", **Then** all settings return to their default values (with confirmation)

---

### User Story 7 - Post AI Suggestions to GitLab (Priority: P7)

As a developer, I want to post AI-generated suggestions as comments or code suggestions on the MR so that the author can see my feedback directly in GitLab.

**Why this priority**: This completes the review workflow by allowing action on AI suggestions, but requires AI suggestions (P4) to be working first.

**Independent Test**: Can be tested by accepting an AI suggestion and verifying it appears as a comment/suggestion on the MR in GitLab.

**Acceptance Scenarios**:

1. **Given** I am viewing an AI suggestion I agree with, **When** I choose to post it, **Then** I can add it as a comment on the specific line in GitLab
2. **Given** I am posting an AI suggestion, **When** the suggestion includes a code change, **Then** I can post it as a GitLab "suggestion" that the author can apply directly
3. **Given** I want to modify the AI suggestion, **When** I edit the suggestion text before posting, **Then** my edited version is posted to GitLab
4. **Given** I have posted a suggestion, **When** I view the MR in GitLab, **Then** my comment/suggestion appears on the correct line with my GitLab identity as the author
5. **Given** I am posting suggestions, **When** I want to add my own context, **Then** I can include additional comments alongside the AI suggestion

---

### Edge Cases

- What happens when GitLab authentication token expires or is invalid?
- How does the system handle MRs with extremely large diffs (thousands of changed lines)?
- What happens when the user has no MRs assigned for review?
- How does the system behave when GitLab is unreachable or slow to respond?
- What happens when an MR is updated/closed while the user is viewing it?
- How does the system handle MRs in projects the user no longer has access to?
- What happens when AI analysis fails or times out?
- How does the system handle posting a suggestion when the MR has been merged/closed?
- What happens when the `claude` CLI is not installed or not in PATH?
- What happens when an AI API key is invalid or rate-limited?
- How does the system handle switching between GitLab accounts mid-session?
- What happens when settings file is corrupted or inaccessible?
- How does the system behave when secure credential storage is unavailable?
- How does the system handle extremely large diffs (10,000+ changed lines) without freezing?
- What happens when the local cache becomes too large?
- How does the system prioritize which MRs to prefetch when bandwidth is limited?
- What happens when the user's disk is full and caching fails?
- How does the system handle slow network connections gracefully?

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Connection**
- **FR-001**: System MUST allow users to authenticate with GitLab using a personal access token
- **FR-002**: System MUST securely store authentication credentials locally
- **FR-003**: System MUST support connecting to GitLab.com and self-hosted GitLab instances
- **FR-004**: System MUST validate the authentication token and display connection status

**MR List & Overview**
- **FR-005**: System MUST fetch and display all merge requests where the user is assigned as a reviewer
- **FR-006**: System MUST display for each MR: title, project name, author name, author avatar, and creation date
- **FR-007**: System MUST display impediment indicators for: merge conflicts, failing CI pipeline, unresolved discussion threads, and draft status
- **FR-008**: System MUST allow sorting MRs by date, project, or author
- **FR-009**: System MUST automatically refresh the MR list periodically (configurable interval, default 5 minutes)

**Filtering & Search**
- **FR-010**: System MUST allow filtering MRs by project
- **FR-011**: System MUST allow filtering MRs by author
- **FR-012**: System MUST allow filtering MRs by impediment type
- **FR-013**: System MUST allow filtering MRs by labels
- **FR-014**: System MUST allow text search across MR titles and descriptions
- **FR-015**: System MUST allow combining multiple filters
- **FR-016**: System MUST persist filter preferences across sessions

**MR Detail View**
- **FR-017**: System MUST display full MR description, labels, milestone, and linked issues
- **FR-018**: System MUST display the complete diff with syntax highlighting for common languages
- **FR-019**: System MUST allow expanding/collapsing individual files in the diff
- **FR-020**: System MUST display line numbers and clearly indicate additions, deletions, and modifications
- **FR-021**: System MUST provide a link to open the MR in the GitLab web interface

**AI Code Analysis**
- **FR-022**: System MUST analyze MR diffs and generate improvement suggestions
- **FR-023**: System MUST categorize suggestions (e.g., code quality, potential bugs, best practices, performance)
- **FR-024**: System MUST show the specific code location for each suggestion
- **FR-025**: System MUST explain the reasoning behind each suggestion
- **FR-026**: System MUST allow users to dismiss suggestions they disagree with
- **FR-042**: System MUST support invoking the `claude` CLI as the primary AI backend (leveraging user's Max subscription)
- **FR-043**: System MUST support configuring alternative AI providers via direct API keys (Anthropic API, OpenAI, etc.)
- **FR-044**: System MUST allow users to select and switch between configured AI backends

**Posting to GitLab**
- **FR-027**: System MUST allow posting suggestions as line comments on the MR
- **FR-028**: System MUST allow posting suggestions as GitLab code suggestions (apply-able by author)
- **FR-029**: System MUST allow editing suggestion text before posting
- **FR-030**: System MUST allow adding additional context to posted suggestions
- **FR-031**: System MUST confirm successful posting and display the posted comment

**Keyboard Navigation**
- **FR-032**: System MUST support all keyboard shortcuts matching GitLab's conventions for merge request review
- **FR-033**: System MUST display a keyboard shortcut help dialog when user presses `?`
- **FR-034**: System MUST support global navigation shortcuts (`s`/`/` for search, `f` for filter, `Esc` to close dialogs)
- **FR-035**: System MUST support diff navigation shortcuts (`]`/`j` next file, `[`/`k` previous file, `n`/`p` for threads)
- **FR-036**: System MUST support editing shortcuts (`⌘+b` bold, `⌘+i` italic, `⌘+k` link, `⌘+Shift+p` preview)
- **FR-037**: System MUST support review shortcuts (`⌘+Enter` add to review, `Shift+⌘+Enter` publish immediately)
- **FR-038**: System MUST support commit navigation shortcuts (`c` next commit, `x` previous commit)
- **FR-039**: System MUST support file browser shortcuts (arrow keys for navigation, `Enter` to open, `y` for permalink)
- **FR-040**: System MUST support context shortcuts (`e` edit, `l` labels, `a` assignee, `m` milestone, `b` copy branch)
- **FR-041**: System MUST allow all core workflows to be completed without using a mouse
- **FR-045**: System MUST support platform-appropriate modifier keys (⌘ on macOS, Ctrl on Windows/Linux) for all keyboard shortcuts

**Settings & Configuration**
- **FR-046**: System MUST provide a dedicated settings interface accessible from the main menu
- **FR-047**: System MUST allow configuring GitLab instance URL (gitlab.com or custom self-hosted URL)
- **FR-048**: System MUST allow entering and updating GitLab personal access tokens
- **FR-049**: System MUST securely store all credentials using the operating system's secure credential storage
- **FR-050**: System MUST support managing multiple GitLab connections/accounts
- **FR-051**: System MUST validate GitLab credentials on entry and display connection status
- **FR-052**: System MUST allow configuring the `claude` CLI path as an AI backend
- **FR-053**: System MUST allow entering API keys for direct AI provider access (Anthropic, OpenAI, etc.)
- **FR-054**: System MUST allow selecting which configured AI provider/model to use as default
- **FR-055**: System MUST provide a toggle to enable/disable automatic AI analysis when opening MRs
- **FR-056**: System MUST provide manual "Analyze with AI" action when auto-analysis is disabled
- **FR-057**: System MUST allow configuring the MR list refresh interval (with sensible min/max bounds)
- **FR-058**: System MUST persist all settings across application restarts
- **FR-059**: System MUST provide "Reset to defaults" functionality with user confirmation
- **FR-060**: System MUST display clear status indicators for each configured service (connected/disconnected/error)

**Performance & Efficiency**
- **FR-061**: System MUST load the MR list and display results within 2 seconds of app launch (after initial authentication)
- **FR-062**: System MUST begin displaying diff content within 1 second of selecting an MR (progressive loading for large diffs)
- **FR-063**: System MUST use progressive/incremental loading for large diffs, showing initial content immediately while loading remainder
- **FR-064**: System MUST cache MR metadata and diffs locally to enable instant re-access without re-fetching
- **FR-065**: System MUST prefetch diff data for MRs visible in the list to minimize wait time when opening
- **FR-066**: System MUST provide visual feedback (loading indicators) for any operation taking more than 200ms
- **FR-067**: System MUST allow users to interact with already-loaded content while additional content loads in background
- **FR-068**: System MUST prioritize rendering visible content before off-screen content in large diffs
- **FR-069**: System MUST maintain smooth scrolling (60fps) when navigating large diffs
- **FR-070**: System MUST cancel in-flight requests when user navigates away to avoid wasted resources
- **FR-071**: System MUST batch network requests where possible to minimize round-trips to GitLab
- **FR-072**: System MUST support offline viewing of previously cached MRs and diffs

### Non-Functional Requirements

**Performance Targets**
- The app MUST feel responsive at all times—no operation should block the UI
- Navigation between views MUST feel instant (<100ms perceived latency)
- Diff rendering MUST begin within 1 second, with full content available within 3 seconds for MRs up to 1000 changed lines
- Filter and search operations MUST return results within 200ms for cached data
- The app MUST handle MRs with up to 5000 changed lines without degradation in scrolling performance
- Memory usage MUST remain stable during extended use (no memory leaks)

**Caching Strategy**
- MR list data MUST be cached and refreshed in background to provide instant display on app open
- Diff content MUST be cached after first view to enable instant re-access
- Cache MUST be invalidated intelligently when MRs are updated (based on last-updated timestamp)
- Users MUST be able to force-refresh cached data when needed

**User Experience During Loading**
- Skeleton/placeholder UI MUST be shown while content loads (no blank screens)
- Partial content MUST be interactive while remaining content loads
- Progress indicators MUST be shown for operations expected to take more than 1 second
- Users MUST never be blocked from navigating away from a loading view

### Key Entities

- **Merge Request**: Represents a GitLab MR with its metadata (title, description, author, project, status, labels, milestone), associated diff, and impediment states
- **Project**: A GitLab project/repository that contains merge requests, identified by path and namespace
- **Author**: The user who created the MR, with display name and avatar
- **Impediment**: A blocking condition on an MR (conflict, pipeline failure, unresolved thread, draft status)
- **Diff**: The set of file changes in an MR, containing file paths, line changes, and change types
- **AI Suggestion**: A recommendation generated from diff analysis, containing location, issue description, recommended change, and category
- **Review Comment**: A comment or suggestion to be posted to GitLab, with content, line reference, and type (comment vs. suggestion)
- **AI Provider**: A configured backend for code analysis; either the `claude` CLI (default) or a direct API connection with credentials
- **Settings**: User configuration including GitLab connections, AI provider settings, auto-analysis toggle, refresh intervals, and UI preferences
- **GitLab Connection**: A configured GitLab instance with URL and authentication credentials, supporting multiple accounts
- **Cache**: Local storage of MR metadata, diffs, and user data for instant access and offline viewing; invalidated based on last-updated timestamps

## Clarifications

### Session 2026-01-31

- Q: What type of application should this be (native desktop GUI, terminal UI, or CLI)? → A: Native desktop app (GUI with windows, menus, mouse support)
- Q: How should AI analysis be provided? → A: Pluggable AI backends; primary option is invoking `claude` CLI (uses Max subscription), with fallback to direct API keys for Claude/Anthropic or other providers
- Q: Which platforms should be supported? → A: macOS, Windows, and Linux (cross-platform)

## Assumptions

- Users have a valid GitLab account with appropriate permissions to view MRs and post comments
- Users will use the `claude` CLI (leveraging their Max subscription) as the primary AI backend, or provide their own API credentials for alternative providers
- The app will run as a native desktop application with a graphical user interface (GUI), supporting both keyboard shortcuts and mouse interaction
- GitLab API rate limits are sufficient for typical usage patterns
- Users prefer a keyboard-navigable interface for efficient code review workflows
- Performance and responsiveness are critical—the app must feel faster than the GitLab web interface
- Users have sufficient local disk space for caching (typical: 100MB-1GB depending on MR volume)
- Network latency to GitLab varies; the app must remain responsive regardless of network conditions

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view all their pending MR reviews within 5 seconds of app launch
- **SC-002**: Users can identify MRs with blockers (conflicts, failures) at a glance without clicking into details
- **SC-003**: Users can filter to a specific project's MRs within 2 interactions (clicks/keypresses)
- **SC-004**: Users can read and navigate a diff as efficiently as in the GitLab web interface
- **SC-005**: AI suggestions are generated within 30 seconds for MRs with up to 500 changed lines
- **SC-006**: Users can post an accepted AI suggestion to GitLab within 3 interactions
- **SC-007**: 80% of AI suggestions are relevant and actionable (user does not immediately dismiss)
- **SC-008**: Users complete their daily MR review workflow faster than using GitLab web interface alone
- **SC-009**: Users familiar with GitLab keyboard shortcuts can navigate the app without learning new keybindings
- **SC-010**: Users can complete an entire MR review (view, navigate diff, add comments, submit) using only the keyboard
- **SC-011**: Users can complete initial setup (GitLab connection + AI configuration) within 5 minutes
- **SC-012**: Users can toggle AI auto-analysis on/off within 2 interactions
- **SC-013**: All settings changes take effect immediately without requiring app restart

**Performance & Responsiveness**
- **SC-014**: Users see the MR list within 2 seconds of launching the app (with cached data: instant)
- **SC-015**: Users see diff content begin rendering within 1 second of selecting an MR
- **SC-016**: Users can scroll through large diffs (1000+ lines) without any perceivable lag or stutter
- **SC-017**: Users can navigate between views with no perceptible delay (<100ms)
- **SC-018**: Users can continue working with loaded content while background operations complete
- **SC-019**: Users can re-open a previously viewed MR instantly (from cache)
- **SC-020**: Users never see a frozen or unresponsive UI during any operation
- **SC-021**: Users can view previously cached MRs when offline
