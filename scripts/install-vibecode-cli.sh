#!/usr/bin/env bash
#
# Installation script for vibecode CLI
#
# Usage: ./install-vibecode-cli.sh [--user]
#
# Options:
#   --user    Install to user directory (~/.local/bin) instead of system-wide
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VIBECODE_SCRIPT="$SCRIPT_DIR/vibecode"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $*"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $*"; }
print_error() { echo -e "${RED}✗${NC} $*"; }
print_info() { echo -e "→ $*"; }

# Parse options
USER_INSTALL=false
if [ "$1" = "--user" ]; then
    USER_INSTALL=true
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  VibeCode CLI Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if vibecode script exists
if [ ! -f "$VIBECODE_SCRIPT" ]; then
    print_error "vibecode script not found: $VIBECODE_SCRIPT"
    exit 1
fi

# Determine installation directory
if [ "$USER_INSTALL" = true ]; then
    INSTALL_DIR="$HOME/.local/bin"
    COMPLETION_DIR="$HOME/.local/share/bash-completion/completions"
    ZSH_COMPLETION_DIR="$HOME/.local/share/zsh/site-functions"
    print_info "Installing to user directory: $INSTALL_DIR"
else
    INSTALL_DIR="/usr/local/bin"
    COMPLETION_DIR="/usr/local/etc/bash_completion.d"
    ZSH_COMPLETION_DIR="/usr/local/share/zsh/site-functions"
    print_info "Installing system-wide to: $INSTALL_DIR"
    print_warning "This may require sudo privileges"
fi

echo ""

# Create directories if needed
if [ "$USER_INSTALL" = true ]; then
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$COMPLETION_DIR"
    mkdir -p "$ZSH_COMPLETION_DIR"
fi

# Install main script
print_info "Installing vibecode CLI..."
if [ "$USER_INSTALL" = true ]; then
    cp "$VIBECODE_SCRIPT" "$INSTALL_DIR/vibecode"
    chmod +x "$INSTALL_DIR/vibecode"
else
    sudo cp "$VIBECODE_SCRIPT" "$INSTALL_DIR/vibecode"
    sudo chmod +x "$INSTALL_DIR/vibecode"
fi
print_success "Installed vibecode to $INSTALL_DIR/vibecode"

# Install bash completion
if [ -f "$SCRIPT_DIR/vibecode-completion.bash" ]; then
    print_info "Installing bash completion..."
    if [ "$USER_INSTALL" = true ]; then
        cp "$SCRIPT_DIR/vibecode-completion.bash" "$COMPLETION_DIR/vibecode"
    else
        if [ ! -d "$COMPLETION_DIR" ]; then
            sudo mkdir -p "$COMPLETION_DIR"
        fi
        sudo cp "$SCRIPT_DIR/vibecode-completion.bash" "$COMPLETION_DIR/vibecode"
    fi
    print_success "Installed bash completion"
fi

# Install zsh completion
if [ -f "$SCRIPT_DIR/vibecode-completion.zsh" ]; then
    print_info "Installing zsh completion..."
    if [ "$USER_INSTALL" = true ]; then
        cp "$SCRIPT_DIR/vibecode-completion.zsh" "$ZSH_COMPLETION_DIR/_vibecode"
    else
        if [ ! -d "$ZSH_COMPLETION_DIR" ]; then
            sudo mkdir -p "$ZSH_COMPLETION_DIR"
        fi
        sudo cp "$SCRIPT_DIR/vibecode-completion.zsh" "$ZSH_COMPLETION_DIR/_vibecode"
    fi
    print_success "Installed zsh completion"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_success "Installation complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if directory is in PATH
if [ "$USER_INSTALL" = true ]; then
    if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
        print_warning "Add $INSTALL_DIR to your PATH:"
        echo ""
        echo "  For bash, add to ~/.bashrc:"
        echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
        echo ""
        echo "  For zsh, add to ~/.zshrc:"
        echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
        echo ""
    fi
fi

# Completion setup instructions
echo "To enable tab completion:"
echo ""
echo "For Bash:"
echo "  Add to ~/.bashrc:"
echo "    source $COMPLETION_DIR/vibecode"
echo ""
echo "For Zsh:"
echo "  Completions will work automatically after restarting your shell"
echo "  (or run: compinit)"
echo ""

# Test installation
print_info "Testing installation..."
if command -v vibecode &> /dev/null; then
    print_success "vibecode command is available!"
    echo ""
    vibecode version
else
    print_warning "vibecode command not found in PATH"
    if [ "$USER_INSTALL" = true ]; then
        print_info "You may need to restart your shell or add $INSTALL_DIR to PATH"
    fi
fi

echo ""
print_info "Quick start:"
echo "  vibecode help      # Show all commands"
echo "  vibecode build     # Build the app"
echo "  vibecode start     # Start VibeCode"
echo "  vibecode status    # Check status"
echo "  vibecode check     # Check services"
echo ""
