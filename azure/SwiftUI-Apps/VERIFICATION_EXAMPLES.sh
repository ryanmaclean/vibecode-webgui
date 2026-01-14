#!/bin/bash
#
# VERIFICATION_EXAMPLES.sh
# Common usage examples for VibeCode post-build verification
#
# This file contains copy-paste examples for common scenarios.
# You can source this file or copy individual examples.
#

# Navigate to project directory
cd "$(dirname "$0")"

# ============================================================================
# EXAMPLE 1: First Time Setup
# ============================================================================
example_first_time_setup() {
  echo "=== Example 1: First Time Setup ==="
  echo ""
  echo "# Install prerequisites"
  echo "brew install node"
  echo "npm install playwright"
  echo "npx playwright install chromium"
  echo "brew install hudochenkov/sshpass/sshpass"
  echo ""
  echo "# Make scripts executable"
  echo "chmod +x post-build-verification.sh"
  echo "chmod +x verify-datadog-extension-ssh.sh"
  echo ""
  echo "# Run first verification"
  echo "./post-build-verification.sh"
  echo ""
}

# ============================================================================
# EXAMPLE 2: Full Verification Before Release
# ============================================================================
example_full_verification() {
  echo "=== Example 2: Full Verification Before Release ==="
  echo ""
  echo "# Clean environment"
  echo "pkill -f UnifiedServicesVibeCode || true"
  echo "rm -rf test-results/"
  echo ""
  echo "# Run full verification"
  echo "./post-build-verification.sh"
  echo ""
  echo "# Check exit code"
  echo "if [ \$? -eq 0 ]; then"
  echo "  echo 'Ready for release!'"
  echo "  cat test-results/post-build-verification-report.md"
  echo "else"
  echo "  echo 'Tests failed - check results'"
  echo "  open test-results/"
  echo "fi"
  echo ""
}

# ============================================================================
# EXAMPLE 3: Quick Development Check
# ============================================================================
example_quick_dev_check() {
  echo "=== Example 3: Quick Development Check ==="
  echo ""
  echo "# Skip build and launch (app already running)"
  echo "./post-build-verification.sh --skip-build --skip-launch --quick"
  echo ""
}

# ============================================================================
# EXAMPLE 4: Debug Mode
# ============================================================================
example_debug_mode() {
  echo "=== Example 4: Debug Mode ==="
  echo ""
  echo "# Run with verbose output"
  echo "./post-build-verification.sh --verbose 2>&1 | tee verification.log"
  echo ""
  echo "# Review log"
  echo "less verification.log"
  echo ""
}

# ============================================================================
# EXAMPLE 5: Individual Test - SSH Only
# ============================================================================
example_ssh_test_only() {
  echo "=== Example 5: SSH Test Only (Fast Check) ==="
  echo ""
  echo "# Run just the SSH verification"
  echo "./verify-datadog-extension-ssh.sh"
  echo ""
  echo "# With verbose output"
  echo "./verify-datadog-extension-ssh.sh --verbose"
  echo ""
}

# ============================================================================
# EXAMPLE 6: Individual Test - Datadog Browser Test
# ============================================================================
example_datadog_browser_test() {
  echo "=== Example 6: Datadog Browser Test ==="
  echo ""
  echo "# Run with browser visible (see what's happening)"
  echo "node test-datadog-extension-post-build.js"
  echo ""
  echo "# Run in headless mode"
  echo "node test-datadog-extension-post-build.js --headless"
  echo ""
  echo "# View results"
  echo "open test-results/datadog-extension/"
  echo "cat test-results/datadog-extension/test-results.json"
  echo ""
}

# ============================================================================
# EXAMPLE 7: Individual Test - Terminal Browser Test
# ============================================================================
example_terminal_browser_test() {
  echo "=== Example 7: Terminal Browser Test ==="
  echo ""
  echo "# Run with browser visible"
  echo "node test-terminal-functionality-post-build.js"
  echo ""
  echo "# Run in headless mode"
  echo "node test-terminal-functionality-post-build.js --headless"
  echo ""
  echo "# View results"
  echo "open test-results/terminal-functionality/"
  echo "cat test-results/terminal-functionality/test-results.json"
  echo ""
}

# ============================================================================
# EXAMPLE 8: CI/CD Integration
# ============================================================================
example_cicd_integration() {
  echo "=== Example 8: CI/CD Integration ==="
  echo ""
  echo "# Run in headless mode for CI/CD"
  echo "./post-build-verification.sh --headless"
  echo ""
  echo "# Archive results"
  echo "tar -czf verification-results.tar.gz test-results/"
  echo ""
  echo "# Upload to artifact storage"
  echo "# (command depends on your CI/CD platform)"
  echo ""
}

# ============================================================================
# EXAMPLE 9: Troubleshooting Failed Tests
# ============================================================================
example_troubleshooting() {
  echo "=== Example 9: Troubleshooting Failed Tests ==="
  echo ""
  echo "# Run with verbose output"
  echo "./post-build-verification.sh --verbose"
  echo ""
  echo "# Check what's running"
  echo "pgrep -f UnifiedServicesVibeCode"
  echo "lsof -i :2222  # SSH"
  echo "lsof -i :8080  # OpenVSCode"
  echo ""
  echo "# Check OpenVSCode in browser"
  echo "open http://localhost:8080"
  echo ""
  echo "# SSH into VM manually"
  echo "ssh -p 2222 root@localhost  # password: vibecode"
  echo "ls -la /root/.openvscode-server/extensions/"
  echo ""
  echo "# View screenshots"
  echo "open test-results/"
  echo ""
  echo "# Check logs"
  echo "log stream --predicate 'process == \"UnifiedServicesVibeCode\"' --level debug"
  echo ""
}

# ============================================================================
# EXAMPLE 10: Custom Configuration
# ============================================================================
example_custom_config() {
  echo "=== Example 10: Custom Configuration ==="
  echo ""
  echo "# Use custom OpenVSCode URL"
  echo "export OPENVSCODE_URL='http://localhost:9090'"
  echo "./post-build-verification.sh"
  echo ""
  echo "# Use custom SSH port"
  echo "export SSH_PORT='2223'"
  echo "./verify-datadog-extension-ssh.sh"
  echo ""
  echo "# Use custom results directory"
  echo "export RESULTS_DIR='/tmp/my-test-results'"
  echo "./post-build-verification.sh"
  echo ""
}

# ============================================================================
# EXAMPLE 11: Automated Daily Verification
# ============================================================================
example_automated_daily() {
  echo "=== Example 11: Automated Daily Verification ==="
  echo ""
  echo "# Create a cron job for daily verification"
  echo "# Add to crontab with: crontab -e"
  echo ""
  echo "# Run every day at 2 AM"
  echo "0 2 * * * cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps && ./post-build-verification.sh --headless > /tmp/verification-\$(date +\%Y\%m\%d).log 2>&1"
  echo ""
  echo "# Or use launchd (macOS)"
  echo "# Create ~/Library/LaunchAgents/com.vibecode.verification.plist"
  echo ""
}

# ============================================================================
# EXAMPLE 12: Parallel Testing (Advanced)
# ============================================================================
example_parallel_testing() {
  echo "=== Example 12: Parallel Testing (Advanced) ==="
  echo ""
  echo "# Run SSH test in parallel with browser tests"
  echo "./verify-datadog-extension-ssh.sh &"
  echo "SSH_PID=\$!"
  echo ""
  echo "node test-datadog-extension-post-build.js --headless &"
  echo "DATADOG_PID=\$!"
  echo ""
  echo "node test-terminal-functionality-post-build.js --headless &"
  echo "TERMINAL_PID=\$!"
  echo ""
  echo "# Wait for all tests to complete"
  echo "wait \$SSH_PID"
  echo "SSH_EXIT=\$?"
  echo "wait \$DATADOG_PID"
  echo "DATADOG_EXIT=\$?"
  echo "wait \$TERMINAL_PID"
  echo "TERMINAL_EXIT=\$?"
  echo ""
  echo "# Check if all passed"
  echo "if [ \$SSH_EXIT -eq 0 ] && [ \$DATADOG_EXIT -eq 0 ] && [ \$TERMINAL_EXIT -eq 0 ]; then"
  echo "  echo 'All tests passed!'"
  echo "  exit 0"
  echo "else"
  echo "  echo 'Some tests failed'"
  echo "  exit 1"
  echo "fi"
  echo ""
}

# ============================================================================
# EXAMPLE 13: Pre-commit Hook
# ============================================================================
example_precommit_hook() {
  echo "=== Example 13: Pre-commit Hook ==="
  echo ""
  echo "# Create .git/hooks/pre-commit"
  echo "cat > .git/hooks/pre-commit << 'EOF'"
  echo "#!/bin/bash"
  echo "# Pre-commit verification hook"
  echo ""
  echo "cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps"
  echo ""
  echo "# Run quick verification"
  echo "./post-build-verification.sh --skip-build --skip-launch --quick"
  echo ""
  echo "if [ \$? -ne 0 ]; then"
  echo "  echo 'Verification failed - commit aborted'"
  echo "  exit 1"
  echo "fi"
  echo "EOF"
  echo ""
  echo "# Make it executable"
  echo "chmod +x .git/hooks/pre-commit"
  echo ""
}

# ============================================================================
# EXAMPLE 14: Slack/Email Notifications
# ============================================================================
example_notifications() {
  echo "=== Example 14: Notifications on Failure ==="
  echo ""
  echo "# Run verification and send Slack notification on failure"
  echo "./post-build-verification.sh"
  echo ""
  echo "if [ \$? -ne 0 ]; then"
  echo "  # Send Slack notification"
  echo "  curl -X POST -H 'Content-type: application/json' \\"
  echo "    --data '{\"text\":\"VibeCode verification failed! Check logs.\"}' \\"
  echo "    https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
  echo ""
  echo "  # Or send email"
  echo "  echo 'Verification failed' | mail -s 'VibeCode Test Failure' you@example.com"
  echo "fi"
  echo ""
}

# ============================================================================
# Main Menu
# ============================================================================
show_menu() {
  echo ""
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║       VibeCode Post-Build Verification - Examples            ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Choose an example to display:"
  echo ""
  echo "  1.  First Time Setup"
  echo "  2.  Full Verification Before Release"
  echo "  3.  Quick Development Check"
  echo "  4.  Debug Mode"
  echo "  5.  SSH Test Only"
  echo "  6.  Datadog Browser Test"
  echo "  7.  Terminal Browser Test"
  echo "  8.  CI/CD Integration"
  echo "  9.  Troubleshooting Failed Tests"
  echo "  10. Custom Configuration"
  echo "  11. Automated Daily Verification"
  echo "  12. Parallel Testing (Advanced)"
  echo "  13. Pre-commit Hook"
  echo "  14. Slack/Email Notifications"
  echo "  15. Show All Examples"
  echo "  0.  Exit"
  echo ""
  read -p "Enter choice [0-15]: " choice
  echo ""

  case $choice in
    1) example_first_time_setup ;;
    2) example_full_verification ;;
    3) example_quick_dev_check ;;
    4) example_debug_mode ;;
    5) example_ssh_test_only ;;
    6) example_datadog_browser_test ;;
    7) example_terminal_browser_test ;;
    8) example_cicd_integration ;;
    9) example_troubleshooting ;;
    10) example_custom_config ;;
    11) example_automated_daily ;;
    12) example_parallel_testing ;;
    13) example_precommit_hook ;;
    14) example_notifications ;;
    15)
      example_first_time_setup
      example_full_verification
      example_quick_dev_check
      example_debug_mode
      example_ssh_test_only
      example_datadog_browser_test
      example_terminal_browser_test
      example_cicd_integration
      example_troubleshooting
      example_custom_config
      example_automated_daily
      example_parallel_testing
      example_precommit_hook
      example_notifications
      ;;
    0) exit 0 ;;
    *) echo "Invalid choice" ;;
  esac

  read -p "Press Enter to continue..."
  show_menu
}

# Run menu if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  show_menu
fi
