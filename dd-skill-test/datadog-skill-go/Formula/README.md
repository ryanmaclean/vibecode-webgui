# Homebrew Formula for Datadog CLI

Easy installation of the Datadog CLI on macOS via Homebrew.

---

## For Users: Installation

### Option 1: From Official Tap (After Publishing)

```bash
# Add the tap (only needed once)
brew tap yourusername/datadog-cli

# Install
brew install datadog-cli

# Verify
dd --version
```

### Option 2: Direct Formula Install (Local Testing)

```bash
# Install directly from the formula file
brew install --formula ./Formula/datadog-cli.rb

# Verify
dd --version
```

### Option 3: From URL (After Publishing)

```bash
# Install from GitHub
brew install https://raw.githubusercontent.com/yourusername/datadog-cli-go/main/Formula/datadog-cli.rb
```

---

## Quick Start After Installation

```bash
# Set credentials
export DD_API_KEY="your_api_key"
export DD_APP_KEY="your_app_key"

# Test
dd context
dd health
dd apm
```

Shell completions are automatically installed!

---

## For Maintainers: Publishing

### Step 1: Create GitHub Release

1. **Tag and push**:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. **GitHub Actions** will automatically:
   - Build binaries for all 6 platforms
   - Create GitHub Release
   - Upload binaries and checksums

3. **Verify release** at:
   ```
   https://github.com/yourusername/datadog-cli-go/releases/tag/v0.1.0
   ```

### Step 2: Generate SHA256 Checksums

```bash
# Run the checksum generator
./Formula/generate-checksums.sh 0.1.0 yourusername

# Output shows SHA256 for both architectures
# Copy these into the formula
```

### Step 3: Update Formula

Edit `Formula/datadog-cli.rb`:

1. **Update version**:
   ```ruby
   version "0.1.0"
   ```

2. **Update URLs** (replace `yourusername`):
   ```ruby
   url "https://github.com/yourusername/datadog-cli-go/releases/download/v#{version}/datadog-cli-darwin-arm64"
   ```

3. **Update SHA256 checksums**:
   ```ruby
   sha256 "actual_sha256_from_generate_checksums_script"
   ```

4. **Update homepage**:
   ```ruby
   homepage "https://github.com/yourusername/datadog-cli-go"
   ```

### Step 4: Test Formula Locally

```bash
# Uninstall if already installed
brew uninstall datadog-cli 2>/dev/null || true

# Install from local formula
brew install --formula ./Formula/datadog-cli.rb

# Test
dd --version
dd --help
brew test datadog-cli

# Uninstall
brew uninstall datadog-cli
```

### Step 5: Create Homebrew Tap (Recommended)

A **tap** makes installation easier for users.

#### Option A: Separate Tap Repository

1. **Create new repository**: `homebrew-datadog-cli`

2. **Repository structure**:
   ```
   homebrew-datadog-cli/
   └── Formula/
       └── datadog-cli.rb
   ```

3. **Copy formula**:
   ```bash
   cp Formula/datadog-cli.rb ../homebrew-datadog-cli/Formula/
   ```

4. **Commit and push**:
   ```bash
   cd ../homebrew-datadog-cli
   git init
   git add Formula/datadog-cli.rb
   git commit -m "Add Datadog CLI formula"
   git remote add origin https://github.com/yourusername/homebrew-datadog-cli.git
   git push -u origin main
   ```

5. **Users install with**:
   ```bash
   brew tap yourusername/datadog-cli
   brew install datadog-cli
   ```

#### Option B: Formula in Main Repository

Keep formula in main repo and users install via URL:

```bash
brew install https://raw.githubusercontent.com/yourusername/datadog-cli-go/main/Formula/datadog-cli.rb
```

### Step 6: Submit to Homebrew Core (Optional)

For maximum visibility, submit to [Homebrew/homebrew-core](https://github.com/Homebrew/homebrew-core):

1. **Requirements**:
   - Project must be stable (not beta)
   - Actively maintained
   - Significant user base
   - Passes `brew audit --strict`

2. **Submit PR**:
   ```bash
   # Fork homebrew-core
   # Add Formula/datadog-cli.rb
   # Submit PR
   ```

3. **Benefits**:
   - Users can `brew install datadog-cli` without tap
   - Automatic updates via Homebrew
   - Increased discoverability

---

## Formula Maintenance

### Updating for New Releases

1. **Create new GitHub release** (v0.2.0)

2. **Generate new checksums**:
   ```bash
   ./Formula/generate-checksums.sh 0.2.0 yourusername
   ```

3. **Update formula**:
   - Change `version "0.2.0"`
   - Update SHA256 checksums

4. **Test**:
   ```bash
   brew uninstall datadog-cli
   brew install --formula ./Formula/datadog-cli.rb
   brew test datadog-cli
   ```

5. **Commit and push**:
   ```bash
   git add Formula/datadog-cli.rb
   git commit -m "Update formula to v0.2.0"
   git push
   ```

### Testing Changes

```bash
# Audit formula
brew audit --strict --online Formula/datadog-cli.rb

# Test installation
brew install --formula ./Formula/datadog-cli.rb

# Run formula tests
brew test datadog-cli

# Check for issues
brew doctor
```

---

## Formula Details

### What Gets Installed

1. **Binary**: `/usr/local/bin/dd` (Intel) or `/opt/homebrew/bin/dd` (Apple Silicon)

2. **Bash completion**: `/usr/local/etc/bash_completion.d/dd`

3. **Zsh completion**: `/usr/local/share/zsh/site-functions/_dd`

### Installation Locations

**Intel Macs** (`/usr/local`):
- Binary: `/usr/local/bin/dd`
- Completions: `/usr/local/etc/bash_completion.d/`, `/usr/local/share/zsh/site-functions/`

**Apple Silicon** (`/opt/homebrew`):
- Binary: `/opt/homebrew/bin/dd`
- Completions: `/opt/homebrew/etc/bash_completion.d/`, `/opt/homebrew/share/zsh/site-functions/`

### Uninstallation

```bash
# Uninstall
brew uninstall datadog-cli

# Remove tap
brew untap yourusername/datadog-cli
```

---

## Troubleshooting

### Formula Not Found

```bash
# Update Homebrew
brew update

# If using tap, ensure it's added
brew tap yourusername/datadog-cli
```

### SHA256 Mismatch

This means the binary changed after release. Regenerate checksums:

```bash
./Formula/generate-checksums.sh 0.1.0 yourusername
```

### Completions Not Working

```bash
# Bash: Install bash-completion
brew install bash-completion

# Add to ~/.bashrc or ~/.bash_profile:
[ -f /usr/local/etc/bash_completion ] && . /usr/local/etc/bash_completion

# Zsh: Completions should work automatically
# If not, rebuild completion cache:
rm -f ~/.zcompdump && compinit
```

### Binary Not in PATH

```bash
# Check Homebrew prefix
brew --prefix

# Ensure it's in PATH
echo $PATH | grep $(brew --prefix)/bin

# If not, add to ~/.zshrc or ~/.bashrc:
export PATH="$(brew --prefix)/bin:$PATH"
```

---

## Development

### Testing Formula Locally

```bash
# Install Ruby (Homebrew uses Ruby)
brew install ruby

# Install Homebrew Gem
gem install homebrew

# Lint formula
brew audit --strict Formula/datadog-cli.rb

# Test formula
brew install --formula ./Formula/datadog-cli.rb
brew test datadog-cli
```

### Common Issues

**Issue**: Binary doesn't run
- **Fix**: Check architecture matches (arm64 vs amd64)
- **Fix**: Verify binary is executable: `chmod +x`

**Issue**: Wrong version installed
- **Fix**: Update version in formula
- **Fix**: Clear Homebrew cache: `brew cleanup`

**Issue**: Completions not installed
- **Fix**: Ensure completion files are in release or repository
- **Fix**: Check paths in formula's `install` method

---

## Comparison: Installation Methods

| Method | Pros | Cons |
|--------|------|------|
| **Homebrew** | Easy (`brew install`), auto-updates, completions | macOS only |
| **Manual curl** | Works everywhere, direct | Manual updates, no completions |
| **Build from source** | Latest code, customizable | Requires Go, slow |
| **Docker** | Isolated, reproducible | Overhead, less convenient |

**Recommendation**: Homebrew for macOS users, manual for Linux.

---

## Resources

### Homebrew Documentation
- [Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [Acceptable Formulae](https://docs.brew.sh/Acceptable-Formulae)
- [Taps (Third-Party Repositories)](https://docs.brew.sh/Taps)

### Datadog CLI
- [Main Repository](https://github.com/yourusername/datadog-cli-go)
- [Release](https://github.com/yourusername/datadog-cli-go/releases)
- [Documentation](https://github.com/yourusername/datadog-cli-go/blob/main/README.md)

---

## Example: Complete Release Process

```bash
# 1. Create and push tag
git tag v0.1.0
git push origin v0.1.0

# 2. Wait for GitHub Actions to create release
# Check: https://github.com/yourusername/datadog-cli-go/releases

# 3. Generate checksums
./Formula/generate-checksums.sh 0.1.0 yourusername

# 4. Update formula
vim Formula/datadog-cli.rb
# Update version and SHA256s

# 5. Test locally
brew uninstall datadog-cli || true
brew install --formula ./Formula/datadog-cli.rb
dd --version
brew test datadog-cli

# 6. Commit and push formula
git add Formula/datadog-cli.rb
git commit -m "Update Homebrew formula to v0.1.0"
git push

# 7. If using separate tap, update that too
cp Formula/datadog-cli.rb ../homebrew-datadog-cli/Formula/
cd ../homebrew-datadog-cli
git add Formula/datadog-cli.rb
git commit -m "Update formula to v0.1.0"
git push

# 8. Announce
# Tweet, blog post, update README with brew install command
```

---

**Created**: January 21, 2026 (Iteration 11)
**Status**: Production Ready
**Platform**: macOS (Intel + Apple Silicon)
**Installation Time**: ~10 seconds with Homebrew
