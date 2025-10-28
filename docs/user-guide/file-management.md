# File Management

Learn how to upload, create, edit, organize, and manage files in your VibeCode workspaces.

## Understanding Files in VibeCode

Your workspace is like a folder on your computer. It can contain:

- **Code files**: `.py`, `.js`, `.html`, `.css`, etc.
- **Documents**: `.txt`, `.md`, `.json`, etc.
- **Images**: `.png`, `.jpg`, `.gif`, etc.
- **Folders**: To organize your files

All files are stored in the cloud and automatically saved.

## The File Explorer

### Location

The file explorer is on the left side of your workspace.

[Screenshot: File explorer showing folder tree structure]

### What You'll See

- **Folders**: Shown with folder icons 📁
- **Files**: Shown with document icons 📄
- **Expand/Collapse arrows**: Click to show/hide folder contents
- **Right-click menu**: Access file operations

## Creating Files

### Method 1: Using the Interface

1. **Click the "New File" icon** (usually a "+" or document icon)
2. **Enter the file name**
   - Include the extension (`.py`, `.js`, `.txt`, etc.)
   - Example: `script.py` or `index.html`
3. **Press Enter**
4. **The file opens** in the editor

[Screenshot: New file button and name input dialog]

### Method 2: Right-Click Menu

1. **Right-click in the file explorer**
2. **Select "New File"**
3. **Type the name** with extension
4. **Press Enter**

### Method 3: Terminal

```bash
touch filename.txt
```

The file appears in the file explorer immediately.

💡 **Tip**: Always include the file extension (like `.py` or `.js`) so VibeCode knows what type of file it is.

## Creating Folders

### Using the Interface

1. **Click the "New Folder" icon**
2. **Enter the folder name**
   - Use clear names like `images`, `scripts`, `docs`
3. **Press Enter**

### Right-Click Method

1. **Right-click in the file explorer**
2. **Select "New Folder"**
3. **Name the folder**
4. **Press Enter**

### Terminal Method

```bash
mkdir folder_name
```

[Screenshot: New folder creation dialog]

## Uploading Files

### Single File Upload

1. **Right-click in the file explorer**
2. **Select "Upload Files"**
3. **Choose a file** from your computer
4. **Click "Open"**
5. **Wait for upload** to complete

[Screenshot: Upload dialog showing file selection]

### Multiple Files

1. **Follow the same steps**
2. **Select multiple files** (hold Ctrl or Cmd while clicking)
3. **All files upload** to your workspace

### Drag and Drop

Many browsers support drag and drop:

1. **Open your computer's file browser**
2. **Drag files** into the VibeCode file explorer
3. **Drop them** in the desired location

💡 **Tip**: Upload limits may apply. Check your account settings for maximum file sizes.

## Editing Files

### Opening Files

**Method 1**: Click the file name in the file explorer

**Method 2**: Double-click the file

**Method 3**: Right-click and select "Open"

The file opens in the code editor.

[Screenshot: File open in code editor with syntax highlighting]

### Making Changes

1. **Click in the editor** where you want to edit
2. **Type your changes**
3. **Save the file** (see below)

### Saving Changes

**Auto-Save**: Usually enabled by default

**Manual Save:**
- Press `Ctrl+S` (Windows/Linux)
- Press `Cmd+S` (Mac)
- Or File menu → Save

**Save Indicator:**
- Unsaved files show a dot or asterisk: `● filename.py`
- Saved files show just the name: `filename.py`

### Working with Multiple Files

**Open multiple files**: Each file opens in a tab

**Switch between files**: Click the tabs at the top

**Close a file**: Click the X on the tab

[Screenshot: Multiple file tabs open in editor]

## Renaming Files and Folders

### Renaming

1. **Right-click the file or folder**
2. **Select "Rename"**
3. **Type the new name**
4. **Press Enter**

⚠️ **Warning**: If you change a file extension (like `.txt` to `.py`), make sure the content is appropriate for the new type.

### Keyboard Shortcut

Select the file and press `F2` to rename quickly.

## Moving Files

### Drag and Drop

1. **Click and hold** a file
2. **Drag it** to a folder
3. **Release** to move it

[Screenshot: Dragging a file to a folder]

### Cut and Paste

1. **Right-click the file**
2. **Select "Cut"** or press `Ctrl+X`
3. **Navigate to destination folder**
4. **Right-click and "Paste"** or press `Ctrl+V`

## Copying Files

### Copy and Paste

1. **Right-click the file**
2. **Select "Copy"** or press `Ctrl+C`
3. **Navigate to destination**
4. **Right-click and "Paste"** or press `Ctrl+V`

💡 **Tip**: Copying creates a duplicate. You might want to rename it to avoid confusion.

## Deleting Files and Folders

### Delete a File

1. **Right-click the file**
2. **Select "Delete"**
3. **Confirm the deletion** if prompted

**Keyboard Shortcut**: Select the file and press `Delete`

[Screenshot: Delete confirmation dialog]

### Delete a Folder

Same process as deleting a file:

1. **Right-click the folder**
2. **Select "Delete"**
3. **Confirm** (this deletes everything inside!)

⚠️ **Warning**: Deletion is usually permanent. Make sure you have backups of important files!

### Recovering Deleted Files

Check if your workspace has a trash or recycle bin feature. If not:

- Deleted files may be gone permanently
- Contact support immediately if you deleted something critical
- Check if you have backups or downloads of the file

## Organizing Files

### Project Structure Example

Good organization makes your project easier to manage:

```
My Web Project/
├── index.html           (main page)
├── styles/
│   ├── main.css        (styling)
│   └── responsive.css  (mobile styles)
├── scripts/
│   ├── app.js          (main logic)
│   └── utils.js        (helper functions)
├── images/
│   ├── logo.png
│   └── background.jpg
└── docs/
    └── README.md        (project info)
```

[Diagram: Visual representation of folder structure]

### Organization Tips

**Group by type:**
- All images in an `images/` folder
- All stylesheets in a `styles/` or `css/` folder
- All scripts in a `scripts/` or `js/` folder

**Group by feature:**
- `auth/` for authentication code
- `dashboard/` for dashboard components
- `api/` for API-related code

**Use clear names:**
- `user-profile.js` instead of `up.js`
- `login-form.html` instead of `form1.html`

### Don't Over-Organize

Keep it simple:
- ❌ Too many nested folders
- ❌ Single files in their own folders
- ✅ Logical groupings
- ✅ Flat structure for small projects

## Downloading Files

### Download a Single File

1. **Right-click the file**
2. **Select "Download"**
3. **Save to your computer**

### Download Multiple Files

Currently, most workspaces require downloading files individually. For multiple files:

**Option 1: Create a zip file**
```bash
zip -r project.zip .
```
Then download the zip file.

**Option 2: Download individually**
Right-click and download each file.

[Screenshot: Download option in right-click menu]

## Searching for Files

### By Name

Use the file explorer search box:

1. **Click the search icon** or box
2. **Type part of the file name**
3. **See matching files**

[Screenshot: File search showing filtered results]

### Finding Text in Files

To find files containing specific text:

**Method 1: Search Feature**
- Look for a "Search in files" option (magnifying glass icon)
- Type the text you're looking for
- See all files containing that text

**Method 2: Terminal**
```bash
grep -r "search text" .
```

This searches all files for "search text".

## File Properties and Information

### Viewing File Details

Right-click a file and select "Properties" or "Info" to see:

- File size
- Last modified date
- File type
- Full path

### File Size Limits

Check your workspace settings for limits:

- Maximum individual file size
- Total workspace storage
- File type restrictions

## Working with Different File Types

### Code Files

Extensions: `.py`, `.js`, `.java`, `.cpp`, etc.

- **Syntax highlighting**: Colors make code easier to read
- **Auto-completion**: Suggestions as you type
- **Linting**: Highlights potential errors

[Screenshot: Code file with syntax highlighting]

### Text Files

Extensions: `.txt`, `.md`

- Plain text editing
- No special formatting
- Good for notes and documentation

### Configuration Files

Extensions: `.json`, `.yaml`, `.env`, `.config`

- Often control app settings
- Be careful editing - syntax errors can break things
- Validate JSON files before saving

### Media Files

Extensions: `.png`, `.jpg`, `.gif`, `.mp3`, `.mp4`

- May have preview features
- Check file size limits
- Consider optimization for web use

## Keyboard Shortcuts

### Essential File Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` / `Cmd+S` | Save current file |
| `Ctrl+W` / `Cmd+W` | Close current file tab |
| `Ctrl+N` / `Cmd+N` | New file |
| `Ctrl+O` / `Cmd+O` | Open file dialog |
| `F2` | Rename selected file |
| `Delete` | Delete selected file |
| `Ctrl+F` / `Cmd+F` | Find in current file |
| `Ctrl+H` / `Cmd+H` | Find and replace |

## Best Practices

### Do's

✅ Use descriptive file names
✅ Organize files in folders
✅ Save your work frequently (or enable auto-save)
✅ Include file extensions
✅ Delete unused files to reduce clutter
✅ Back up important files by downloading them
✅ Use consistent naming conventions (like `kebab-case` or `snake_case`)

### Don'ts

❌ Use spaces in file names (use hyphens or underscores instead)
❌ Use special characters: `!@#$%^&*()`
❌ Create files in random locations
❌ Let files pile up without organization
❌ Upload executables or suspicious files
❌ Store passwords or secrets in plain text files

### Naming Conventions

**Good file names:**
- `user-authentication.js`
- `main_script.py`
- `index.html`
- `profile_picture.png`

**Avoid:**
- `My Script!.py` (spaces and special characters)
- `file1.js`, `file2.js` (not descriptive)
- `FINAL_FINAL_v3.js` (version chaos)

## Troubleshooting

### File Won't Open

**Possible causes:**
- File may be corrupted
- File type not supported
- File too large

**Solutions:**
- Try downloading and opening on your computer
- Check file extension is correct
- Verify file isn't corrupted by checking its size

### Can't Upload File

**Possible causes:**
- File too large
- File type restricted
- Internet connection issues
- Storage quota exceeded

**Solutions:**
- Check file size limits in settings
- Compress large files
- Verify your internet connection
- Delete unused files to free space

### Changes Not Saving

**Possible causes:**
- Auto-save disabled
- Internet connection lost
- File permissions issue

**Solutions:**
- Try manual save with `Ctrl+S`
- Check internet connection
- Refresh the page and try again
- Check the save indicator (dot on tab)

### File Disappeared

**Possible causes:**
- Accidentally moved to another folder
- Accidentally deleted
- In a collapsed folder

**Solutions:**
- Use search to find it
- Check all folders (expand them)
- Check trash/recycle bin if available
- Restore from backup if you have one

### Can't Delete File

**Possible causes:**
- File is open/in use
- Permission restrictions
- System file

**Solutions:**
- Close the file first
- Close all tabs showing that file
- Refresh the page
- Contact support if it's a system file

## FAQ

### How do I know if my file is saved?
Look for the dot (●) on the file tab. No dot means saved. Or check for a "saved" message in the editor.

### Can I work on files offline?
No, VibeCode requires an internet connection. Your files are stored in the cloud.

### What happens if I lose internet connection while editing?
Changes may not save. Always check the save indicator and save manually before losing connection.

### How do I share a file with someone?
Share the entire workspace (see [Workspaces Guide](workspaces.md)), or download the file and send it separately.

### Can I import files from GitHub?
Use the terminal to clone repositories:
```bash
git clone https://github.com/username/repo.git
```

### What's the maximum file size?
Check your account settings. Typical limits range from 10MB to 100MB per file.

### Can I edit binary files (images, PDFs)?
No, VibeCode is designed for text and code files. You can upload and store binary files but can't edit them directly.

### How do I create a file in a specific folder?
Right-click on the folder and select "New File", or navigate into the folder first, then create the file.

### Can I undo file deletion?
Check if your workspace has trash/undo features. Otherwise, deletion is usually permanent.

### Why can't I see my file extension?
Some systems hide extensions. When creating files, always type the full name with extension: `script.py`, not just `script`.

---

**Next Steps:**
- [Use the AI Assistant](ai-assistant.md) for coding help
- [Learn Terminal Commands](terminal.md) for advanced file operations
- [Troubleshooting Guide](troubleshooting.md) for more solutions
