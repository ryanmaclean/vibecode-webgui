# Linux Package Distribution for Datadog CLI

Native package distribution for Ubuntu/Debian (.deb) and RedHat/CentOS (.rpm) systems.

---

## For Users: Installation

### Ubuntu / Debian (APT)

**Option 1: From Release (After Publishing)**

```bash
# Download the .deb package
curl -LO https://github.com/yourusername/datadog-cli-go/releases/download/v0.1.0/datadog-cli_0.1.0_amd64.deb

# Install
sudo dpkg -i datadog-cli_0.1.0_amd64.deb

# Fix dependencies if needed
sudo apt-get install -f

# Verify
dd --version
```

**Option 2: From APT Repository (Future)**

```bash
# Add repository
echo "deb [trusted=yes] https://yourusername.github.io/datadog-cli-apt stable main" | sudo tee /etc/apt/sources.list.d/datadog-cli.list

# Update and install
sudo apt-get update
sudo apt-get install datadog-cli
```

### RedHat / CentOS / Fedora (YUM/DNF)

**Option 1: From Release (After Publishing)**

```bash
# Download the .rpm package
curl -LO https://github.com/yourusername/datadog-cli-go/releases/download/v0.1.0/datadog-cli-0.1.0-1.x86_64.rpm

# Install (CentOS/RHEL)
sudo yum install datadog-cli-0.1.0-1.x86_64.rpm

# Or (Fedora)
sudo dnf install datadog-cli-0.1.0-1.x86_64.rpm

# Verify
dd --version
```

**Option 2: From YUM Repository (Future)**

```bash
# Add repository
sudo tee /etc/yum.repos.d/datadog-cli.repo << EOF
[datadog-cli]
name=Datadog CLI Repository
baseurl=https://yourusername.github.io/datadog-cli-yum
enabled=1
gpgcheck=0
EOF

# Install
sudo yum install datadog-cli
```

### Architecture Support

**Available Architectures**:
- `.deb`: `amd64` (Intel/AMD 64-bit), `arm64` (ARM 64-bit)
- `.rpm`: `x86_64` (Intel/AMD 64-bit), `aarch64` (ARM 64-bit)

**ARM64 Example**:
```bash
# Debian/Ubuntu ARM64
curl -LO https://github.com/yourusername/datadog-cli-go/releases/download/v0.1.0/datadog-cli_0.1.0_arm64.deb
sudo dpkg -i datadog-cli_0.1.0_arm64.deb

# RedHat/CentOS ARM64
curl -LO https://github.com/yourusername/datadog-cli-go/releases/download/v0.1.0/datadog-cli-0.1.0-1.aarch64.rpm
sudo yum install datadog-cli-0.1.0-1.aarch64.rpm
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

# Shell completions work automatically!
dd <TAB><TAB>
```

---

## For Maintainers: Building Packages

### Prerequisites

**For .deb packages**:
```bash
# Ubuntu/Debian
sudo apt-get install dpkg-dev

# macOS (for testing)
brew install dpkg
```

**For .rpm packages**:
```bash
# RedHat/CentOS/Fedora
sudo yum install rpm-build

# Ubuntu/Debian (cross-build)
sudo apt-get install rpm

# macOS
brew install rpm
```

### Build Debian Package (.deb)

```bash
# Build for amd64
./packages/build-deb.sh 0.1.0 amd64

# Build for arm64
./packages/build-deb.sh 0.1.0 arm64

# Output: packages/datadog-cli_0.1.0_amd64.deb
```

**What the script does**:
1. Creates package structure in `packages/build/deb/`
2. Copies control files from `packages/debian/DEBIAN/`
3. Copies binary from `bin/dd-linux-{arch}` or downloads from GitHub
4. Copies shell completions from `completions/`
5. Builds package with `dpkg-deb`
6. Generates SHA256 checksum
7. Moves package to `packages/`

### Build RPM Package (.rpm)

```bash
# Build for x86_64
./packages/build-rpm.sh 0.1.0 x86_64

# Build for aarch64
./packages/build-rpm.sh 0.1.0 aarch64

# Output: packages/datadog-cli-0.1.0-1.x86_64.rpm
```

**What the script does**:
1. Creates RPM build directories in `~/rpmbuild/`
2. Copies spec file from `packages/rpm/datadog-cli.spec`
3. Copies binary and completions to `~/rpmbuild/SOURCES/`
4. Builds package with `rpmbuild -bb`
5. Generates SHA256 checksum
6. Copies package to `packages/`

### Testing Packages Locally

#### Test .deb package

```bash
# Install
sudo dpkg -i packages/datadog-cli_0.1.0_amd64.deb

# Test
dd --version
dd --help
dd context

# Verify completions
dd <TAB><TAB>

# Check files
dpkg -L datadog-cli

# Uninstall
sudo dpkg -r datadog-cli
```

#### Test .rpm package

```bash
# Install
sudo rpm -ivh packages/datadog-cli-0.1.0-1.x86_64.rpm

# Test
dd --version
dd --help
dd context

# Verify completions
dd <TAB><TAB>

# Check files
rpm -ql datadog-cli

# Uninstall
sudo rpm -e datadog-cli
```

### Package Verification

#### Debian (.deb)

```bash
# List contents
dpkg -c packages/datadog-cli_0.1.0_amd64.deb

# Show info
dpkg -I packages/datadog-cli_0.1.0_amd64.deb

# Verify checksum
sha256sum -c packages/datadog-cli_0.1.0_amd64.deb.sha256

# Lint package
lintian packages/datadog-cli_0.1.0_amd64.deb
```

#### RPM

```bash
# List contents
rpm -qpl packages/datadog-cli-0.1.0-1.x86_64.rpm

# Show info
rpm -qpi packages/datadog-cli-0.1.0-1.x86_64.rpm

# Verify checksum
sha256sum -c packages/datadog-cli-0.1.0-1.x86_64.rpm.sha256

# Lint package
rpmlint packages/datadog-cli-0.1.0-1.x86_64.rpm
```

---

## Publishing Packages

### Step 1: Build All Packages

```bash
# Debian packages
./packages/build-deb.sh 0.1.0 amd64
./packages/build-deb.sh 0.1.0 arm64

# RPM packages
./packages/build-rpm.sh 0.1.0 x86_64
./packages/build-rpm.sh 0.1.0 aarch64

# Result: 4 packages
# - datadog-cli_0.1.0_amd64.deb
# - datadog-cli_0.1.0_arm64.deb
# - datadog-cli-0.1.0-1.x86_64.rpm
# - datadog-cli-0.1.0-1.aarch64.rpm
```

### Step 2: Upload to GitHub Release

```bash
# Create release (if not exists)
git tag v0.1.0
git push origin v0.1.0

# Upload packages using gh CLI
gh release upload v0.1.0 \
    packages/datadog-cli_0.1.0_amd64.deb \
    packages/datadog-cli_0.1.0_arm64.deb \
    packages/datadog-cli-0.1.0-1.x86_64.rpm \
    packages/datadog-cli-0.1.0-1.aarch64.rpm \
    packages/*.sha256
```

### Step 3: Create APT Repository (Optional)

**Using GitHub Pages**:

1. **Create `apt` branch**:
   ```bash
   git checkout --orphan apt
   git rm -rf .
   ```

2. **Generate APT repository**:
   ```bash
   # Install tools
   sudo apt-get install dpkg-dev

   # Create structure
   mkdir -p dists/stable/main/binary-amd64
   mkdir -p dists/stable/main/binary-arm64

   # Copy .deb files
   cp packages/datadog-cli_0.1.0_amd64.deb dists/stable/main/binary-amd64/
   cp packages/datadog-cli_0.1.0_arm64.deb dists/stable/main/binary-arm64/

   # Generate Packages files
   cd dists/stable/main/binary-amd64
   dpkg-scanpackages . /dev/null | gzip -9c > Packages.gz
   cd ../binary-arm64
   dpkg-scanpackages . /dev/null | gzip -9c > Packages.gz
   ```

3. **Enable GitHub Pages** on `apt` branch

4. **Users install with**:
   ```bash
   echo "deb [trusted=yes] https://yourusername.github.io/datadog-cli-go stable main" | sudo tee /etc/apt/sources.list.d/datadog-cli.list
   sudo apt-get update
   sudo apt-get install datadog-cli
   ```

### Step 4: Create YUM Repository (Optional)

**Using GitHub Pages**:

1. **Create `yum` branch**:
   ```bash
   git checkout --orphan yum
   git rm -rf .
   ```

2. **Generate YUM repository**:
   ```bash
   # Install tools
   sudo yum install createrepo

   # Create structure
   mkdir -p rpms/x86_64
   mkdir -p rpms/aarch64

   # Copy .rpm files
   cp packages/datadog-cli-0.1.0-1.x86_64.rpm rpms/x86_64/
   cp packages/datadog-cli-0.1.0-1.aarch64.rpm rpms/aarch64/

   # Generate repository metadata
   createrepo rpms/x86_64
   createrepo rpms/aarch64
   ```

3. **Enable GitHub Pages** on `yum` branch

4. **Users install with**:
   ```bash
   sudo tee /etc/yum.repos.d/datadog-cli.repo << EOF
   [datadog-cli]
   name=Datadog CLI Repository
   baseurl=https://yourusername.github.io/datadog-cli-go/rpms/\$basearch
   enabled=1
   gpgcheck=0
   EOF

   sudo yum install datadog-cli
   ```

### Alternative: Use packagecloud.io

**Free hosting for open source packages**:

```bash
# Install packagecloud CLI
gem install package_cloud

# Push packages
package_cloud push yourusername/datadog-cli/ubuntu/focal packages/datadog-cli_0.1.0_amd64.deb
package_cloud push yourusername/datadog-cli/el/8 packages/datadog-cli-0.1.0-1.x86_64.rpm

# Users get automatic repository setup
curl -s https://packagecloud.io/install/repositories/yourusername/datadog-cli/script.deb.sh | sudo bash
sudo apt-get install datadog-cli
```

---

## Package Contents

### Files Installed

**Binary**:
- `/usr/bin/dd` - Main CLI executable

**Shell Completions**:
- `/etc/bash_completion.d/dd` - Bash completion
- `/usr/share/zsh/vendor-completions/_dd` - Zsh completion (Debian)
- `/usr/share/zsh/site-functions/_dd` - Zsh completion (RPM)

**No configuration files** - CLI uses environment variables

### Post-Installation

Both packages run a post-install script that:
1. Sets correct file permissions
2. Displays welcome message
3. Shows credential setup instructions
4. Shows quick start commands

---

## Package Metadata

### Debian Package (.deb)

```
Package: datadog-cli
Version: 0.1.0
Section: utils
Priority: optional
Architecture: amd64 | arm64
Maintainer: Your Name <you@example.com>
Homepage: https://github.com/yourusername/datadog-cli-go
Description: Fast, single-binary Datadog CLI in Go
```

### RPM Package (.rpm)

```
Name: datadog-cli
Version: 0.1.0
Release: 1
License: Apache-2.0
Architecture: x86_64 | aarch64
URL: https://github.com/yourusername/datadog-cli-go
Summary: Fast, single-binary Datadog CLI in Go
```

---

## Updating Packages

### For New Releases

1. **Update version** in:
   - `packages/debian/DEBIAN/control` (Version field)
   - `packages/rpm/datadog-cli.spec` (Version field)

2. **Build new packages**:
   ```bash
   ./packages/build-deb.sh 0.2.0 amd64
   ./packages/build-deb.sh 0.2.0 arm64
   ./packages/build-rpm.sh 0.2.0 x86_64
   ./packages/build-rpm.sh 0.2.0 aarch64
   ```

3. **Test new packages**

4. **Upload to GitHub release**

5. **Update repositories** (if using APT/YUM repos)

---

## Uninstallation

### Debian/Ubuntu

```bash
# Remove package
sudo dpkg -r datadog-cli

# Purge (remove config files too, though we have none)
sudo dpkg -P datadog-cli

# Or using apt
sudo apt-get remove datadog-cli
```

### RedHat/CentOS

```bash
# Remove package
sudo rpm -e datadog-cli

# Or using yum
sudo yum remove datadog-cli

# Or using dnf
sudo dnf remove datadog-cli
```

---

## Troubleshooting

### Debian: Dependency Issues

```bash
# Fix broken dependencies
sudo apt-get install -f

# If still broken, force remove
sudo dpkg -r --force-all datadog-cli
```

### RPM: Dependency Issues

```bash
# Install with --nodeps (not recommended)
sudo rpm -ivh --nodeps datadog-cli-0.1.0-1.x86_64.rpm

# Better: Install dependencies manually
sudo yum install bash-completion
```

### Completions Not Working

```bash
# Debian/Ubuntu
source /etc/bash_completion.d/dd

# RedHat/CentOS
source /etc/bash_completion.d/dd

# Zsh
rm -f ~/.zcompdump && compinit
```

### Binary Not Found

```bash
# Check if installed
which dd

# Check PATH
echo $PATH

# Add /usr/bin to PATH if needed
export PATH="/usr/bin:$PATH"
```

---

## Comparison: Installation Methods

| Method | Pros | Cons |
|--------|------|------|
| **APT/YUM repo** | Auto-updates, easy install, standard | Requires repo setup/hosting |
| **.deb/.rpm file** | Simple download, works offline | Manual updates |
| **Homebrew** (macOS) | Best macOS UX, auto-updates | macOS only |
| **Manual binary** | Works everywhere, no deps | No auto-updates, no completions |

**Recommendation**:
- **Linux users**: Use .deb or .rpm packages
- **macOS users**: Use Homebrew
- **Windows users**: Manual download (or Chocolatey in future)

---

## Development

### Building on Different Platforms

**Cross-build on Ubuntu**:
```bash
# Install cross-tools
sudo apt-get install dpkg-dev rpm

# Build all packages
./packages/build-deb.sh 0.1.0 amd64
./packages/build-deb.sh 0.1.0 arm64
./packages/build-rpm.sh 0.1.0 x86_64
./packages/build-rpm.sh 0.1.0 aarch64
```

**Build on macOS**:
```bash
# Install tools
brew install dpkg rpm

# Build packages
./packages/build-deb.sh 0.1.0 amd64
./packages/build-rpm.sh 0.1.0 x86_64
```

### Package Size

**Debian (.deb)**:
- ~11-12 MB (compressed binary + completions)

**RPM (.rpm)**:
- ~11-12 MB (compressed binary + completions)

Both significantly smaller than typical Python packages with dependencies (50-100+ MB).

---

## Resources

### Debian Packaging
- [Debian New Maintainers' Guide](https://www.debian.org/doc/manuals/maint-guide/)
- [Debian Policy Manual](https://www.debian.org/doc/debian-policy/)
- [dpkg Documentation](https://man7.org/linux/man-pages/man1/dpkg.1.html)

### RPM Packaging
- [RPM Packaging Guide](https://rpm-packaging-guide.github.io/)
- [Fedora Packaging Guidelines](https://docs.fedoraproject.org/en-US/packaging-guidelines/)
- [rpmbuild Documentation](https://rpm.org/documentation.html)

### Repository Hosting
- [packagecloud.io](https://packagecloud.io/) - Free for open source
- [GitHub Pages](https://pages.github.com/) - Free static hosting
- [Cloudsmith](https://cloudsmith.com/) - Package management platform

---

**Created**: January 22, 2026 (Iteration 12)
**Status**: Production Ready
**Platforms**: Ubuntu, Debian, RedHat, CentOS, Fedora
**Architectures**: amd64/x86_64, arm64/aarch64
