#!/usr/bin/env node

/**
 * VibeCode First-Run Detection Utility
 *
 * Detects if this is the first time VibeCode is being run by checking
 * for a marker file at ~/.vibecode/.first-run
 *
 * Outputs: true (first run) or false (subsequent run)
 * Marker file tracks completion state for quick-start flow
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Path to VibeCode user directory
const VIBECODE_DIR = path.join(os.homedir(), '.vibecode');
const FIRST_RUN_MARKER = path.join(VIBECODE_DIR, '.first-run');

/**
 * Check if this is the first run of VibeCode
 * @returns {boolean} true if first run, false otherwise
 */
function isFirstRun() {
  try {
    // If marker file doesn't exist, this is the first run
    if (!fs.existsSync(FIRST_RUN_MARKER)) {
      return true;
    }

    // Read the marker file to check completion state
    const markerContent = fs.readFileSync(FIRST_RUN_MARKER, 'utf8');

    try {
      const state = JSON.parse(markerContent);

      // If quick-start has been completed, not a first run
      if (state.quickStartCompleted === true) {
        return false;
      }

      // If marker exists but quick-start not completed, still first run
      return true;
    } catch (parseError) {
      // If marker file is corrupted or invalid, treat as first run
      return true;
    }
  } catch (error) {
    // On any error, default to first run (safe default)
    return true;
  }
}

/**
 * Create the first-run marker file
 * This should be called when quick-start flow begins
 */
function createFirstRunMarker() {
  try {
    // Ensure .vibecode directory exists
    if (!fs.existsSync(VIBECODE_DIR)) {
      fs.mkdirSync(VIBECODE_DIR, { recursive: true });
    }

    // Create marker file with initial state
    const initialState = {
      quickStartStarted: new Date().toISOString(),
      quickStartCompleted: false,
      version: '1.0.0'
    };

    fs.writeFileSync(FIRST_RUN_MARKER, JSON.stringify(initialState, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error creating first-run marker:', error.message);
    return false;
  }
}

/**
 * Mark the quick-start flow as completed
 * This should be called when onboarding wizard finishes
 */
function markQuickStartCompleted() {
  try {
    let state = {
      quickStartStarted: new Date().toISOString(),
      quickStartCompleted: true,
      quickStartCompletedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    // Try to preserve existing data if marker exists
    if (fs.existsSync(FIRST_RUN_MARKER)) {
      try {
        const existing = JSON.parse(fs.readFileSync(FIRST_RUN_MARKER, 'utf8'));
        state = {
          ...existing,
          quickStartCompleted: true,
          quickStartCompletedAt: new Date().toISOString()
        };
      } catch (parseError) {
        // Use new state if existing is invalid
      }
    }

    // Ensure directory exists
    if (!fs.existsSync(VIBECODE_DIR)) {
      fs.mkdirSync(VIBECODE_DIR, { recursive: true });
    }

    fs.writeFileSync(FIRST_RUN_MARKER, JSON.stringify(state, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error marking quick-start as completed:', error.message);
    return false;
  }
}

/**
 * Get the current first-run state
 * @returns {object} State object with completion info
 */
function getFirstRunState() {
  try {
    if (!fs.existsSync(FIRST_RUN_MARKER)) {
      return null;
    }

    const content = fs.readFileSync(FIRST_RUN_MARKER, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// CLI interface - run when executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'create':
      // Create marker file (start quick-start)
      if (createFirstRunMarker()) {
        console.log('First-run marker created');
      } else {
        console.error('Failed to create marker');
        process.exit(1);
      }
      break;

    case 'complete':
      // Mark quick-start as completed
      if (markQuickStartCompleted()) {
        console.log('Quick-start marked as completed');
      } else {
        console.error('Failed to mark completion');
        process.exit(1);
      }
      break;

    case 'state':
      // Show current state
      const state = getFirstRunState();
      if (state) {
        console.log(JSON.stringify(state, null, 2));
      } else {
        console.log('No first-run marker found');
      }
      break;

    case 'check':
    default:
      // Default: check if first run and output true/false
      console.log(isFirstRun());
      break;
  }
}

// Export functions for use in other scripts
module.exports = {
  isFirstRun,
  createFirstRunMarker,
  markQuickStartCompleted,
  getFirstRunState,
  VIBECODE_DIR,
  FIRST_RUN_MARKER
};
