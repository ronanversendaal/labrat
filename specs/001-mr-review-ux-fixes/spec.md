# Feature Specification: MR Review UX Fixes and Enhancements

**Feature Branch**: `001-mr-review-ux-fixes`
**Created**: 2026-02-01
**Status**: Draft
**Input**: User description: "Bug fixes and UX improvements for the MR review experience including file list views, MR actions, keyboard shortcuts, theme fixes, search-based filtering, and UI reorganization."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fix Dark Theme Readability (Priority: P1)

Users with dark theme enabled cannot read text because colors are incorrectly rendered as black on dark backgrounds. This is a critical usability bug that makes the application unusable for dark theme users.

**Why this priority**: Complete blocker for dark theme users - the application is essentially unusable without readable text.

**Independent Test**: Switch to dark theme and verify all text throughout the application is clearly visible with appropriate contrast.

**Acceptance Scenarios**:

1. **Given** the user has dark theme enabled, **When** they view any screen in the application, **Then** all text must have sufficient contrast against dark backgrounds (minimum 4.5:1 contrast ratio per WCAG AA).
2. **Given** the user toggles between light and dark themes, **When** viewing MR lists, details, diffs, and settings, **Then** text colors automatically adjust to maintain readability.
3. **Given** dark theme is active, **When** viewing code diffs, **Then** syntax highlighting colors must remain visible against the dark background.

---

### User Story 2 - Fix "Open in GitLab" Button (Priority: P2)

The "Open in GitLab" button does not function, preventing users from quickly navigating to the MR in their browser for actions not available in the app.

**Why this priority**: Core navigation feature that blocks users from completing their workflow when app features are insufficient.

**Independent Test**: Click the "Open in GitLab" button and verify the correct MR page opens in the default browser.

**Acceptance Scenarios**:

1. **Given** a user is viewing an MR detail, **When** they click "Open in GitLab", **Then** the system opens the MR's web URL in their default browser.
2. **Given** a user is viewing any MR, **When** they click "Open in GitLab", **Then** the URL matches the MR's actual GitLab web address.
3. **Given** an MR from a self-hosted GitLab instance, **When** the user clicks "Open in GitLab", **Then** the correct instance URL is used.

---

### User Story 3 - Fix False "MR Updated" Notifications (Priority: P3)

The application incorrectly shows "This merge request has been updated" messages when no actual updates have occurred, creating confusion and distrust in the notification system.

**Why this priority**: Impacts user trust and creates unnecessary interruptions, but doesn't block core functionality.

**Independent Test**: Open an MR that has not been modified and verify no false update notifications appear over a 5-minute period.

**Acceptance Scenarios**:

1. **Given** an MR that has not been modified, **When** a user views it for an extended period, **Then** no update notification is displayed.
2. **Given** an MR is genuinely updated by another user, **When** the change is detected, **Then** the update notification appears only once per actual update.
3. **Given** a user dismisses an update notification, **When** the same update is detected again, **Then** the notification does not reappear until a new update occurs.

---

### User Story 4 - Add MR Approval and Actions (Priority: P4)

Reviewers cannot approve MRs or perform other standard review actions (approve, request changes, merge) from within the application, forcing them to switch to GitLab web interface.

**Why this priority**: Essential workflow completion feature, but users can work around it via "Open in GitLab".

**Independent Test**: Complete a full review and approval workflow entirely within the application.

**Acceptance Scenarios**:

1. **Given** a user has permission to approve an MR, **When** they complete their review, **Then** they can approve the MR directly from the application.
2. **Given** a user approves an MR, **When** the action completes, **Then** the MR status updates to reflect the approval.
3. **Given** a user is viewing an MR they authored, **When** viewing available actions, **Then** the approve action is not available (cannot self-approve).
4. **Given** an MR requires multiple approvals, **When** a user approves, **Then** the approval count updates and remaining required approvals are shown.

---

### User Story 5 - File List View Mode Toggle (Priority: P5)

Users can only view changed files in a folder structure, but many prefer a flat list view. The list view should be the default, with preference persistence.

**Why this priority**: UX improvement that affects daily workflow efficiency but has a functional alternative.

**Independent Test**: Toggle between folder and list views, close and reopen the app, verify preference is preserved.

**Acceptance Scenarios**:

1. **Given** a user opens the file changes section, **When** viewing for the first time, **Then** files are displayed in a flat list (default).
2. **Given** a user is viewing files, **When** they toggle to folder view, **Then** files are organized by directory hierarchy.
3. **Given** a user changes the view mode preference, **When** they close and reopen the application, **Then** their preference is preserved.
4. **Given** a user switches view modes, **When** they open a different MR, **Then** the same view mode preference applies.

---

### User Story 6 - Mark File as Viewed Shortcut (Priority: P6)

Reviewers need keyboard shortcuts to quickly mark files as viewed/read during code review to track their progress through large MRs.

**Why this priority**: Productivity enhancement for power users, but marking can be done via other means.

**Independent Test**: Use keyboard shortcut to mark a file as viewed and verify visual indication updates.

**Acceptance Scenarios**:

1. **Given** a user is viewing a file in the diff view, **When** they press the "mark as viewed" shortcut (v), **Then** the file is marked as viewed with a visual indicator.
2. **Given** a file is marked as viewed, **When** the user presses the shortcut again, **Then** the viewed status is toggled off.
3. **Given** multiple files in an MR, **When** user marks files as viewed, **Then** the file tree shows which files have been reviewed.
4. **Given** a user has marked files as viewed, **When** they return to the MR later, **Then** their viewed status is preserved.

---

### User Story 7 - Search-Based Filtering (Priority: P7)

Replace checkbox-based filters with a search bar that suggests filter types and values, similar to GitLab's web interface for a more intuitive filtering experience.

**Why this priority**: UX enhancement that improves efficiency but existing filters are functional.

**Independent Test**: Type filter queries in the search bar and verify suggestions appear and filters apply correctly.

**Acceptance Scenarios**:

1. **Given** a user focuses on the search bar, **When** they start typing, **Then** the system suggests filter types (author:, project:, status:, label:, etc.).
2. **Given** a user types "author:", **When** suggestions appear, **Then** they show available author names from recent MRs.
3. **Given** a user enters "author:john status:draft", **When** the filter applies, **Then** only MRs by John in draft status are shown.
4. **Given** a user has applied search filters, **When** they clear the search bar, **Then** all filters are removed.
5. **Given** a user types free text without a filter prefix, **When** searching, **Then** it searches across MR titles and descriptions.

---

### User Story 8 - Merge Description into Changes Tab (Priority: P8)

Combine the Description tab with the Changes tab to provide a unified overview of the MR, reducing tab switching during reviews.

**Why this priority**: UX reorganization that improves workflow but both views are currently accessible.

**Independent Test**: View an MR and verify description appears alongside changes without needing to switch tabs.

**Acceptance Scenarios**:

1. **Given** a user opens an MR, **When** viewing the Changes tab, **Then** the MR description is visible in a collapsible section above the file list.
2. **Given** a long description, **When** viewing the Changes tab, **Then** the description can be collapsed to maximize diff viewing area.
3. **Given** the description is collapsed, **When** the user expands it, **Then** the full description renders including any markdown formatting.

---

### User Story 9 - Rename Discussions to Activity/History (Priority: P9)

The "Discussions" tab content is actually more of an activity history. Rename and potentially reorganize for clarity.

**Why this priority**: Minor labeling improvement with no functional impact.

**Independent Test**: Verify the tab is renamed and content accurately represents activity/history.

**Acceptance Scenarios**:

1. **Given** a user views an MR detail, **When** looking at the tabs, **Then** the former "Discussions" tab is labeled "Activity" or "History".
2. **Given** a user opens the Activity tab, **When** viewing content, **Then** all comments, status changes, and events are shown chronologically.

---

### Edge Cases

- What happens when a user tries to approve an MR they don't have permission to approve?
- How does the system handle marking files as viewed when the MR is updated (files changed)?
- What happens when search filter suggestions cannot load (network error)?
- How does the description collapse state persist when switching between MRs?
- What happens when dark theme detection conflicts with manual theme selection?

## Requirements *(mandatory)*

### Functional Requirements

**Theme & Display:**
- **FR-001**: System MUST apply appropriate text colors that contrast with dark theme backgrounds (minimum 4.5:1 ratio).
- **FR-002**: System MUST preserve readable syntax highlighting in diff views for both light and dark themes.

**Navigation:**
- **FR-003**: System MUST open the correct GitLab web URL when "Open in GitLab" is clicked.
- **FR-004**: System MUST use the configured GitLab instance URL (not hardcoded gitlab.com).

**Notifications:**
- **FR-005**: System MUST only display "MR updated" notifications when actual changes are detected.
- **FR-006**: System MUST track notification dismissal to prevent duplicate notifications for the same update.

**MR Actions:**
- **FR-007**: Users MUST be able to approve MRs directly from the application.
- **FR-008**: System MUST enforce GitLab's approval rules (cannot self-approve, required approvals count).
- **FR-009**: System MUST update MR status immediately after approval action completes.

**File View:**
- **FR-010**: System MUST support both flat list and folder hierarchy views for changed files.
- **FR-011**: System MUST default to flat list view for new users.
- **FR-012**: System MUST persist file view preference across sessions.

**Keyboard Shortcuts:**
- **FR-013**: Users MUST be able to mark files as viewed using keyboard shortcut (v key).
- **FR-014**: System MUST display visual indicator for files marked as viewed.
- **FR-015**: System MUST persist "viewed" status for files within a session.

**Search & Filtering:**
- **FR-016**: System MUST provide search bar with filter type suggestions.
- **FR-017**: System MUST support filter syntax: author:, project:, status:, label:.
- **FR-018**: System MUST provide autocomplete suggestions for filter values.
- **FR-019**: System MUST support free-text search across MR titles and descriptions.

**UI Layout:**
- **FR-020**: System MUST display MR description in a collapsible section within the Changes view.
- **FR-021**: System MUST rename "Discussions" tab to "Activity" with chronological event display.

### Key Entities

- **File View Preference**: User setting for flat list vs folder hierarchy view (persisted).
- **File Viewed Status**: Per-file, per-MR tracking of reviewed files (session-scoped, optionally persisted).
- **MR Approval State**: Current approval status including count, required approvals, and approvers.
- **Search Filter**: Parsed filter type and value pairs from search input.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of text elements maintain WCAG AA contrast ratio (4.5:1) in dark theme.
- **SC-002**: "Open in GitLab" button successfully opens correct URL in 100% of attempts.
- **SC-003**: Zero false "MR updated" notifications occur during 30-minute review sessions with unchanged MRs.
- **SC-004**: Users can complete MR approval in under 5 seconds from the application.
- **SC-005**: File view preference persists correctly across 100% of application restarts.
- **SC-006**: Search filter suggestions appear within 200ms of user typing.
- **SC-007**: Keyboard shortcut for marking files as viewed responds within 100ms.
- **SC-008**: Users can access MR description without tab switching in the Changes view.

## Assumptions

- The GitLab API supports all required approval actions via the existing token permissions.
- File "viewed" status can be stored locally without syncing to GitLab (session/local preference).
- Search filter syntax follows GitLab's established patterns for consistency.
- Dark theme detection uses system preferences as the primary source.
- The existing description rendering logic can be reused in the Changes tab layout.
