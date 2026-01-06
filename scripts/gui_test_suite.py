#!/usr/bin/env python3

"""
Unified GUI Testing Suite
Consolidates all GUI testing functionality:
- VibeCode GUI functionality tests
- VibeCode GUI interaction tests
- VS Code Extension GUI tests
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

import os
import sys
import time
import subprocess
import re
import argparse
from pathlib import Path
from typing import Optional, Tuple, List

# Colors for output
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
RED = '\033[0;31m'
BLUE = '\033[0;34m'
NC = '\033[0m'  # No Color

SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent


class CommandRunner:
    """Utility class for running shell commands."""
    
    @staticmethod
    def run(cmd, check=True, capture_output=True, shell=False):
        """Run a shell command."""
        try:
            if isinstance(cmd, str) and shell:
                result = subprocess.run(
                    cmd,
                    shell=True,
                    check=check,
                    capture_output=capture_output,
                    text=True
                )
            else:
                result = subprocess.run(
                    cmd,
                    check=check,
                    capture_output=capture_output,
                    text=True
                )
            return result
        except subprocess.CalledProcessError as e:
            if check:
                raise
            return e
    
    @staticmethod
    def run_applescript(script):
        """Run AppleScript code."""
        result = CommandRunner.run(
            ["osascript", "-e", script],
            check=False,
            capture_output=True
        )
        return result.returncode == 0, result.stdout, result.stderr


class VibeCodeGUITester:
    """Tests for VibeCode main GUI application."""
    
    def __init__(self):
        self.project_root = PROJECT_ROOT
        self.vibecode_dir = self.project_root / "VibeCodeSwift"
    
    def kill_vibecode(self):
        """Kill any existing VibeCode instances."""
        CommandRunner.run("killall VibeCode 2>/dev/null || true", shell=True, check=False)
        time.sleep(2)
    
    def test_build(self):
        """Test 1: Build and sign properly."""
        print("[1/5] Building with proper entitlements...")
        
        os.chdir(self.vibecode_dir)
        
        # Build
        result = CommandRunner.run(
            ["swift", "build", "-c", "debug"],
            check=False,
            capture_output=True
        )
        
        binary = self.vibecode_dir / ".build/debug/VibeCode"
        if not binary.exists():
            print(f"  {RED}FAIL: Build failed{NC}")
            return None
        
        # Create app bundle if needed
        app_bundle = self.vibecode_dir / ".build/debug/VibeCode.app"
        if not app_bundle.exists():
            app_bundle.mkdir(parents=True)
            (app_bundle / "Contents/MacOS").mkdir(parents=True)
            (app_bundle / "Contents/MacOS/VibeCode").write_bytes(binary.read_bytes())
            
            info_plist = self.vibecode_dir / "Info.plist"
            if info_plist.exists():
                (app_bundle / "Contents/Info.plist").write_bytes(info_plist.read_bytes())
        
        print(f"  {GREEN}Build complete{NC}")
        return app_bundle
    
    def test_signing(self, app_bundle):
        """Test 2: Sign with entitlements."""
        print("[2/5] Signing with entitlements...")
        
        binary = app_bundle / "Contents/MacOS/VibeCode"
        entitlements = self.vibecode_dir / "VibeCode.entitlements"
        
        # Sign
        CommandRunner.run([
            "codesign",
            "--force",
            "--sign", "-",
            "--entitlements", str(entitlements),
            str(binary)
        ], check=False, capture_output=True)
        
        # Verify entitlements
        result = CommandRunner.run([
            "codesign", "-d", "--entitlements", "-",
            str(app_bundle)
        ], check=False, capture_output=True)
        
        if "com.apple.security.virtualization" in result.stderr:
            print(f"  {GREEN}PASS: Entitlements applied{NC}")
            return True
        else:
            print(f"  {RED}FAIL: Entitlements not applied{NC}")
            return False
    
    def test_launch(self, app_bundle):
        """Test 3: Launch GUI."""
        print("[3/5] Launching GUI...")
        
        CommandRunner.run(["open", str(app_bundle)])
        time.sleep(5)
        
        result = CommandRunner.run(
            "ps aux | grep -v grep | grep VibeCode.app",
            shell=True,
            check=False,
            capture_output=True
        )
        
        if result.returncode == 0 and result.stdout:
            print(f"  {GREEN}PASS: GUI launched{NC}")
            return True
        else:
            print(f"  {RED}FAIL: GUI did not launch{NC}")
            return False
    
    def test_entitlement_errors(self):
        """Test 4: Check for entitlement errors in logs."""
        print("[4/5] Checking for entitlement errors...")
        time.sleep(2)
        
        result = CommandRunner.run([
            "log", "show",
            "--predicate", "process == \"VibeCode\"",
            "--last", "10s"
        ], check=False, capture_output=True)
        
        if "doesn't have" in result.stdout and "entitlement" in result.stdout:
            print(f"  {RED}FAIL: Entitlement error detected in logs{NC}")
            return False
        else:
            print(f"  {GREEN}PASS: No entitlement errors{NC}")
            return True
    
    def test_vm_discovery(self):
        """Test 5: Verify VMs loaded in GUI."""
        print("[5/5] Verifying VM discovery...")
        time.sleep(3)
        
        result = CommandRunner.run([
            "log", "show",
            "--predicate", "process == \"VibeCode\"",
            "--last", "10s"
        ], check=False, capture_output=True)
        
        log_output = result.stdout
        
        if "VM discovery completed" in log_output:
            match = re.search(r'"vm_count":(\d+)', log_output)
            if match:
                vm_count = int(match.group(1))
                if vm_count >= 6:
                    print(f"  {GREEN}PASS: {vm_count} VMs discovered in GUI{NC}")
                    return True
                else:
                    print(f"  {RED}FAIL: Only {vm_count} VMs discovered{NC}")
                    return False
            else:
                print(f"  {YELLOW}WARN: Could not extract VM count{NC}")
                return False
        else:
            print(f"  {RED}FAIL: VM discovery did not complete{NC}")
            return False
    
    def run_all_tests(self):
        """Run all VibeCode GUI functionality tests."""
        print(f"{BLUE}GUI Functionality Tests{NC}")
        print("=" * 22)
        print("")
        
        self.kill_vibecode()
        
        app_bundle = self.test_build()
        if not app_bundle:
            return False
        
        if not self.test_signing(app_bundle):
            return False
        
        if not self.test_launch(app_bundle):
            return False
        
        if not self.test_entitlement_errors():
            self.kill_vibecode()
            return False
        
        if not self.test_vm_discovery():
            self.kill_vibecode()
            return False
        
        # Cleanup
        self.kill_vibecode()
        
        print("")
        print("=" * 22)
        print(f"{GREEN}GUI tests complete{NC}")
        return True


class VibeCodeInteractionTester:
    """Tests for VibeCode GUI interactions using AppleScript."""
    
    def __init__(self):
        self.project_root = PROJECT_ROOT
        self.script_dir = SCRIPT_DIR
    
    def kill_vibecode(self):
        """Kill any existing VibeCode instances."""
        CommandRunner.run("killall VibeCode 2>/dev/null || true", shell=True, check=False)
        time.sleep(2)
    
    def launch_vibecode(self):
        """Launch VibeCode app."""
        print("Launching VibeCode...")
        launch_script = self.script_dir / "launch-vibecode.sh"
        if launch_script.exists():
            CommandRunner.run(
                [str(launch_script)],
                check=False,
                capture_output=True
            )
        else:
            app_paths = [
                self.project_root / "VibeCodeSwift/.build/debug/VibeCode.app",
                self.project_root / "azure/SwiftUI-Apps/VibeCode.app",
            ]
            for app_path in app_paths:
                if app_path.exists():
                    CommandRunner.run(["open", str(app_path)])
                    break
        time.sleep(5)
    
    def test_window_open(self):
        """Test 1: Verify window opens."""
        print("[1/6] Verifying app window...")
        
        success, stdout, _ = CommandRunner.run_applescript(
            'tell application "System Events" to get name of every process'
        )
        
        if success and "VibeCode" in stdout:
            print(f"  {GREEN}PASS: App window open{NC}")
            return True
        else:
            print(f"  {RED}FAIL: App window not found{NC}")
            return False
    
    def test_vm_list(self):
        """Test 2: Check VM list loads."""
        print("[2/6] Checking VM list...")
        time.sleep(2)
        
        log_file = self.project_root / "logs/vibecode.log"
        if not log_file.exists():
            print(f"  {YELLOW}WARN: Log file not found{NC}")
            return False
        
        try:
            with open(log_file, 'r') as f:
                lines = f.readlines()
                for line in reversed(lines[-20:]):
                    if "vm_count" in line:
                        match = re.search(r'"vm_count":(\d+)', line)
                        if match:
                            vm_count = int(match.group(1))
                            if vm_count >= 6:
                                print(f"  {GREEN}PASS: {vm_count} VMs loaded in list{NC}")
                                return True
                            else:
                                print(f"  {RED}FAIL: Expected 6 VMs, found {vm_count}{NC}")
                                return False
            print(f"  {YELLOW}WARN: Could not find VM count in logs{NC}")
            return False
        except Exception as e:
            print(f"  {YELLOW}WARN: Error reading log file: {e}{NC}")
            return False
    
    def test_vm_selection(self):
        """Test 3: Click first VM in list."""
        print("[3/6] Selecting VM in sidebar...")
        
        applescript = """
tell application "System Events"
    tell process "VibeCode"
        set frontmost to true
        delay 1
        -- Click first VM in sidebar
        click row 1 of outline 1 of scroll area 1 of splitter group 1 of window 1
        delay 1
    end tell
end tell
"""
        
        success, _, _ = CommandRunner.run_applescript(applescript)
        
        if success:
            print(f"  {GREEN}PASS: VM selected{NC}")
            return True
        else:
            print(f"  {YELLOW}WARN: Could not automate VM selection (may require accessibility permissions){NC}")
            return False
    
    def test_auto_start(self):
        """Test 4: Auto-start verification."""
        print("[4/6] Verifying auto-start...")
        time.sleep(8)
        
        log_file = self.project_root / "logs/vibecode.log"
        if not log_file.exists():
            print(f"  {YELLOW}WARN: Log file not found{NC}")
            return False
        
        try:
            with open(log_file, 'r') as f:
                content = f.read()
                if "VM started successfully" in content:
                    matches = re.findall(r'VM started successfully.*?(\w+)', content)
                    if matches:
                        started_vm = matches[-1]
                        print(f"  {GREEN}PASS: Auto-start worked ({started_vm}){NC}")
                    else:
                        print(f"  {GREEN}PASS: Auto-start worked{NC}")
                    return True
                else:
                    print(f"  {RED}FAIL: No VM auto-started{NC}")
                    return False
        except Exception as e:
            print(f"  {YELLOW}WARN: Error reading log file: {e}{NC}")
            return False
    
    def test_errors(self):
        """Test 5: Check for errors."""
        print("[5/6] Checking for errors...")
        
        log_file = self.project_root / "logs/vibecode.log"
        if not log_file.exists():
            print(f"  {YELLOW}WARN: Log file not found{NC}")
            return False
        
        try:
            with open(log_file, 'r') as f:
                content = f.read()
                if "doesn't have" in content and "entitlement" in content:
                    print(f"  {RED}FAIL: Entitlement errors found{NC}")
                    return False
                else:
                    print(f"  {GREEN}PASS: No entitlement errors{NC}")
                    return True
        except Exception as e:
            print(f"  {YELLOW}WARN: Error reading log file: {e}{NC}")
            return False
    
    def test_vm_state(self):
        """Test 6: Verify VMs are running."""
        print("[6/6] Verifying VM state...")
        
        result = CommandRunner.run(
            'ps aux | grep -v grep | grep "VibeCode.*Contents/MacOS"',
            shell=True,
            check=False,
            capture_output=True
        )
        
        if result.returncode == 0 and result.stdout:
            print(f"  {GREEN}PASS: App still running with VMs{NC}")
            return True
        else:
            print(f"  {RED}FAIL: App crashed{NC}")
            return False
    
    def run_all_tests(self):
        """Run all VibeCode GUI interaction tests."""
        print(f"{BLUE}End-to-End GUI Testing{NC}")
        print("=" * 22)
        print("")
        
        self.kill_vibecode()
        self.launch_vibecode()
        
        results = [
            self.test_window_open(),
            self.test_vm_list(),
            self.test_vm_selection(),
            self.test_auto_start(),
            self.test_errors(),
            self.test_vm_state()
        ]
        
        print("")
        print("=" * 22)
        print(f"{GREEN}GUI interaction tests complete{NC}")
        
        return all(results)


class VSCodeExtensionTester:
    """Tests for VS Code Extension GUI."""
    
    def __init__(self):
        self.vscode_app = Path("/Applications/Visual Studio Code.app")
        self.vsix_file = PROJECT_ROOT / "dist/extensions/workspace-rag-1.0.0.vsix"
    
    def check_vscode(self):
        """Check if VS Code is installed."""
        if not self.vscode_app.exists():
            print(f"{RED}✗ VS Code not found at {self.vscode_app}{NC}")
            print("Please install VS Code first.")
            return False
        print(f"{GREEN}✓ VS Code found{NC}")
        return True
    
    def check_extension(self):
        """Check if extension is packaged."""
        if not self.vsix_file.exists():
            print(f"{RED}✗ Extension .vsix not found at {self.vsix_file}{NC}")
            print("Run: python3 scripts/extensions/package_workspace_rag.py package --skip-tests")
            return False
        print(f"{GREEN}✓ Extension package found{NC}")
        return True
    
    def install_extension(self):
        """Install extension."""
        print("")
        print("📦 Installing extension...")
        result = CommandRunner.run(
            f'code --install-extension "{self.vsix_file}" --force',
            shell=True,
            capture_output=True
        )
        output = result.stdout + result.stderr
        for line in output.split('\n'):
            if 'Installing' in line or 'Successfully' in line:
                print(line)
        time.sleep(2)
        print(f"{GREEN}✓ Extension installed{NC}")
        return True
    
    def create_test_workspace(self):
        """Create test workspace."""
        test_workspace = Path("/tmp/vscode-rag-test")
        test_workspace.mkdir(parents=True, exist_ok=True)
        
        test_file = test_workspace / "test.js"
        test_file.write_text("""// Test file for Workspace RAG Extension
function helloWorld() {
    console.log("Hello from Workspace RAG test!");
    return "success";
}

module.exports = { helloWorld };
""")
        
        print(f"{GREEN}✓ Test workspace created at {test_workspace}{NC}")
        return test_workspace
    
    def open_vscode(self, workspace):
        """Open VS Code with test workspace."""
        print("")
        print("🚀 Opening VS Code with test workspace...")
        subprocess.Popen(['code', str(workspace)])
        time.sleep(5)
    
    def run_applescript(self):
        """Run AppleScript automation."""
        applescript = """
try
    tell application "Visual Studio Code"
        activate
        delay 2
    end tell
    
    -- Open command palette (Cmd+Shift+P)
    tell application "System Events"
        keystroke "p" using {command down, shift down}
        delay 1
        
        -- Type command to open extensions
        keystroke "Extensions: Install Extensions"
        delay 1
        keystroke return
        delay 2
        
        -- Search for Workspace RAG
        keystroke "Workspace RAG"
        delay 1
    end tell
    
    display notification "Extension search complete" with title "VS Code Test"
    
on error errMsg
    display dialog "Automation failed: " & errMsg buttons {"OK"} default button 1
end try
"""
        
        result = CommandRunner.run(
            ['osascript', '-e', applescript],
            check=False,
            capture_output=True
        )
        
        if result.returncode != 0:
            print(f"AppleScript error: {result.stderr}")
    
    def print_manual_steps(self):
        """Print manual testing steps."""
        print("")
        print("════════════════════════════════════════════════════════")
        print("Manual Testing Steps:")
        print("════════════════════════════════════════════════════════")
        print("")
        print(f"1. {YELLOW}Verify Extension is Loaded:{NC}")
        print("   - Press Cmd+Shift+X (Extensions view)")
        print("   - Search for 'Workspace RAG'")
        print("   - Should show as installed")
        print("")
        print(f"2. {YELLOW}Configure Extension:{NC}")
        print("   - Press Cmd+Shift+P (Command Palette)")
        print("   - Type: 'Workspace RAG: Configure'")
        print("   - Set your LLM provider (OpenAI, Anthropic, etc.)")
        print("   - Add API key if needed")
        print("")
        print(f"3. {YELLOW}Index Workspace:{NC}")
        print("   - Press Cmd+Shift+P")
        print("   - Type: 'Workspace RAG: Index Workspace'")
        print("   - Wait for indexing to complete")
        print("")
        print(f"4. {YELLOW}Open RAG Chat:{NC}")
        print("   - Press Cmd+Shift+P")
        print("   - Type: 'Workspace RAG: Open Chat'")
        print("   - Chat panel should appear")
        print("")
        print(f"5. {YELLOW}Ask a Question:{NC}")
        print("   - In chat panel, ask: 'What does helloWorld do?'")
        print("   - Extension should find test.js and explain the function")
        print("")
        print("════════════════════════════════════════════════════════")
        print("")
        print("🤖 Attempting automated testing with AppleScript...")
        print("")
    
    def run_all_tests(self):
        """Run all VS Code extension GUI tests."""
        print("╔══════════════════════════════════════════════════════╗")
        print("║   Workspace RAG Extension - GUI Testing Script      ║")
        print("╚══════════════════════════════════════════════════════╝")
        print("")
        
        if not self.check_vscode():
            return False
        
        if not self.check_extension():
            return False
        
        self.install_extension()
        workspace = self.create_test_workspace()
        self.open_vscode(workspace)
        self.print_manual_steps()
        self.run_applescript()
        
        print("")
        print(f"{GREEN}✓ Automated steps attempted{NC}")
        print("")
        print("════════════════════════════════════════════════════════")
        print("Additional Verification:")
        print("════════════════════════════════════════════════════════")
        print("")
        print("Check Output Panel:")
        print("  - View → Output")
        print("  - Select 'Workspace RAG' from dropdown")
        print("  - Look for initialization logs")
        print("")
        print("Check Developer Tools:")
        print("  - Help → Toggle Developer Tools")
        print("  - Console tab: Check for errors")
        print("  - Look for: [Workspace RAG] messages")
        print("")
        print("════════════════════════════════════════════════════════")
        print("")
        print(f"{YELLOW}Press Enter when done testing, or Ctrl+C to abort...{NC}")
        try:
            input()
        except KeyboardInterrupt:
            print("\nAborted")
            return False
        
        print("")
        print("✅ GUI Testing Complete!")
        return True


class GUITestSuite:
    """Unified GUI test suite coordinator."""
    
    def __init__(self):
        self.vibecode_tester = VibeCodeGUITester()
        self.interaction_tester = VibeCodeInteractionTester()
        self.extension_tester = VSCodeExtensionTester()
    
    def run_all(self):
        """Run all GUI test suites."""
        print(f"{BLUE}{'='*60}{NC}")
        print(f"{BLUE}Unified GUI Test Suite{NC}")
        print(f"{BLUE}{'='*60}{NC}")
        print("")
        
        results = {}
        
        print(f"{YELLOW}Running VibeCode GUI Functionality Tests...{NC}")
        print("")
        results['vibecode'] = self.vibecode_tester.run_all_tests()
        print("")
        
        print(f"{YELLOW}Running VibeCode GUI Interaction Tests...{NC}")
        print("")
        results['interactions'] = self.interaction_tester.run_all_tests()
        print("")
        
        print(f"{YELLOW}Running VS Code Extension GUI Tests...{NC}")
        print("")
        results['extension'] = self.extension_tester.run_all_tests()
        print("")
        
        # Summary
        print(f"{BLUE}{'='*60}{NC}")
        print(f"{BLUE}Test Summary{NC}")
        print(f"{BLUE}{'='*60}{NC}")
        print("")
        print(f"VibeCode GUI Functionality: {'PASS' if results['vibecode'] else 'FAIL'}")
        print(f"VibeCode GUI Interactions: {'PASS' if results['interactions'] else 'FAIL'}")
        print(f"VS Code Extension GUI: {'PASS' if results['extension'] else 'FAIL'}")
        print("")
        
        all_passed = all(results.values())
        if all_passed:
            print(f"{GREEN}All GUI tests passed!{NC}")
        else:
            print(f"{RED}Some tests failed. See output above.{NC}")
        
        return all_passed


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Unified GUI Testing Suite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run all tests
  python3 scripts/gui_test_suite.py --all
  
  # Run only VibeCode GUI tests
  python3 scripts/gui_test_suite.py --vibecode
  
  # Run only interaction tests
  python3 scripts/gui_test_suite.py --interactions
  
  # Run only extension tests
  python3 scripts/gui_test_suite.py --extension
        """
    )
    
    parser.add_argument(
        '--all',
        action='store_true',
        help='Run all GUI test suites (default)'
    )
    parser.add_argument(
        '--vibecode',
        action='store_true',
        help='Run only VibeCode GUI functionality tests'
    )
    parser.add_argument(
        '--interactions',
        action='store_true',
        help='Run only VibeCode GUI interaction tests'
    )
    parser.add_argument(
        '--extension',
        action='store_true',
        help='Run only VS Code extension GUI tests'
    )
    
    args = parser.parse_args()
    
    suite = GUITestSuite()
    
    # Default to all if no specific test selected
    if not any([args.vibecode, args.interactions, args.extension]):
        args.all = True
    
    if args.all:
        success = suite.run_all()
        sys.exit(0 if success else 1)
    else:
        success = True
        if args.vibecode:
            success = suite.vibecode_tester.run_all_tests() and success
        if args.interactions:
            success = suite.interaction_tester.run_all_tests() and success
        if args.extension:
            success = suite.extension_tester.run_all_tests() and success
        
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

