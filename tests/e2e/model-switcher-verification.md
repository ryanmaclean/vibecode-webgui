# Model Switcher E2E Verification Report

## Overview

This document describes the E2E tests for the Model Switcher Quick Access Panel feature.

## Test File

`tests/e2e/model-switcher.spec.ts`

## Test Coverage

### 1. **Global Visibility Tests**

Tests that the ModelSwitcher component is visible across different pages:

- ✅ Homepage (`/`)
- ✅ AI Models page (`/ai/models`)
- ✅ Chat page (`/chat`)
- ✅ VM page (`/vm`)

**Expected**: ModelSwitcher should be visible in the top-right corner of all pages.

### 2. **Panel Interaction Tests**

- ✅ **Open panel**: Clicking the ModelSwitcher button opens the dropdown panel
- ✅ **Close on outside click**: Clicking the backdrop closes the panel
- ✅ **Close on Escape**: Pressing Escape key closes the panel
- ✅ **Search functionality**: Typing in search input filters the model list
- ✅ **Model selection**: Clicking a model selects it and closes the panel

**Expected**: Panel should open/close smoothly with proper backdrop and animations.

### 3. **Model Selection & Persistence Tests**

- ✅ **Model switching**: Selected model updates in the button text
- ✅ **Cross-page persistence**: Selected model persists when navigating between pages
- ✅ **Refresh persistence**: Selected model persists after page refresh
- ✅ **Current model indicator**: Selected model shows checkmark in the list

**Expected**: Model selection should persist via localStorage and be reflected across all pages.

### 4. **Favorites & Recent Models Tests**

- ✅ **Toggle favorite**: Clicking the star icon toggles favorite status
- ✅ **Favorites section**: Favorites section appears when models are favorited
- ✅ **Recent section**: Recent models section appears after selecting models

**Expected**: Favorites and recent models should be tracked and displayed in dedicated sections.

### 5. **Visual Indicators Tests**

- ✅ **Cost badges**: Each model displays cost tier (Free/Low/Med/High)
- ✅ **Latency badges**: Each model displays speed tier (Fast/Med/Slow)
- ✅ **Visual consistency**: Badges use consistent color coding

**Expected**: Visual indicators should help users quickly identify model characteristics.

### 6. **Keyboard Shortcuts Tests**

- ✅ **Cmd+M (Mac) / Ctrl+M (Windows/Linux)**: Opens the panel
- ✅ **Escape**: Closes the panel

**Expected**: Keyboard shortcuts should work globally (when not typing in inputs).

### 7. **Edge Cases & Robustness Tests**

- ✅ **Rapid switching**: Rapidly switching between models doesn't cause errors
- ✅ **Empty search**: Search with no results shows appropriate message
- ✅ **Link to full models page**: "View All" link points to `/ai/models`

**Expected**: Component should handle edge cases gracefully without console errors.

## Running the Tests

### Automated E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run only model-switcher tests
npm run test:e2e -- model-switcher.spec.ts

# Run tests in headed mode (see browser)
npm run test:e2e -- --headed model-switcher.spec.ts

# Run tests with specific browser
npm run test:e2e -- --project=chromium model-switcher.spec.ts
```

### Manual Verification

If automated tests cannot run, perform manual verification:

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to http://localhost:3000**

3. **Verify visibility**:
   - Check that ModelSwitcher button is visible in top-right corner
   - Navigate to `/ai/models`, `/chat`, `/vm` - verify it's visible on all pages

4. **Test panel interaction**:
   - Click the ModelSwitcher button - panel should open
   - Click outside panel - panel should close
   - Press `Cmd+M` (or `Ctrl+M`) - panel should toggle
   - Press `Escape` when panel is open - panel should close

5. **Test search**:
   - Open panel, type "gpt-4" in search - list should filter
   - Clear search - full list should show again

6. **Test model selection**:
   - Open panel, select a model - button should update with model name
   - Navigate to another page - model should still be selected
   - Refresh page - model should still be selected

7. **Test favorites**:
   - Open panel, click star icon on a model - star should fill yellow
   - Close and reopen panel - favorites section should appear
   - Click star again - model should be removed from favorites

8. **Test visual indicators**:
   - Open panel, verify each model shows:
     - Cost badge (Free/Low/Med/High)
     - Latency badge (Fast/Med/Slow)
     - Context size (e.g., "128K ctx")
     - Model strengths

9. **Test "View All" link**:
   - Open panel, click "View All" - should navigate to `/ai/models`

## Test Data Attributes

The components include the following data-testid attributes for testing:

### ModelSwitcher Component
- `data-testid="model-switcher"` - Main container

### ModelSwitcherPanel Component
- `data-testid="panel-backdrop"` - Backdrop overlay
- `data-testid="model-switcher-panel"` - Panel card
- `data-testid="model-search-input"` - Search input
- `data-testid="view-all-models-link"` - Link to full models page
- `data-testid="favorites-section"` - Favorites section
- `data-testid="recent-section"` - Recent models section
- `data-testid="model-list"` - All models list container

### ModelItem Component
- `data-testid="model-item"` - Individual model item
- `data-model-id` - Model ID attribute
- `data-model-name` - Model name attribute
- `data-selected` - Selection status attribute
- `data-testid="latency-badge"` - Latency indicator
- `data-testid="cost-badge"` - Cost indicator
- `data-testid="favorite-toggle"` - Favorite star button
- `data-favorited` - Favorite status attribute

## Expected Behavior Summary

1. **Persistent**: ModelSwitcher appears on all pages in the same position
2. **Responsive**: Opens/closes smoothly, responds to clicks and keyboard
3. **Searchable**: Models can be filtered by name, provider, or strengths
4. **Stateful**: Selection, favorites, and recent models persist via localStorage
5. **Visual**: Clear indicators for cost, latency, and model quality
6. **Accessible**: Keyboard shortcuts work, proper ARIA attributes present
7. **Integrated**: Links to full models page for more detailed comparison

## Success Criteria

All tests should pass with:
- ✅ No console errors during interaction
- ✅ Smooth animations and transitions
- ✅ Correct state persistence across navigation
- ✅ Proper visual feedback for all interactions
- ✅ Keyboard shortcuts functioning as expected
- ✅ All data-testid attributes present and accessible

## Known Limitations

- E2E tests require the dev server to be running
- Some tests may be flaky if models data is not loaded quickly
- Keyboard shortcuts may not work in all test environments (virtual machines, CI)

## Notes

- Tests use Playwright test framework
- LocalStorage is cleared before each test to ensure clean state
- Tests are designed to be run independently or as a suite
- Visual indicators follow the ModelComparison component color scheme
