# Troubleshooting Guide

Solutions to common problems and issues you might encounter while using VibeCode.

## Quick Fixes

Before diving into specific problems, try these universal solutions:

1. **Refresh the page** - Fixes many temporary issues
2. **Check your internet connection** - VibeCode needs internet to work
3. **Clear your browser cache** - Old data can cause problems
4. **Try a different browser** - Eliminates browser-specific issues
5. **Log out and log back in** - Resets your session

💡 **The "Have you tried turning it off and on again?" of VibeCode: Refresh the page!**

## Connection Issues

### Can't Connect to VibeCode

**Symptoms:**
- Page won't load
- "Connection error" messages
- Infinite loading spinner

**Solutions:**

1. **Check your internet connection**
   - Try loading another website
   - Restart your router if needed
   - Switch to a different network

2. **Check VibeCode status**
   - Ask your teacher/administrator if the service is up
   - Check for maintenance announcements

3. **Browser issues**
   - Clear cache and cookies
   - Try incognito/private mode
   - Use a different browser

4. **Firewall/Network restrictions**
   - Check if your school/company blocks VibeCode
   - Try from a different network
   - Contact IT support

### Disconnected While Working

**Symptoms:**
- "Connection lost" message
- Can't save changes
- Workspace becomes unresponsive

**Solutions:**

1. **Don't panic** - Your work is likely saved
2. **Check internet connection**
3. **Wait 30 seconds** - Might reconnect automatically
4. **Refresh the page** if no reconnection
5. **Check your last saved version** when reconnected

💡 **Tip**: Save frequently with `Ctrl+S` or enable auto-save to minimize potential loss.

## Login Problems

### Can't Log In

**Symptoms:**
- "Invalid credentials" error
- Page redirects back to login
- Login button doesn't work

**Solutions:**

1. **Verify your credentials**
   - Check Caps Lock is off
   - Ensure username/email is correct
   - Try resetting your password

2. **Browser issues**
   - Enable cookies
   - Enable JavaScript
   - Clear browser cache
   - Try a different browser

3. **Account issues**
   - Account may be inactive
   - Contact your administrator
   - Check if registration is complete

### Forgot Password

**Steps:**

1. Click "Forgot Password" on login page
2. Enter your email address
3. Check your email for reset link
4. Follow instructions in the email
5. Create a new password

**Not receiving email?**
- Check spam/junk folder
- Verify the email address is correct
- Wait 10-15 minutes
- Request another reset link
- Contact support if still no email

## Workspace Issues

### Workspace Won't Open

**Symptoms:**
- Loading spinner doesn't stop
- Error message when clicking workspace
- Blank screen instead of workspace

**Solutions:**

1. **Wait a moment** - Workspace may be starting up (30-60 seconds)
2. **Refresh the page**
3. **Check internet connection**
4. **Try opening a different workspace** - Is it just one workspace?
5. **Check workspace status** - May be stopped/paused
6. **Restart the workspace** - Look for restart option

[Screenshot: Workspace loading with progress indicator]

### Can't Create New Workspace

**Symptoms:**
- "Create" button doesn't work
- Error message during creation
- Workspace appears then disappears

**Solutions:**

1. **Check workspace limits**
   - You may have reached maximum workspaces
   - Delete unused workspaces
   - Check your account quota

2. **Browser issues**
   - Refresh the page and try again
   - Clear cache
   - Try a different browser

3. **Name conflicts**
   - Choose a different workspace name
   - Avoid special characters

### Workspace Deleted by Accident

**Solutions:**

1. **Check trash/recycle bin** - Some systems have one
2. **Look for backup/restore options** in settings
3. **Contact support immediately** - May be recoverable
4. **Check recent downloads** - If you downloaded files

⚠️ **Prevention**: Regularly download backups of important projects!

## Code Editor Issues

### Code Editor Won't Load

**Symptoms:**
- Blank editor area
- Editor partially visible
- Can't type in editor

**Solutions:**

1. **Refresh the page**
2. **Close and reopen the file**
3. **Try a different file** - Is it just one file?
4. **Check browser extensions** - Some can interfere
5. **Try incognito mode**

### Can't Type in Editor

**Symptoms:**
- Keyboard input doesn't work
- Cursor missing or not blinking
- Editor seems "frozen"

**Solutions:**

1. **Click inside the editor** to focus it
2. **Close other programs** using lots of memory
3. **Check if file is read-only**
4. **Refresh the page**
5. **Try a different browser**

### Syntax Highlighting Not Working

**Symptoms:**
- All text is same color
- No code coloring
- Looks like plain text

**Solutions:**

1. **Check file extension** - Must be correct (`.py`, `.js`, etc.)
2. **Rename file** with correct extension if wrong
3. **Close and reopen** the file
4. **Refresh the page**

[Screenshot: Code with vs without syntax highlighting]

### Auto-Complete Not Working

**Symptoms:**
- No suggestions when typing
- Suggestions incomplete
- Wrong suggestions

**Solutions:**

1. **Check settings** - Auto-complete may be disabled
2. **Wait a moment** - Suggestions take time to load
3. **Check file type** - Some file types have limited support
4. **Refresh the page**

## File Management Issues

### Can't Upload Files

**Symptoms:**
- Upload button doesn't work
- File upload fails
- "Upload error" message

**Solutions:**

1. **Check file size** - May exceed limit
2. **Check file type** - Some types may be restricted
3. **Check storage quota** - May be out of space
4. **Try smaller files first**
5. **Check internet connection**
6. **Try one file at a time** instead of multiple

### Files Not Saving

**Symptoms:**
- Save indicator shows unsaved dot (●)
- Changes disappear after refresh
- "Save failed" error

**Solutions:**

1. **Check internet connection**
2. **Try manual save** with `Ctrl+S`
3. **Check storage quota** - May be full
4. **Copy content** to clipboard as backup
5. **Close and reopen** file
6. **Create new file** and paste content

💡 **Emergency Backup**: Select all (`Ctrl+A`), copy (`Ctrl+C`), and paste into a local text editor.

### Can't Delete Files

**Symptoms:**
- Delete option grayed out
- File reappears after deletion
- "Permission denied" error

**Solutions:**

1. **Close the file** first if it's open
2. **Check file permissions**
3. **Close all tabs** showing that file
4. **Refresh the page**
5. **Use terminal**: `rm filename`

### File Explorer Not Showing Files

**Symptoms:**
- Folder appears empty
- Some files missing
- File tree won't expand

**Solutions:**

1. **Refresh the page**
2. **Check folder is expanded** - Click the arrow
3. **Files may be hidden** - Check view settings
4. **Use terminal** to list files: `ls -la`
5. **Check if in correct workspace**

## Terminal Problems

### Terminal Won't Open

**Symptoms:**
- Terminal panel blank
- No response when clicking Terminal
- Terminal button missing

**Solutions:**

1. **Look for Terminal tab** at bottom
2. **Click "Terminal" in menu**
3. **Try keyboard shortcut**: `Ctrl+` `
4. **Refresh the page**
5. **Check workspace is fully loaded**

### Commands Not Working

**Symptoms:**
- "Command not found" errors
- Programs don't run
- Unexpected errors

**Solutions:**

1. **Check spelling** - Commands are case-sensitive
2. **Check command is installed** - Try `which command_name`
3. **Try full path** if needed
4. **Check file permissions** for scripts
5. **Review command syntax**

**Common fixes:**
- Try `python3` instead of `python`
- Try `node` instead of `nodejs`
- Use `./script.sh` for local scripts

### Terminal Frozen or Unresponsive

**Symptoms:**
- Can't type in terminal
- Commands don't execute
- No prompt ($) showing

**Solutions:**

1. **Press `Ctrl+C`** to cancel current command
2. **Wait a moment** - Command may still be running
3. **Close terminal tab** and open new one
4. **Refresh the page**
5. **Restart workspace** if nothing else works

### Can't Stop Running Program

**Symptoms:**
- Program keeps running
- `Ctrl+C` doesn't work
- Terminal appears stuck

**Solutions:**

1. **Press `Ctrl+C` multiple times**
2. **Try `Ctrl+Z`** (may suspend instead of stop)
3. **Close the terminal tab**
4. **Open new terminal** and kill process:
   ```bash
   pkill process_name
   ```
5. **Restart workspace** as last resort

## AI Assistant Issues

### AI Assistant Not Responding

**Symptoms:**
- Messages not sending
- No response from AI
- Chat appears frozen

**Solutions:**

1. **Check internet connection**
2. **Wait a moment** - Response may take time for complex questions
3. **Try sending message again**
4. **Refresh the page**
5. **Start a new chat**

### AI Gives Wrong or Unhelpful Answers

**Symptoms:**
- Incorrect code suggestions
- Irrelevant responses
- Confusing explanations

**Solutions:**

1. **Rephrase your question** - Be more specific
2. **Provide more context** - Show your code
3. **Ask follow-up questions** - Clarify what you need
4. **Start new chat** if conversation is confused
5. **Ask AI to explain its reasoning**

Example:
```
Instead of: "Help me"
Try: "I'm getting a TypeError on line 15. Here's my code: [paste code]. What's wrong?"
```

### Can't Open AI Assistant

**Symptoms:**
- AI panel won't open
- Button not responding
- Panel blank

**Solutions:**

1. **Look for AI icon** in sidebar
2. **Try keyboard shortcut**: `Ctrl+K` or `Cmd+K`
3. **Refresh the page**
4. **Check if feature is enabled** for your account
5. **Try different browser**

## Performance Issues

### VibeCode Running Slow

**Symptoms:**
- Laggy typing
- Delayed responses
- Interface sluggish

**Solutions:**

1. **Close unused tabs** in browser
2. **Close unused workspaces**
3. **Close unused files** in workspace
4. **Restart browser**
5. **Check computer resources** - Close other programs
6. **Clear browser cache**
7. **Try different browser**

### Files Taking Long to Load

**Symptoms:**
- Long wait when opening files
- Delay switching between files
- File explorer slow to respond

**Solutions:**

1. **Check file size** - Very large files are slower
2. **Check internet speed**
3. **Close unused files**
4. **Reduce open tabs**
5. **For large files**: Consider splitting into smaller files

### Code Execution Slow

**Symptoms:**
- Programs take long to run
- Terminal commands slow
- Delayed output

**Solutions:**

1. **Check code efficiency** - May have performance issues
2. **Check workspace resources** - May be limited
3. **Reduce concurrent operations**
4. **Optimize code** - Remove unnecessary loops/operations
5. **Consider code complexity** - Some operations are naturally slow

## Browser-Specific Issues

### Chrome/Edge Issues

**Common problems:**
- Extensions interfering
- Memory usage high

**Solutions:**
- Disable extensions temporarily
- Clear cache: Settings → Privacy → Clear browsing data
- Update to latest version

### Firefox Issues

**Common problems:**
- WebSocket connections
- Privacy settings too strict

**Solutions:**
- Check Enhanced Tracking Protection settings
- Clear cache: Settings → Privacy & Security → Clear Data
- Disable strict content blocking for VibeCode

### Safari Issues

**Common problems:**
- WebSocket limitations
- ITP (Intelligent Tracking Prevention) issues

**Solutions:**
- Update to latest macOS/iOS
- Disable "Prevent cross-site tracking" for VibeCode
- Clear cache: Safari → Preferences → Privacy → Manage Website Data

## Error Messages

### "Error 500: Internal Server Error"

**Meaning**: Problem on VibeCode's servers

**Solutions:**
- Wait a few minutes and try again
- Refresh the page
- Contact support if persists

### "Error 403: Forbidden"

**Meaning**: You don't have permission to access something

**Solutions:**
- Check you're logged into correct account
- Verify workspace permissions
- Contact administrator

### "Error 404: Not Found"

**Meaning**: The workspace or file doesn't exist

**Solutions:**
- Check spelling of URL
- Verify workspace hasn't been deleted
- Use Workspaces page to find workspace

### "Session Expired"

**Meaning**: You've been logged out due to inactivity

**Solutions:**
- Log in again
- Enable "Remember me" to stay logged in longer
- Save work frequently to avoid loss

### "Out of Memory"

**Meaning**: Workspace has run out of available memory

**Solutions:**
- Close unused files
- Restart workspace
- Optimize code to use less memory
- Upgrade workspace resources if possible

### "Storage Quota Exceeded"

**Meaning**: You've used all available storage

**Solutions:**
- Delete unused files
- Remove large files you don't need
- Download and remove old projects
- Clear terminal history and logs
- Upgrade storage quota if possible

## Getting Additional Help

### Before Contacting Support

Gather this information:

1. **What were you trying to do?**
2. **What happened instead?**
3. **Error messages** (exact text or screenshot)
4. **Browser and version** (Chrome 120, Firefox 119, etc.)
5. **Operating system** (Windows 11, macOS 14, etc.)
6. **Workspace name** (if relevant)
7. **Steps to reproduce** the problem

### How to Contact Support

1. **Check documentation** - You're reading it!
2. **Ask the AI Assistant** - It can help with many issues
3. **Contact your teacher/administrator** - For account issues
4. **Submit support ticket** - Through VibeCode support portal
5. **Include screenshots** - Visual aids help diagnose issues

### Taking Screenshots

**Windows**: `Windows Key + Shift + S`
**Mac**: `Cmd + Shift + 4`
**Linux**: Varies by distribution

Include screenshots of:
- Error messages
- What you see when the problem occurs
- Browser console (F12 → Console tab) if technical issue

## Prevention Tips

### Avoid Common Problems

✅ **Do:**
- Save work frequently
- Use stable internet connection
- Keep browser updated
- Close unused tabs and workspaces
- Download backups of important projects
- Use descriptive file names
- Test code in small pieces

❌ **Don't:**
- Leave many workspaces open
- Upload extremely large files
- Ignore low storage warnings
- Use outdated browsers
- Work without saving
- Delete files without confirming

### Good Habits

1. **Save regularly** - Don't rely only on auto-save
2. **Organize files** - Easy to find and manage
3. **Test frequently** - Catch errors early
4. **Back up important work** - Download copies
5. **Read error messages** - They tell you what's wrong
6. **Ask for help early** - Don't struggle alone

## FAQ

### Why does VibeCode keep logging me out?
Check "Remember me" when logging in, or your session may have expired due to inactivity.

### Why can't I see changes I just made?
Refresh the page. Changes should be auto-saved, but you may need to reload.

### What should I do if I get a weird error?
Copy the exact error message, try refreshing, and if it persists, contact support with the error details.

### How do I report a bug?
Contact support with details: what you did, what happened, error messages, and screenshots.

### Is my work backed up?
Workspaces are stored in the cloud, but you should download important projects regularly.

### What if none of these solutions work?
Contact support with detailed information about your issue. Include screenshots and exact error messages.

---

**Still need help?**
- [Ask the AI Assistant](ai-assistant.md) for specific questions
- Review other guides: [Getting Started](getting-started.md) | [Workspaces](workspaces.md) | [Terminal](terminal.md) | [File Management](file-management.md)
- Contact your administrator or support team
