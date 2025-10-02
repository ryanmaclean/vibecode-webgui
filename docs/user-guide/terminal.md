# Using the Terminal

Learn how to use the built-in terminal to run commands, execute your code, and manage your projects.

## What is the Terminal?

The terminal is a text-based interface where you type commands to:

- Run your programs
- Install packages and tools
- Manage files and folders
- Execute scripts
- See program output

Think of it as a way to talk directly to the computer using text commands instead of clicking buttons.

[Screenshot: Terminal panel showing command prompt]

## Finding the Terminal

### Opening the Terminal

The terminal is usually visible at the bottom of your workspace. If you don't see it:

1. **Look for the Terminal tab** at the bottom
2. **Click "Terminal"** in the bottom menu
3. **Or press** `Ctrl+` ` (control + backtick) as a keyboard shortcut

[Screenshot: Terminal tab location in workspace interface]

### Terminal Layout

When you open the terminal, you'll see:

**Command Prompt:** Shows where you type
```
user@workspace:~/project$
```

**Cursor:** Blinking line where text appears

**Output Area:** Shows results of commands

## Basic Terminal Concepts

### The Command Prompt

The prompt shows important information:

```
user@workspace:~/project$
└───┬────┘ └────┬───┘ └─┬──┘
   user     workspace   current folder
```

The `$` symbol means the terminal is ready for a command.

### Running Commands

To run a command:

1. **Type the command**
2. **Press Enter**
3. **Wait for the result**
4. **The prompt appears again** when done

Example:
```bash
$ ls
file1.py  file2.py  folder/
$
```

💡 **Tip**: The `$` is shown in examples but don't type it - it's already there!

## Essential Commands

### Navigating Folders

**See where you are:**
```bash
pwd
```
Shows the current folder path.

**List files:**
```bash
ls
```
Shows files and folders in the current location.

**Change folder:**
```bash
cd folder_name
```
Moves into a folder.

**Go back one folder:**
```bash
cd ..
```
Moves to the parent folder.

**Go to home folder:**
```bash
cd ~
```

[Screenshot: Navigation commands with output examples]

### Working with Files

**Create a new file:**
```bash
touch filename.txt
```

**View file contents:**
```bash
cat filename.txt
```

**Delete a file:**
```bash
rm filename.txt
```

⚠️ **Warning**: Be careful with `rm` - deleted files can't be recovered!

**Copy a file:**
```bash
cp oldname.txt newname.txt
```

**Rename a file:**
```bash
mv oldname.txt newname.txt
```

### Working with Folders

**Create a folder:**
```bash
mkdir folder_name
```

**Delete an empty folder:**
```bash
rmdir folder_name
```

**Delete a folder and its contents:**
```bash
rm -r folder_name
```

⚠️ **Warning**: `rm -r` deletes everything inside! Use carefully.

## Running Your Code

### Python Programs

**Run a Python file:**
```bash
python filename.py
```

Or with Python 3 specifically:
```bash
python3 filename.py
```

**Example:**
```bash
$ python hello.py
Hello, World!
$
```

[Screenshot: Running a Python script with output]

### JavaScript/Node.js Programs

**Run a JavaScript file:**
```bash
node filename.js
```

**Example:**
```bash
$ node app.js
Server running on port 3000
```

### Other Languages

**Java:**
```bash
javac Program.java    # Compile first
java Program          # Then run
```

**C/C++:**
```bash
gcc program.c -o program    # Compile
./program                    # Run
```

## Managing Packages

### Python Packages (pip)

**Install a package:**
```bash
pip install package_name
```

**Example - install requests:**
```bash
pip install requests
```

**List installed packages:**
```bash
pip list
```

**Uninstall a package:**
```bash
pip uninstall package_name
```

[Screenshot: Installing a Python package with progress output]

### Node.js Packages (npm)

**Install a package:**
```bash
npm install package_name
```

**Install from package.json:**
```bash
npm install
```

**List installed packages:**
```bash
npm list
```

## Understanding Output

### Success

When a command succeeds, you usually see:
- The result or confirmation message
- The prompt returns (ready for next command)

```bash
$ mkdir new_folder
$
```
No output means success!

### Errors

When something goes wrong:

```bash
$ python typo.py
python: can't open file 'typo.py': [Errno 2] No such file or directory
```

Error messages tell you what went wrong. Read them carefully!

### Progress Messages

Some commands show progress:

```bash
$ pip install numpy
Collecting numpy
  Downloading numpy-1.24.0.tar.gz (10.2 MB)
     ━━━━━━━━━━━━━━━━━━━━ 100%
Successfully installed numpy-1.24.0
```

## Common Terminal Tasks

### Checking If Something Is Installed

**Python:**
```bash
python --version
```

**Node.js:**
```bash
node --version
```

**npm:**
```bash
npm --version
```

**Git:**
```bash
git --version
```

If installed, you'll see the version number. If not, you'll get an error.

### Clearing the Terminal

When the terminal gets cluttered:

```bash
clear
```

Or press `Ctrl+L`

### Stopping a Running Program

If a program is running and you want to stop it:

Press `Ctrl+C`

Example:
```bash
$ python long_running_script.py
Processing... (program running)
^C (pressed Ctrl+C)
Keyboard Interrupt
$
```

### Viewing Command History

**See previous commands:**
- Press ↑ (up arrow) to scroll through past commands
- Press ↓ (down arrow) to go forward
- Press Enter to run the command again

### Repeating a Command

Just press ↑ to get the last command, then press Enter!

## Terminal Shortcuts

### Essential Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Stop running program |
| `Ctrl+L` | Clear terminal screen |
| `Ctrl+A` | Jump to start of line |
| `Ctrl+E` | Jump to end of line |
| `Ctrl+U` | Delete line before cursor |
| `Tab` | Auto-complete file/folder names |
| `↑` / `↓` | Browse command history |

💡 **Tip**: Use `Tab` to auto-complete file names. Type the first few letters and press Tab!

## Working with Multiple Terminals

### Opening Additional Terminals

You can have multiple terminal sessions:

1. **Click the "+" button** in the terminal panel
2. **Or split the terminal** into panes
3. **Switch between them** with tabs

[Screenshot: Multiple terminal tabs]

### When to Use Multiple Terminals

- **Terminal 1**: Running a web server
- **Terminal 2**: Running other commands
- **Terminal 3**: Monitoring logs

## Troubleshooting

### "Command not found"

**Error:**
```bash
$ python hello.py
bash: python: command not found
```

**Solutions:**
- Try `python3` instead of `python`
- The program may not be installed
- Check for typos in the command name

### "Permission denied"

**Error:**
```bash
$ ./script.sh
Permission denied
```

**Solution:**
Make the file executable:
```bash
chmod +x script.sh
./script.sh
```

### "No such file or directory"

**Error:**
```bash
$ cd my_folder
bash: cd: my_folder: No such file or directory
```

**Solutions:**
- Check spelling of folder name (case-sensitive!)
- Use `ls` to see what folders exist
- Make sure you're in the right location

### Program Won't Stop

If `Ctrl+C` doesn't work:

1. Try pressing it again, multiple times
2. Close the terminal tab and open a new one
3. Restart the workspace if necessary

### Terminal Is Frozen

If nothing responds:

1. Try `Ctrl+C`
2. Close and reopen the terminal
3. Refresh the browser page

## Best Practices

### Do's

✅ Read error messages carefully - they tell you what's wrong
✅ Use `Tab` to auto-complete and avoid typos
✅ Use `ls` frequently to see what's in the current folder
✅ Start with simple commands and build up
✅ Test commands on practice files before using on important files

### Don'ts

❌ Run commands you don't understand
❌ Use `rm` or `rm -r` without double-checking
❌ Ignore error messages
❌ Copy and paste commands blindly from the internet
❌ Run scripts with `sudo` unless you know why

## Safety Tips

### Before Deleting Files

1. **List files first:**
   ```bash
   ls
   ```

2. **Double-check the name:**
   ```bash
   ls filename.txt
   ```

3. **Then delete:**
   ```bash
   rm filename.txt
   ```

### Before Running Scripts

1. **View the script first:**
   ```bash
   cat script.sh
   ```

2. **Understand what it does**
3. **Then run it:**
   ```bash
   ./script.sh
   ```

💡 **Golden Rule**: If you're not sure what a command does, ask the AI Assistant before running it!

## FAQ

### What does the "$" mean?
It's the command prompt symbol showing the terminal is ready for input. You don't type it.

### Are commands case-sensitive?
Yes! `File.txt` and `file.txt` are different files in Linux/Mac terminals.

### Can I undo a terminal command?
Usually no. Commands execute immediately. That's why it's important to be careful, especially with delete commands.

### How do I copy text from the terminal?
Select the text and press `Ctrl+Shift+C` (or right-click and select Copy).

### How do I paste into the terminal?
Press `Ctrl+Shift+V` (or right-click and select Paste).

### Why can't I use `python`?
Try `python3`. Some systems only have Python 3 installed as `python3`.

### What if I get stuck in a program?
Press `Ctrl+C` to exit. If that doesn't work, close the terminal tab.

### Can I run Windows commands?
VibeCode terminals are Linux-based. Use Linux commands (like `ls`, not `dir`).

### How do I know if a command is still running?
If you see the command prompt (`$`), the previous command finished. If not, it's still running.

### What's the difference between `./script.sh` and `script.sh`?
`./` means "current folder". You need it to run scripts in the current location.

## Learning More

### Getting Help for Commands

Most commands have built-in help:

```bash
command --help
```

Example:
```bash
ls --help
```

### Manual Pages

For detailed information:

```bash
man command_name
```

Press `q` to exit the manual.

### Practice Commands

Safe commands to practice with:

```bash
mkdir practice
cd practice
touch test.txt
ls
cat test.txt
cd ..
```

These create a test folder and file without affecting anything important.

---

**Next Steps:**
- [Manage Your Files](file-management.md)
- [Use the AI Assistant](ai-assistant.md) to ask terminal questions
- [Troubleshooting Guide](troubleshooting.md)
