# VibeCode Desktop - Windows Build Script
# Builds .msi and .exe installers for Windows x86_64

param(
    [string]$BuildType = "release",
    [switch]$SignBuild = $false,
    [switch]$CreateMSI = $true,
    [switch]$CreateNSIS = $true
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }

Write-Success "VibeCode Desktop - Windows Build Script"
Write-Host "========================================="
Write-Host "Build Type: $BuildType"
Write-Host "Sign Build: $SignBuild"
Write-Host "Create MSI: $CreateMSI"
Write-Host "Create NSIS: $CreateNSIS"
Write-Host ""

# Get script directory and project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "../..")

Write-Info "Project Root: $ProjectRoot"
Set-Location $ProjectRoot

# Check prerequisites
Write-Warning "Checking prerequisites..."

# Check for required tools
$tools = @{
    "node" = "Node.js"
    "npm" = "npm"
    "cargo" = "Rust/Cargo"
    "rustc" = "Rust Compiler"
}

foreach ($tool in $tools.Keys) {
    try {
        $version = & $tool --version 2>&1
        Write-Host "✓ $($tools[$tool]): $version"
    } catch {
        Write-Error "Error: $($tools[$tool]) not found"
        exit 1
    }
}

# Check for Visual Studio Build Tools
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vsWhere) {
    $vsPath = & $vsWhere -latest -property installationPath
    Write-Host "✓ Visual Studio: $vsPath"
} else {
    Write-Warning "Warning: Visual Studio not found via vswhere"
    Write-Info "Please ensure Visual Studio 2019+ with C++ build tools is installed"
}

# Check for WiX Toolset (for MSI)
if ($CreateMSI) {
    try {
        $wixVersion = & wix --version 2>&1
        Write-Host "✓ WiX Toolset: $wixVersion"
    } catch {
        Write-Warning "WiX Toolset not found. Installing..."
        & dotnet tool install --global wix --version 5.0.0
    }
}

# Install Rust target
Write-Warning "Installing Rust target..."
$RustTarget = "x86_64-pc-windows-msvc"
& rustup target add $RustTarget

# Install dependencies
Write-Warning "Installing npm dependencies..."
& npm ci --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install npm dependencies"
    exit 1
}

# Build frontend
Write-Warning "Building frontend..."
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build frontend"
    exit 1
}

# Setup environment
$env:NEXT_CONFIG_FILE = "next.config.tauri.js"

# Determine build command
$BuildArgs = @("tauri", "build", "--", "--target", $RustTarget)
if ($BuildType -eq "debug") {
    $BuildArgs += "--debug"
}

# Build Tauri app
Write-Warning "Building Tauri application..."
& npm run @BuildArgs --verbose
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed"
    exit 1
}

Write-Success "✓ Build successful"

# Build artifacts location
$BundleDir = Join-Path $ProjectRoot "src-tauri\target\$RustTarget\$BuildType\bundle"

# Verify build
if (!(Test-Path $BundleDir)) {
    Write-Error "Error: Build failed - bundle directory not found"
    exit 1
}

# Code signing
if ($SignBuild) {
    Write-Warning "Signing installers..."

    if (!$env:WINDOWS_CERTIFICATE_PATH) {
        Write-Error "Error: WINDOWS_CERTIFICATE_PATH not set"
        Write-Info "Set certificate path with: `$env:WINDOWS_CERTIFICATE_PATH = 'path\to\cert.pfx'"
        exit 1
    }

    if (!$env:WINDOWS_CERTIFICATE_PASSWORD) {
        Write-Error "Error: WINDOWS_CERTIFICATE_PASSWORD not set"
        exit 1
    }

    $certPath = $env:WINDOWS_CERTIFICATE_PATH
    $certPassword = $env:WINDOWS_CERTIFICATE_PASSWORD

    # Sign MSI
    if ($CreateMSI -and (Test-Path (Join-Path $BundleDir "msi"))) {
        $msiFiles = Get-ChildItem (Join-Path $BundleDir "msi\*.msi")
        foreach ($msi in $msiFiles) {
            Write-Info "Signing: $($msi.Name)"
            & signtool sign `
                /f $certPath `
                /p $certPassword `
                /tr http://timestamp.digicert.com `
                /td sha256 `
                /fd sha256 `
                $msi.FullName

            if ($LASTEXITCODE -eq 0) {
                Write-Success "✓ Signed: $($msi.Name)"
            } else {
                Write-Warning "Failed to sign: $($msi.Name)"
            }
        }
    }

    # Sign NSIS installer
    if ($CreateNSIS -and (Test-Path (Join-Path $BundleDir "nsis"))) {
        $nsisFiles = Get-ChildItem (Join-Path $BundleDir "nsis\*.exe")
        foreach ($exe in $nsisFiles) {
            Write-Info "Signing: $($exe.Name)"
            & signtool sign `
                /f $certPath `
                /p $certPassword `
                /tr http://timestamp.digicert.com `
                /td sha256 `
                /fd sha256 `
                $exe.FullName

            if ($LASTEXITCODE -eq 0) {
                Write-Success "✓ Signed: $($exe.Name)"
            } else {
                Write-Warning "Failed to sign: $($exe.Name)"
            }
        }
    }
}

# Generate checksums
Write-Warning "Generating checksums..."

function New-Checksum {
    param($FilePath)

    if (Test-Path $FilePath) {
        $hash = Get-FileHash -Path $FilePath -Algorithm SHA256
        $checksumFile = "$FilePath.sha256"
        "$($hash.Hash.ToLower())  $(Split-Path $FilePath -Leaf)" | Out-File -FilePath $checksumFile -Encoding ascii
        Write-Host "✓ Checksum: $(Split-Path $checksumFile -Leaf)"
    }
}

# MSI checksums
if ($CreateMSI -and (Test-Path (Join-Path $BundleDir "msi"))) {
    Get-ChildItem (Join-Path $BundleDir "msi\*.msi") | ForEach-Object {
        New-Checksum $_.FullName
    }
}

# NSIS checksums
if ($CreateNSIS -and (Test-Path (Join-Path $BundleDir "nsis"))) {
    Get-ChildItem (Join-Path $BundleDir "nsis\*.exe") | ForEach-Object {
        New-Checksum $_.FullName
    }
}

# Summary
Write-Host ""
Write-Success "========================================="
Write-Success "Build Complete!"
Write-Success "========================================="
Write-Host ""
Write-Host "Build artifacts:"

# List MSI packages
if ($CreateMSI -and (Test-Path (Join-Path $BundleDir "msi"))) {
    $msiFiles = Get-ChildItem (Join-Path $BundleDir "msi\*.msi")
    foreach ($msi in $msiFiles) {
        $size = "{0:N2} MB" -f ($msi.Length / 1MB)
        Write-Host "  MSI: $($msi.FullName) ($size)"
    }
}

# List NSIS installers
if ($CreateNSIS -and (Test-Path (Join-Path $BundleDir "nsis"))) {
    $nsisFiles = Get-ChildItem (Join-Path $BundleDir "nsis\*.exe")
    foreach ($exe in $nsisFiles) {
        $size = "{0:N2} MB" -f ($exe.Length / 1MB)
        Write-Host "  NSIS: $($exe.FullName) ($size)"
    }
}

Write-Host ""
Write-Success "Installation Instructions:"
Write-Host ""

if ($CreateMSI) {
    Write-Host "MSI Installer (Recommended):"
    Write-Host "  1. Double-click the .msi file"
    Write-Host "  2. Follow the installation wizard"
    Write-Host ""
}

if ($CreateNSIS) {
    Write-Host "NSIS Installer:"
    Write-Host "  1. Run the .exe file"
    Write-Host "  2. Follow the installation wizard"
    Write-Host ""
}

Write-Success "Done!"
