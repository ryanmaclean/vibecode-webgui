# GUI Testing for Workspace RAG Extension

## Overview

Automated and manual GUI testing for the VS Code Workspace RAG extension using open-source tools with permissive licenses (MIT/BSD/Apache).

## Tools Used

### 1. AppleScript (Built-in, Free)
- **License**: Apple built-in tool, free to use
- **Purpose**: Automate VS Code interactions on macOS
- **Capabilities**:
  - Open applications
  - Send keystrokes
  - Click UI elements
  - Read window content

### 2. PyAutoGUI (BSD-3-Clause)
- **License**: BSD-3-Clause
- **Purpose**: Cross-platform GUI automation
- **Capabilities**:
  - Mouse control
  - Keyboard input
  - Screenshot analysis
  - Window manipulation
- **Note**: Requires Accessibility permissions on macOS

### 3. osascript CLI (Built-in)
- **License**: Apple built-in tool
- **Purpose**: Run AppleScript from command line
- **Usage**: Scriptable automation for CI/CD

## Quick Start

### Automated Testing
```bash
# Run the GUI test script
./test_extension_gui.sh
```

This script will:
1. ✅ Verify VS Code is installed
2. ✅ Check extension package exists
3. ✅ Install extension via CLI
4. ✅ Create test workspace
5. ✅ Open VS Code
6. ✅ Attempt automated testing with AppleScript
7. ✅ Provide manual testing checklist

### Manual Testing Checklist

#### 1. Extension Installation
- [ ] Extension appears in Extensions view (Cmd+Shift+X)
- [ ] "Workspace RAG" shows as installed
- [ ] No error messages in output

#### 2. Configuration
- [ ] Command Palette shows RAG commands (Cmd+Shift+P)
- [ ] Configuration UI opens correctly
- [ ] LLM provider selection works
- [ ] API key storage is secure

#### 3. Workspace Indexing
- [ ] Index command triggers successfully
- [ ] Progress indicator appears
- [ ] Completion notification shown
- [ ] No errors in Output panel

#### 4. Chat Interface
- [ ] Chat panel opens on command
- [ ] UI renders correctly (Tahoe-inspired design)
- [ ] Input field is functional
- [ ] Keyboard shortcuts work

#### 5. RAG Functionality
- [ ] Questions return relevant results
- [ ] Source file references are accurate
- [ ] Answers are contextually appropriate
- [ ] Error handling works gracefully

#### 6. Performance
- [ ] Indexing completes in reasonable time
- [ ] Query responses are fast (<5s)
- [ ] No UI freezing or blocking
- [ ] Memory usage is acceptable

## AppleScript Examples

### Open VS Code and Extension
```applescript
tell application "Visual Studio Code"
    activate
end tell

tell application "System Events"
    -- Open Command Palette
    keystroke "p" using {command down, shift down}
    delay 1
    
    -- Search for extension command
    keystroke "Workspace RAG"
    delay 1
end tell
```

### Verify Extension is Loaded
```applescript
tell application "System Events"
    tell process "Code"
        -- Open Extensions view
        keystroke "x" using {command down, shift down}
        delay 2
        
        -- Search for extension
        keystroke "f" using {command down}
        delay 0.5
        keystroke "Workspace RAG"
    end tell
end tell
```

## PyAutoGUI Example

```python
import pyautogui
import time

# Open Command Palette
pyautogui.hotkey('command', 'shift', 'p')
time.sleep(1)

# Type command
pyautogui.write('Workspace RAG: Index Workspace')
time.sleep(0.5)

# Press Enter
pyautogui.press('return')
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: GUI Tests

on: [push, pull_request]

jobs:
  test-extension:
    runs-on: macos-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install VS Code
        run: |
          brew install --cask visual-studio-code
      
      - name: Package Extension
        run: |
          python3 scripts/extensions/package_workspace_rag.py package --skip-tests
      
      - name: Run GUI Tests
        run: |
          ./test_extension_gui.sh
```

## Accessibility Permissions (macOS)

For PyAutoGUI and some AppleScript features, grant Terminal/IDE accessibility permissions:

1. Open **System Preferences**
2. Go to **Security & Privacy** → **Privacy** → **Accessibility**
3. Click the lock icon to make changes
4. Add Terminal (or your IDE) to the list
5. Restart Terminal/IDE

## Troubleshooting

### AppleScript Fails to Control VS Code
- **Solution**: Grant accessibility permissions (see above)
- **Alternative**: Use manual testing checklist

### Extension Not Found After Installation
- **Solution**: Restart VS Code (`code --wait && killall 'Visual Studio Code'`)
- **Check**: Extension installed correctly (`code --list-extensions`)

### Chat Panel Doesn't Open
- **Check**: Extension activated (Output panel shows logs)
- **Check**: No errors in Developer Tools console
- **Solution**: Reload window (Cmd+R)

### Keyboard Shortcuts Don't Work
- **Check**: VS Code is focused window
- **Check**: No keyboard conflicts in VS Code settings
- **Solution**: Use Command Palette instead

## License Compliance

All GUI testing tools use permissive open-source licenses:

| Tool | License | Commercial Use | Source |
|------|---------|----------------|--------|
| AppleScript | Apple built-in | ✅ Yes | Built into macOS |
| osascript | Apple built-in | ✅ Yes | Built into macOS |
| PyAutoGUI | BSD-3-Clause | ✅ Yes | [GitHub](https://github.com/asweigart/pyautogui) |
| Pillow | HPND | ✅ Yes | [GitHub](https://github.com/python-pillow/Pillow) |

**No GPL or restrictive licenses used** - all tools are compatible with MIT/BSD/Apache requirements.

## Next Steps

1. **Run automated tests**: `./test_extension_gui.sh`
2. **Complete manual checklist**: Verify all functionality
3. **Check logs**: Review Output panel and Developer Tools
4. **Report results**: Document findings in test report
5. **CI/CD**: Integrate into GitHub Actions workflow

---

**Testing Guide Version**: 1.0.0  
**Last Updated**: November 15, 2024  
**Tools Verified**: macOS 13.0+, VS Code 1.85+
