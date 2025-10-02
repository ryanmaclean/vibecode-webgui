# E2E Test Plan - Critical User Journeys

**Status:** Draft
**Version:** 1.0
**Created:** 2025-10-01
**Issue:** #449

## Executive Summary

This document outlines a comprehensive end-to-end testing strategy for VibeCode WebGUI, covering 30+ critical user journeys across authentication, workspace management, AI features, code editing, terminal operations, and collaboration scenarios. The implementation is structured as a 6-week phased rollout with an estimated effort of 15-20 days.

### Current State
- **Existing E2E Tests:** 10 test files
- **Coverage:** Basic authentication, AI features, workspace management, accessibility
- **Framework:** Playwright 1.54.2 (configured for cross-browser testing)
- **CI Integration:** Configured but limited coverage

### Target State
- **E2E Test Scenarios:** 30+ comprehensive scenarios
- **Coverage:** All critical user paths including edge cases
- **Visual Regression:** Baseline established for key UI states
- **Accessibility:** WCAG 2.1 AA compliance validation
- **Performance:** Response time and rendering benchmarks

---

## Test Framework Architecture

### Technology Stack
- **Test Runner:** Playwright 1.54.2
- **Browsers:** Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Accessibility:** @axe-core/playwright 4.10.2
- **Visual Testing:** Playwright screenshot comparison
- **Reporting:** HTML, JSON, JUnit XML formats

### Test Organization
```
tests/e2e/
├── auth/                    # Authentication & Authorization
├── workspace/              # Workspace Management
├── ai/                     # AI Chat & Code Generation
├── editor/                 # Code Editor Features
├── terminal/               # Terminal Sessions
├── collaboration/          # Multi-user Scenarios
├── settings/               # User Preferences
├── fixtures/               # Test Data & Utilities
├── helpers/                # Shared Test Helpers
└── utils/                  # Common Utilities
```

### Configuration
- **Base URL:** http://localhost:3000 (dev), production URL (CI)
- **Timeouts:** 30s default, 60s for AI operations
- **Retries:** 2 retries on CI, 0 locally
- **Parallelization:** Full parallel locally, sequential on CI
- **Screenshots:** On failure
- **Videos:** Retain on failure
- **Traces:** On first retry

---

## Phase 1: Authentication & Onboarding (Week 1-2)

**Estimated Effort:** 4 days
**Priority:** Critical

### 1.1 User Registration Flow (5 scenarios)

#### Scenario 1: Successful Registration
**Test ID:** `AUTH-REG-001`
**Description:** New user creates account with valid credentials

**User Actions:**
1. Navigate to `/auth/register`
2. Fill email field with `newuser@example.com`
3. Fill password field with valid password (min 8 chars, uppercase, number, special)
4. Fill confirm password field with matching password
5. Accept terms and conditions checkbox
6. Click "Register" button

**Expected Outcomes:**
- Registration form validates input
- Account created in database
- User redirected to `/auth/verify-email` or onboarding
- Welcome email sent (async)

**Assertions:**
```typescript
await expect(page.locator('[type="email"]')).toBeVisible();
await expect(page.locator('[type="password"]')).toBeVisible();
await expect(page).toHaveURL(/verify-email|onboarding/);
await expect(page.locator('.success-message')).toContainText(/account created|welcome/i);
```

#### Scenario 2: Registration Validation
**Test ID:** `AUTH-REG-002`
**Description:** Form validates invalid inputs and provides clear error messages

**User Actions:**
1. Navigate to `/auth/register`
2. Submit form with empty fields
3. Submit form with invalid email format
4. Submit form with weak password
5. Submit form with mismatched passwords
6. Submit form with existing email

**Expected Outcomes:**
- Inline validation errors displayed
- Form submission blocked until valid
- Error messages are accessible (ARIA labels)
- Password strength indicator updates

**Assertions:**
```typescript
await expect(page.locator('.error-message, [role="alert"]')).toBeVisible();
await expect(page.locator('[aria-invalid="true"]')).toHaveCount(1);
await expect(submitButton).toBeDisabled();
```

#### Scenario 3: Email Verification Flow
**Test ID:** `AUTH-REG-003`
**Description:** User completes email verification process

**User Actions:**
1. Register new account
2. Click verification link from test email inbox
3. Verify email confirmation page

**Expected Outcomes:**
- Verification token validated
- Account status updated to verified
- User redirected to login or dashboard
- Confirmation message displayed

#### Scenario 4: Onboarding Experience
**Test ID:** `AUTH-REG-004`
**Description:** New user completes first-time onboarding

**User Actions:**
1. Complete registration
2. View welcome tour/tutorial (if implemented)
3. Set initial preferences (theme, editor settings)
4. Create first workspace

**Expected Outcomes:**
- Onboarding steps displayed progressively
- User preferences saved
- Skip option available
- Completion tracked

#### Scenario 5: Registration Rate Limiting
**Test ID:** `AUTH-REG-005`
**Description:** System prevents registration abuse

**User Actions:**
1. Attempt multiple registrations from same IP
2. Verify rate limiting triggers

**Expected Outcomes:**
- Rate limit error after threshold (e.g., 5 attempts/hour)
- Clear error message with retry timing
- CAPTCHA challenge presented (if implemented)

### 1.2 User Login Flow (5 scenarios)

#### Scenario 1: Successful Login
**Test ID:** `AUTH-LOGIN-001`
**Description:** Existing user logs in with valid credentials

**User Actions:**
1. Navigate to `/auth/login`
2. Fill email field with `test@vibecode.com`
3. Fill password field with correct password
4. Click "Login" button

**Expected Outcomes:**
- Authentication successful
- Session cookie set
- User redirected to dashboard (`/`)
- User profile menu visible

**Assertions:**
```typescript
await expect(page).toHaveURL('/');
await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
await expect(page.context().cookies()).toContainEqual(
  expect.objectContaining({ name: 'session' })
);
```

#### Scenario 2: Invalid Credentials
**Test ID:** `AUTH-LOGIN-002`
**Description:** Login fails with incorrect credentials

**User Actions:**
1. Navigate to `/auth/login`
2. Enter invalid email/password combination
3. Submit form

**Expected Outcomes:**
- Authentication fails
- Generic error message (no user enumeration)
- User remains on login page
- Failed attempt logged

#### Scenario 3: Session Persistence
**Test ID:** `AUTH-LOGIN-003`
**Description:** User session persists across browser refreshes

**User Actions:**
1. Login successfully
2. Refresh page
3. Navigate to different routes
4. Close and reopen browser

**Expected Outcomes:**
- User remains authenticated after refresh
- Session cookie valid (httpOnly, secure, sameSite)
- User state maintained
- No re-login required

#### Scenario 4: OAuth Provider Login
**Test ID:** `AUTH-LOGIN-004`
**Description:** User logs in via OAuth provider (GitHub, Google)

**User Actions:**
1. Click "Login with GitHub" button
2. Authorize application on provider
3. Return to application

**Expected Outcomes:**
- OAuth flow completes
- User account linked to provider
- Profile populated with provider data
- User redirected to dashboard

#### Scenario 5: Two-Factor Authentication
**Test ID:** `AUTH-LOGIN-005`
**Description:** User completes 2FA challenge

**User Actions:**
1. Login with username/password
2. Enter TOTP code from authenticator app
3. Verify backup codes option

**Expected Outcomes:**
- 2FA prompt displayed after password
- Valid code grants access
- Invalid code shows error with retry
- Backup codes accepted

### 1.3 Session Management (5 scenarios)

#### Scenario 1: Logout Flow
**Test ID:** `AUTH-SESSION-001`
**Description:** User logs out and session is terminated

**User Actions:**
1. Login successfully
2. Click user profile menu
3. Click "Logout" button
4. Confirm logout

**Expected Outcomes:**
- Session cookie cleared
- User redirected to login page
- Protected routes inaccessible
- Logout event logged

#### Scenario 2: Session Timeout
**Test ID:** `AUTH-SESSION-002`
**Description:** Inactive session expires and requires re-authentication

**User Actions:**
1. Login successfully
2. Remain inactive for session timeout period
3. Attempt to perform action

**Expected Outcomes:**
- Session timeout warning displayed
- User redirected to login after timeout
- Session state cleared
- Re-login required

#### Scenario 3: Concurrent Sessions
**Test ID:** `AUTH-SESSION-003`
**Description:** User can maintain multiple active sessions

**User Actions:**
1. Login from browser A
2. Login from browser B
3. Verify both sessions active
4. Logout from browser A
5. Verify browser B session unaffected

**Expected Outcomes:**
- Multiple sessions supported
- Session isolation maintained
- Logout affects only specific session

#### Scenario 4: Password Reset Flow
**Test ID:** `AUTH-SESSION-004`
**Description:** User resets forgotten password

**User Actions:**
1. Click "Forgot Password" link
2. Enter email address
3. Click reset link from email
4. Enter new password
5. Confirm password change

**Expected Outcomes:**
- Reset email sent (async)
- Token expires after timeout
- Password updated in database
- All sessions invalidated
- User can login with new password

#### Scenario 5: Account Deactivation
**Test ID:** `AUTH-SESSION-005`
**Description:** Deactivated account cannot access system

**User Actions:**
1. Login with deactivated account credentials
2. Verify access denied

**Expected Outcomes:**
- Login blocked
- Appropriate error message
- Session not created
- Reactivation option provided

---

## Phase 2: Workspace Management (Week 1-2)

**Estimated Effort:** 3 days
**Priority:** Critical

### 2.1 Workspace CRUD Operations (8 scenarios)

#### Scenario 1: Create New Workspace
**Test ID:** `WORKSPACE-CRUD-001`
**Description:** User creates a new workspace from scratch

**User Actions:**
1. Navigate to `/workspaces`
2. Click "Create Workspace" button
3. Fill workspace name: "My Test Project"
4. Fill description: "E2E test workspace"
5. Select visibility: Private/Public
6. Click "Create" button

**Expected Outcomes:**
- Workspace created in database
- User redirected to `/workspaces/:id`
- Workspace appears in workspace list
- Default folder structure initialized

**Assertions:**
```typescript
await expect(page).toHaveURL(/\/workspaces\/\d+/);
await expect(page.locator('[data-testid="workspace-name"]')).toContainText('My Test Project');
await expect(page.locator('.file-explorer')).toBeVisible();
```

#### Scenario 2: Read Workspace Details
**Test ID:** `WORKSPACE-CRUD-002`
**Description:** User views workspace information

**User Actions:**
1. Navigate to workspace list
2. Click on existing workspace
3. View workspace details panel

**Expected Outcomes:**
- Workspace metadata displayed (name, description, created date)
- File/folder structure visible
- Workspace settings accessible
- Recent activity shown

#### Scenario 3: Update Workspace Properties
**Test ID:** `WORKSPACE-CRUD-003`
**Description:** User edits workspace name and settings

**User Actions:**
1. Open workspace
2. Click workspace settings
3. Update name, description, visibility
4. Save changes

**Expected Outcomes:**
- Changes persisted to database
- UI updates reflect changes
- Workspace list updated
- Update timestamp modified

#### Scenario 4: Delete Workspace
**Test ID:** `WORKSPACE-CRUD-004`
**Description:** User permanently deletes workspace

**User Actions:**
1. Navigate to workspace list
2. Click workspace menu
3. Select "Delete Workspace"
4. Confirm deletion in modal

**Expected Outcomes:**
- Confirmation dialog shown
- Workspace removed from list
- Associated files deleted
- User redirected to workspace list

#### Scenario 5: Workspace List Pagination
**Test ID:** `WORKSPACE-CRUD-005`
**Description:** User navigates through multiple pages of workspaces

**User Actions:**
1. Create 25+ workspaces
2. Navigate to workspace list
3. Use pagination controls

**Expected Outcomes:**
- Workspaces paginated (10-20 per page)
- Page navigation works correctly
- Total count displayed
- Sorting options available

#### Scenario 6: Workspace Search and Filter
**Test ID:** `WORKSPACE-CRUD-006`
**Description:** User searches and filters workspaces

**User Actions:**
1. Navigate to workspace list
2. Enter search term in search box
3. Apply filters (date, visibility, tags)

**Expected Outcomes:**
- Search results update in real-time
- Filters apply correctly
- Clear filters option available
- No results message shown when appropriate

#### Scenario 7: Workspace Sharing
**Test ID:** `WORKSPACE-CRUD-007`
**Description:** User shares workspace with collaborators

**User Actions:**
1. Open workspace
2. Click "Share" button
3. Add collaborator email
4. Set permissions (view/edit)
5. Send invitation

**Expected Outcomes:**
- Invitation sent to collaborator
- Collaborator added to workspace
- Permissions enforced
- Activity logged

#### Scenario 8: Clone Workspace
**Test ID:** `WORKSPACE-CRUD-008`
**Description:** User creates copy of existing workspace

**User Actions:**
1. Navigate to workspace list
2. Click workspace menu
3. Select "Clone Workspace"
4. Enter new workspace name
5. Confirm clone

**Expected Outcomes:**
- New workspace created
- All files copied
- Settings duplicated
- Original workspace unchanged

---

## Phase 3: AI Features (Week 3-4)

**Estimated Effort:** 5 days
**Priority:** High

### 3.1 AI Chat Interactions (6 scenarios)

#### Scenario 1: Basic Chat Message
**Test ID:** `AI-CHAT-001`
**Description:** User sends message and receives AI response

**User Actions:**
1. Navigate to main interface
2. Click AI chat input
3. Type: "Create a React button component"
4. Click send or press Enter
5. Wait for response

**Expected Outcomes:**
- Message sent to AI API
- Loading indicator displayed
- Response rendered with syntax highlighting
- Token usage tracked

**Assertions:**
```typescript
await expect(page.locator('[data-testid="ai-response"]')).toBeVisible({ timeout: 35000 });
const response = await page.locator('[data-testid="ai-response"]').textContent();
expect(response).toContain('button');
expect(response).toMatch(/function|const|component/i);
```

#### Scenario 2: Streaming Response
**Test ID:** `AI-CHAT-002`
**Description:** AI response streams progressively

**User Actions:**
1. Submit AI prompt
2. Observe streaming response

**Expected Outcomes:**
- Response appears incrementally
- Streaming indicator visible
- User can stop generation
- Final response complete

#### Scenario 3: File Upload with Context
**Test ID:** `AI-CHAT-003`
**Description:** User uploads file for AI analysis

**User Actions:**
1. Click file upload button in chat
2. Select file (e.g., code file, document)
3. Submit prompt: "Review this code"
4. Wait for AI analysis

**Expected Outcomes:**
- File uploaded successfully
- File content sent to AI with prompt
- AI response references file content
- File attachment shown in chat

#### Scenario 4: Multi-turn Conversation
**Test ID:** `AI-CHAT-004`
**Description:** User maintains conversation context across messages

**User Actions:**
1. Send: "Create a todo list component"
2. Wait for response
3. Send: "Add TypeScript types to it"
4. Send: "Now add error handling"

**Expected Outcomes:**
- Context maintained across messages
- AI references previous responses
- Conversation history preserved
- Context reset option available

#### Scenario 5: Code Application
**Test ID:** `AI-CHAT-005`
**Description:** User applies AI-generated code to workspace

**User Actions:**
1. Generate code with AI
2. Click "Apply to Workspace" button
3. Select target file/location
4. Confirm application

**Expected Outcomes:**
- Code inserted into editor
- File created if necessary
- Undo option available
- Change tracked in history

#### Scenario 6: Error Handling
**Test ID:** `AI-CHAT-006`
**Description:** Chat handles API failures gracefully

**User Actions:**
1. Submit prompt when API unavailable
2. Submit prompt that triggers rate limit
3. Submit extremely long prompt

**Expected Outcomes:**
- Error messages clear and actionable
- Retry option provided
- No application crash
- Partial responses saved

### 3.2 Code Generation Workflow (6 scenarios)

#### Scenario 1: Project Scaffolding
**Test ID:** `AI-CODEGEN-001`
**Description:** User generates complete project structure

**User Actions:**
1. Click "New Project" button
2. Enter project description
3. Select framework (React, Vue, etc.)
4. Click "Generate Project"
5. Wait for generation

**Expected Outcomes:**
- Complete project structure created
- Multiple files generated
- Dependencies listed
- README generated

**Assertions:**
```typescript
const fileTree = page.locator('[data-testid="file-explorer"]');
await expect(fileTree.locator('.file-item')).toHaveCount({ greaterThan: 5 });
await expect(fileTree).toContainText('package.json');
await expect(fileTree).toContainText('src/');
```

#### Scenario 2: Component Generation
**Test ID:** `AI-CODEGEN-002`
**Description:** User generates single component

**User Actions:**
1. Submit prompt: "Create a login form component"
2. Review generated code
3. Apply to workspace

**Expected Outcomes:**
- Component code generated
- Props and types included
- Styling included (CSS/styled-components)
- JSDoc comments present

#### Scenario 3: Test Generation
**Test ID:** `AI-CODEGEN-003`
**Description:** User generates tests for existing code

**User Actions:**
1. Select file in explorer
2. Right-click → "Generate Tests"
3. Review generated tests

**Expected Outcomes:**
- Test file created
- Test cases cover main scenarios
- Test framework matches project
- Imports correct

#### Scenario 4: Code Refactoring
**Test ID:** `AI-CODEGEN-004`
**Description:** User requests code improvements

**User Actions:**
1. Select code in editor
2. Submit prompt: "Refactor this to use TypeScript"
3. Review suggestions
4. Apply changes

**Expected Outcomes:**
- Refactored code maintains functionality
- Type annotations added
- Code quality improved
- Original code preserved in history

#### Scenario 5: Documentation Generation
**Test ID:** `AI-CODEGEN-005`
**Description:** User generates documentation for code

**User Actions:**
1. Select function/class
2. Request: "Generate documentation"
3. Review generated docs

**Expected Outcomes:**
- JSDoc/TSDoc comments added
- Parameters documented
- Return values documented
- Examples included

#### Scenario 6: Bulk File Generation
**Test ID:** `AI-CODEGEN-006`
**Description:** User generates multiple related files

**User Actions:**
1. Submit: "Create REST API with authentication"
2. Wait for generation
3. Review generated files

**Expected Outcomes:**
- Multiple files created (routes, controllers, middleware)
- Files properly linked/imported
- Consistent naming convention
- Complete implementation

---

## Phase 4: Code Editor & Terminal (Week 3-4)

**Estimated Effort:** 4 days
**Priority:** High

### 4.1 Code Editor Features (4 scenarios)

#### Scenario 1: File Editing
**Test ID:** `EDITOR-001`
**Description:** User opens, edits, and saves file

**User Actions:**
1. Click file in explorer
2. Editor opens with file content
3. Make edits to code
4. Press Ctrl+S or click Save
5. Verify changes persisted

**Expected Outcomes:**
- Monaco editor loads with syntax highlighting
- Edits reflected in real-time
- Save indicator shown
- File updated in database

**Assertions:**
```typescript
await expect(page.locator('.monaco-editor')).toBeVisible();
await page.keyboard.press('Control+A');
await page.keyboard.type('// Updated code');
await page.keyboard.press('Control+S');
await expect(page.locator('.save-indicator')).toContainText(/saved/i);
```

#### Scenario 2: IntelliSense & Autocomplete
**Test ID:** `EDITOR-002`
**Description:** Editor provides code completion

**User Actions:**
1. Open JavaScript/TypeScript file
2. Type partial code
3. Trigger autocomplete (Ctrl+Space)
4. Select suggestion

**Expected Outcomes:**
- Autocomplete suggestions appear
- Suggestions context-aware
- Documentation shown for suggestions
- Selection inserts code

#### Scenario 3: Multi-File Editing
**Test ID:** `EDITOR-003`
**Description:** User works with multiple open files

**User Actions:**
1. Open file A
2. Open file B in new tab
3. Switch between tabs
4. Split editor view (if supported)

**Expected Outcomes:**
- Multiple tabs managed
- Tab switching preserves state
- Split view shows both files
- Changes tracked per file

#### Scenario 4: Code Formatting
**Test ID:** `EDITOR-004`
**Description:** User formats code with Prettier/formatter

**User Actions:**
1. Open file with unformatted code
2. Right-click → Format Document
3. Verify formatting applied

**Expected Outcomes:**
- Code formatted according to project rules
- Formatting fast (<500ms)
- Undo preserves original
- Format on save option

### 4.2 Terminal Sessions (2 scenarios)

#### Scenario 1: Terminal Execution
**Test ID:** `TERMINAL-001`
**Description:** User opens terminal and runs commands

**User Actions:**
1. Click "Open Terminal" button
2. Wait for terminal to initialize
3. Type command: `echo "Hello World"`
4. Press Enter
5. View output

**Expected Outcomes:**
- Terminal opens with shell prompt
- Commands executed
- Output displayed
- Command history available

**Assertions:**
```typescript
await expect(page.locator('.xterm-terminal')).toBeVisible();
await page.keyboard.type('echo "Hello World"');
await page.keyboard.press('Enter');
await expect(page.locator('.xterm-terminal')).toContainText('Hello World');
```

#### Scenario 2: Multiple Terminal Sessions
**Test ID:** `TERMINAL-002`
**Description:** User manages multiple terminal instances

**User Actions:**
1. Open terminal 1
2. Open terminal 2
3. Run commands in each
4. Switch between terminals
5. Close terminal

**Expected Outcomes:**
- Multiple terminals supported
- Sessions isolated
- State preserved on switch
- Clean shutdown on close

---

## Phase 5: Collaboration & Settings (Week 5-6)

**Estimated Effort:** 3 days
**Priority:** Medium

### 5.1 Real-time Collaboration (2 scenarios)

#### Scenario 1: Concurrent Editing
**Test ID:** `COLLAB-001`
**Description:** Multiple users edit same file simultaneously

**User Actions:**
1. User A opens file
2. User B opens same file
3. Both users make edits
4. Observe real-time sync

**Expected Outcomes:**
- Changes sync in real-time
- Cursors visible for both users
- No conflicts/overwrites
- Presence indicators shown

#### Scenario 2: Live Cursors & Selection
**Test ID:** `COLLAB-002`
**Description:** Users see each other's cursors and selections

**User Actions:**
1. User A selects code block
2. User B observes selection
3. Users move cursors

**Expected Outcomes:**
- Cursor positions visible
- User avatars/names shown
- Color-coded per user
- Smooth cursor movement

### 5.2 Settings & Preferences (2 scenarios)

#### Scenario 1: User Settings
**Test ID:** `SETTINGS-001`
**Description:** User customizes application preferences

**User Actions:**
1. Navigate to Settings
2. Change theme (light/dark)
3. Update editor settings (tab size, font)
4. Save preferences

**Expected Outcomes:**
- Settings persisted to database
- UI updates immediately
- Settings sync across sessions
- Reset to defaults option

#### Scenario 2: Workspace Settings
**Test ID:** `SETTINGS-002`
**Description:** User configures workspace-specific settings

**User Actions:**
1. Open workspace settings
2. Configure linting rules
3. Set build commands
4. Save configuration

**Expected Outcomes:**
- Settings scoped to workspace
- Configuration file created (.vibecode/config.json)
- Settings validated
- Team settings shared (if applicable)

---

## Phase 6: Advanced Scenarios (Week 5-6)

**Estimated Effort:** 4 days
**Priority:** Medium

### 6.1 Performance & Load Testing (2 scenarios)

#### Scenario 1: Large File Handling
**Test ID:** `PERF-001`
**Description:** Editor handles large files efficiently

**User Actions:**
1. Open file >1MB
2. Scroll through file
3. Make edits
4. Search in file

**Expected Outcomes:**
- File loads in <2s
- Scrolling smooth (>30fps)
- Edits responsive (<100ms)
- Search completes <1s

#### Scenario 2: Concurrent Users
**Test ID:** `PERF-002`
**Description:** System handles multiple concurrent users

**User Actions:**
1. Simulate 10 concurrent users
2. Each performs typical workflow
3. Monitor system resources

**Expected Outcomes:**
- All operations complete successfully
- Response times within SLA
- No resource exhaustion
- No race conditions

### 6.2 Error Recovery (2 scenarios)

#### Scenario 1: Network Interruption
**Test ID:** `ERROR-001`
**Description:** Application handles network failures

**User Actions:**
1. Start editing file
2. Simulate network disconnect
3. Continue editing
4. Restore network

**Expected Outcomes:**
- Offline indicator shown
- Changes queued locally
- Auto-sync on reconnect
- No data loss

#### Scenario 2: Browser Crash Recovery
**Test ID:** `ERROR-002`
**Description:** User recovers from browser crash

**User Actions:**
1. Work on file
2. Simulate browser crash/refresh
3. Reopen application

**Expected Outcomes:**
- Draft recovery offered
- Recent changes restored
- State recovered
- Clear recovery message

---

## Visual Regression Testing

### Approach
Use Playwright's screenshot comparison to detect unintended UI changes.

### Key Screenshots
1. **Authentication Pages:** Login, register, forgot password
2. **Dashboard:** Main workspace view, empty state, with content
3. **AI Chat:** Empty chat, active conversation, streaming response
4. **Code Editor:** Syntax highlighting, split view, with errors
5. **File Explorer:** Empty, with files, with nested folders
6. **Settings:** User preferences, workspace configuration
7. **Modals:** Create workspace, confirm delete, share dialog

### Baseline Creation
```bash
npm run test:e2e -- --update-snapshots
```

### Comparison Thresholds
- **Pixel Difference:** <0.2% for exact matches
- **Layout Shifts:** <5px for acceptable variance
- **Animation States:** Disable animations for screenshots

### Visual Test Example
```typescript
test('dashboard visual regression', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Disable animations for consistent screenshots
  await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });

  expect(await page.screenshot()).toMatchSnapshot('dashboard-main.png', {
    maxDiffPixels: 100
  });
});
```

---

## Accessibility Testing

### WCAG 2.1 AA Compliance

#### Automated Checks (via axe-core)
```typescript
import { injectAxe, checkA11y } from '@axe-core/playwright';

test('accessibility compliance', async ({ page }) => {
  await page.goto('/');
  await injectAxe(page);

  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: { html: true }
  });
});
```

#### Manual Test Cases
1. **Keyboard Navigation:** All interactive elements accessible via Tab/Shift+Tab
2. **Screen Reader:** ARIA labels present, semantic HTML used
3. **Color Contrast:** Text meets 4.5:1 ratio (7:1 for large text)
4. **Focus Indicators:** Visible focus states on all interactive elements
5. **Form Labels:** All inputs have associated labels
6. **Error Messages:** Accessible error announcements
7. **Dynamic Content:** Live regions for updates

#### Accessibility Test Matrix
| Feature | Keyboard | Screen Reader | Contrast | Focus |
|---------|----------|---------------|----------|-------|
| Login Form | ✓ | ✓ | ✓ | ✓ |
| AI Chat | ✓ | ✓ | ✓ | ✓ |
| Code Editor | ✓ | Partial | ✓ | ✓ |
| File Explorer | ✓ | ✓ | ✓ | ✓ |
| Settings | ✓ | ✓ | ✓ | ✓ |

---

## Cross-Browser Compatibility

### Browser Matrix

| Browser | Version | Desktop | Mobile | Priority |
|---------|---------|---------|--------|----------|
| Chrome | Latest | ✓ | ✓ | P0 |
| Firefox | Latest | ✓ | - | P1 |
| Safari | Latest | ✓ | ✓ | P1 |
| Edge | Latest | ✓ | - | P2 |

### Browser-Specific Tests
```typescript
test.describe('Cross-browser compatibility', () => {
  test('works on Chromium', async ({ page }) => { /* ... */ });
  test('works on Firefox', async ({ page }) => { /* ... */ });
  test('works on WebKit/Safari', async ({ page }) => { /* ... */ });
});
```

### Known Browser Differences
- **Safari:** WebSocket reconnection delay
- **Firefox:** Monaco editor performance differences
- **Mobile Safari:** Touch event handling
- **Edge:** Legacy compatibility mode issues

---

## Performance Benchmarks

### Target Metrics

| Operation | Target | Acceptable | Poor |
|-----------|--------|------------|------|
| Page Load (FCP) | <1.5s | <2.5s | >2.5s |
| AI Response Start | <2s | <5s | >5s |
| AI Response Complete | <15s | <30s | >30s |
| File Open | <500ms | <1s | >1s |
| Save Operation | <300ms | <500ms | >500ms |
| Search Results | <200ms | <500ms | >500ms |

### Performance Test Example
```typescript
test('AI response performance', async ({ page }) => {
  const startTime = Date.now();

  await page.goto('/');
  await helpers.submitAIPrompt('Create a button component');

  // Wait for first token
  await page.waitForSelector('[data-testid="ai-response"]', { timeout: 5000 });
  const firstTokenTime = Date.now() - startTime;

  // Wait for complete response
  await helpers.waitForAIResponse();
  const totalTime = Date.now() - startTime;

  expect(firstTokenTime).toBeLessThan(2000); // <2s for first token
  expect(totalTime).toBeLessThan(30000); // <30s for complete response
});
```

---

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: http://localhost:3000
          CI: true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: test-results/

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: screenshots
          path: test-results/**/*.png
```

### Test Execution Strategy
- **PR Builds:** Run critical path tests (smoke tests)
- **Main Branch:** Run full test suite
- **Nightly:** Run extended tests including performance
- **Release:** Run full suite + visual regression

### Failure Handling
1. **Automatic Retry:** 2 retries for flaky tests
2. **Slack Notification:** Alert team on failures
3. **Screenshot Upload:** Attach failure screenshots
4. **Video Recording:** Retain videos for failed tests
5. **Trace Files:** Upload traces for debugging

---

## Test Data Management

### Fixtures Strategy
```typescript
// tests/e2e/fixtures/test-data.ts
export const testUsers = {
  standard: {
    email: 'test@vibecode.com',
    password: 'TestPass123!',
    role: 'user'
  },
  admin: {
    email: 'admin@vibecode.com',
    password: 'AdminPass123!',
    role: 'admin'
  },
  premium: {
    email: 'premium@vibecode.com',
    password: 'PremiumPass123!',
    role: 'premium'
  }
};

export const testWorkspaces = {
  empty: {
    name: 'Empty Workspace',
    description: 'No files'
  },
  populated: {
    name: 'Sample Project',
    description: 'Pre-populated test workspace',
    files: [
      { name: 'index.js', content: '// Sample code' },
      { name: 'README.md', content: '# Test Project' }
    ]
  }
};
```

### Database Seeding
```typescript
// tests/e2e/helpers/seed-database.ts
export async function seedTestData() {
  // Create test users
  await createTestUsers();

  // Create test workspaces
  await createTestWorkspaces();

  // Create test files
  await createTestFiles();
}

export async function cleanupTestData() {
  // Remove test users
  await deleteTestUsers();

  // Remove test workspaces
  await deleteTestWorkspaces();
}
```

---

## Implementation Roadmap

### Week 1-2: Foundation (Days 1-7)
- [ ] **Day 1-2:** Set up test infrastructure
  - Configure Playwright projects for all browsers
  - Create shared test helpers and utilities
  - Set up fixture management
  - Configure CI/CD pipeline

- [ ] **Day 3-4:** Authentication tests (10 scenarios)
  - Registration flow (5 scenarios)
  - Login flow (5 scenarios)

- [ ] **Day 5-7:** Workspace management (8 scenarios)
  - CRUD operations
  - Search and filtering
  - Sharing and permissions

### Week 3-4: Core Features (Days 8-14)
- [ ] **Day 8-10:** AI chat interactions (6 scenarios)
  - Basic chat
  - Streaming responses
  - File uploads
  - Multi-turn conversations

- [ ] **Day 11-12:** Code generation (6 scenarios)
  - Project scaffolding
  - Component generation
  - Test generation

- [ ] **Day 13-14:** Editor and terminal (6 scenarios)
  - File editing
  - IntelliSense
  - Terminal execution

### Week 5-6: Advanced Features (Days 15-20)
- [ ] **Day 15-16:** Collaboration (2 scenarios)
  - Concurrent editing
  - Live cursors

- [ ] **Day 17:** Settings (2 scenarios)
  - User preferences
  - Workspace configuration

- [ ] **Day 18-19:** Performance and error handling (4 scenarios)
  - Large file handling
  - Network interruption
  - Browser crash recovery

- [ ] **Day 20:** Visual regression and accessibility
  - Baseline screenshots
  - Accessibility audit
  - Final integration testing

---

## Test Maintenance Guidelines

### Flaky Test Management
1. **Identify:** Monitor test failure rates
2. **Analyze:** Review failure patterns
3. **Fix:** Improve selectors, add waits, stabilize environment
4. **Quarantine:** Mark as `test.skip()` if unfixable, create issue

### Selector Best Practices
```typescript
// ✅ Good: Use data-testid attributes
await page.click('[data-testid="login-button"]');

// ✅ Good: Use semantic role selectors
await page.click('button:has-text("Login")');

// ❌ Bad: Fragile CSS selectors
await page.click('.btn.btn-primary.login-btn-123');

// ❌ Bad: XPath selectors
await page.click('//button[@class="login-btn"]');
```

### Wait Strategies
```typescript
// ✅ Good: Wait for specific condition
await page.waitForSelector('[data-testid="ai-response"]', { state: 'visible' });

// ✅ Good: Wait for network idle
await page.waitForLoadState('networkidle');

// ❌ Bad: Arbitrary timeouts
await page.waitForTimeout(5000);
```

### Test Isolation
- Each test should be independent
- Use `beforeEach` for setup
- Use `afterEach` for cleanup
- Don't rely on test execution order

---

## Success Metrics

### Quantitative Goals
- **Test Count:** 30+ comprehensive E2E scenarios
- **Code Coverage:** >80% for critical paths
- **Execution Time:** <15 minutes for full suite
- **Pass Rate:** >95% on main branch
- **Flaky Test Rate:** <5%

### Qualitative Goals
- All critical user journeys covered
- Visual regression baseline established
- Accessibility compliance validated
- Cross-browser compatibility confirmed
- Performance benchmarks met

### Monitoring Dashboard
Track key metrics in CI/CD:
- Test execution time trends
- Failure rate by test category
- Flaky test identification
- Coverage reports
- Performance regression detection

---

## Risk Assessment

### High Risk Areas
1. **AI Response Variability:** Non-deterministic AI outputs
   - **Mitigation:** Test structure/format, not exact content

2. **Real-time Collaboration:** WebSocket race conditions
   - **Mitigation:** Event-based synchronization, retry logic

3. **Large File Operations:** Performance degradation
   - **Mitigation:** Virtualized rendering, pagination

4. **Browser Compatibility:** Safari WebSocket issues
   - **Mitigation:** Browser-specific configurations, fallbacks

### Medium Risk Areas
1. **Test Data Management:** Stale fixtures
   - **Mitigation:** Automated cleanup, database seeding

2. **CI/CD Flakiness:** Network/resource issues
   - **Mitigation:** Retries, parallel execution limits

3. **Visual Regression:** False positives from dynamic content
   - **Mitigation:** Mask dynamic areas, freeze animations

---

## Appendix A: Helper Functions

### Test Helpers Reference
```typescript
// tests/e2e/utils/test-helpers.ts

export function createTestHelpers(page: Page) {
  return {
    // Authentication
    login: async (email?: string, password?: string) => { /* ... */ },
    logout: async () => { /* ... */ },

    // Navigation
    waitForPageReady: async () => { /* ... */ },
    waitForAIResponse: async () => { /* ... */ },

    // AI Interactions
    submitAIPrompt: async (prompt: string) => { /* ... */ },

    // Accessibility
    checkAccessibility: async () => { /* ... */ },

    // Debugging
    takeScreenshot: async (name: string) => { /* ... */ },
    checkForErrors: async () => { /* ... */ },

    // Network
    monitorNetworkRequests: async () => { /* ... */ }
  };
}
```

---

## Appendix B: Test Execution Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run tests in headed mode (visible browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/auth/login.test.ts

# Run tests for specific browser
npx playwright test --project=chromium

# Run tests with specific tag
npx playwright test --grep @smoke

# Debug specific test
npx playwright test --debug tests/e2e/ai/chat.test.ts

# Update visual regression baselines
npm run test:e2e -- --update-snapshots

# Generate HTML report
npx playwright show-report

# Run tests in CI mode
CI=true npm run test:e2e
```

---

## Appendix C: Common Issues & Solutions

### Issue: Monaco Editor Typing Not Working
**Solution:** Use `page.keyboard.type()` instead of `fill()`, wait for editor to be focused

### Issue: AI Response Timeout
**Solution:** Increase timeout to 60s, check API rate limits, mock responses for consistent tests

### Issue: WebSocket Connection Fails
**Solution:** Ensure server supports WebSocket, check for proxy issues, verify port configuration

### Issue: Test Flakiness on CI
**Solution:** Add `networkidle` waits, disable parallelization for problematic tests, use retry logic

### Issue: Screenshot Comparison Fails
**Solution:** Disable animations, mask dynamic content, use higher threshold for acceptable differences

---

**Document Version:** 1.0
**Last Updated:** 2025-10-01
**Next Review:** 2025-11-01
**Owner:** QA Engineering Team
**Approvers:** Engineering Lead, Product Manager
