#!/bin/bash

# Claude Code CLI Installation Script for VibeCode Platform
# License: Apache 2.0
# Version: 1.0.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLAUDE_CLI_VERSION="1.0.0"
INSTALL_DIR="/opt/vibecode/ai-cli-tools/claude-code"
CONFIG_DIR="/etc/vibecode/claude-code"
LOG_FILE="/var/log/vibecode/claude-code-cli-install.log"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if running as root or with sudo
    if [[ $EUID -eq 0 ]]; then
        log "Running with root privileges"
    else
        warn "Not running as root. Some operations may require sudo."
    fi
    
    # Check Python version
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        log "Python3 version: $PYTHON_VERSION"
        
        # Check if Python version is 3.8 or higher
        if python3 -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)"; then
            log "Python version is compatible"
        else
            error "Python 3.8 or higher is required"
        fi
    else
        error "Python3 is not installed"
    fi
    
    # Check pip
    if command -v pip3 &> /dev/null; then
        log "pip3 is available"
    else
        error "pip3 is not installed"
    fi
    
    # Check if curl is available
    if command -v curl &> /dev/null; then
        log "curl is available"
    else
        error "curl is not installed"
    fi
}

# Function to create directories
create_directories() {
    log "Creating installation directories..."
    
    sudo mkdir -p "$INSTALL_DIR"
    sudo mkdir -p "$CONFIG_DIR"
    sudo mkdir -p "$(dirname "$LOG_FILE")"
    
    # Set permissions
    sudo chown -R $USER:$USER "$INSTALL_DIR"
    sudo chmod 755 "$INSTALL_DIR"
    sudo chmod 755 "$CONFIG_DIR"
    
    log "Directories created successfully"
}

# Function to install Anthropic Python SDK
install_anthropic_sdk() {
    log "Installing Anthropic Python SDK..."
    
    # Install the Anthropic Python SDK
    pip3 install --user anthropic
    
    # Verify installation
    if python3 -c "import anthropic; print('Anthropic SDK installed successfully')" 2>/dev/null; then
        log "Anthropic SDK installed successfully"
    else
        error "Failed to install Anthropic SDK"
    fi
}

# Function to create Claude Code CLI wrapper
create_claude_cli() {
    log "Creating Claude Code CLI wrapper..."
    
    cat > "$INSTALL_DIR/claude-code" << 'EOF'
#!/usr/bin/env python3
"""
Claude Code CLI for VibeCode Platform
A command-line interface for Anthropic's Claude models
"""

import argparse
import json
import sys
import os
from typing import Optional, Dict, Any
import anthropic

class ClaudeCodeCLI:
    def __init__(self, api_key: Optional[str] = None):
        """Initialize Claude Code CLI with API key"""
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError("Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass --api-key")
        
        self.client = anthropic.Anthropic(api_key=self.api_key)
        self.model = "claude-3-sonnet"
    
    def set_model(self, model_name: str = "claude-3-sonnet"):
        """Set the model to use"""
        try:
            self.model = model_name
            return True
        except Exception as e:
            print(f"Error setting model {model_name}: {e}")
            return False
    
    def generate_code(self, prompt: str, language: str = "python") -> str:
        """Generate code based on prompt"""
        try:
            full_prompt = f"Generate {language} code for the following request: {prompt}\n\nProvide only the code without explanations:"
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=0.7,
                system=f"You are a {language} expert. Generate only code without explanations.",
                messages=[
                    {"role": "user", "content": full_prompt}
                ]
            )
            return response.content[0].text
        except Exception as e:
            return f"Error generating code: {e}"
    
    def explain_code(self, code: str, language: str = "python") -> str:
        """Explain the provided code"""
        try:
            prompt = f"Explain this {language} code in detail:\n\n{code}"
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=0.7,
                system=f"You are a {language} expert. Explain the provided code in detail.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            return response.content[0].text
        except Exception as e:
            return f"Error explaining code: {e}"
    
    def optimize_code(self, code: str, language: str = "python") -> str:
        """Optimize the provided code"""
        try:
            prompt = f"Optimize this {language} code for better performance, readability, and best practices:\n\n{code}\n\nProvide only the optimized code:"
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=0.7,
                system=f"You are a {language} expert. Optimize the provided code and return only the optimized code.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            return response.content[0].text
        except Exception as e:
            return f"Error optimizing code: {e}"
    
    def chat(self, message: str) -> str:
        """Chat with Claude"""
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=0.7,
                messages=[
                    {"role": "user", "content": message}
                ]
            )
            return response.content[0].text
        except Exception as e:
            return f"Error in chat: {e}"

def main():
    parser = argparse.ArgumentParser(description="Claude Code CLI for VibeCode Platform")
    parser.add_argument("--api-key", help="Anthropic API key")
    parser.add_argument("--model", default="claude-3-sonnet", help="Model to use (default: claude-3-sonnet)")
    parser.add_argument("--language", default="python", help="Programming language (default: python)")
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Generate code command
    gen_parser = subparsers.add_parser("generate", help="Generate code")
    gen_parser.add_argument("prompt", help="Code generation prompt")
    
    # Explain code command
    explain_parser = subparsers.add_parser("explain", help="Explain code")
    explain_parser.add_argument("code", help="Code to explain")
    
    # Optimize code command
    optimize_parser = subparsers.add_parser("optimize", help="Optimize code")
    optimize_parser.add_argument("code", help="Code to optimize")
    
    # Chat command
    chat_parser = subparsers.add_parser("chat", help="Chat with Claude")
    chat_parser.add_argument("message", help="Message to send")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    try:
        cli = ClaudeCodeCLI(args.api_key)
        cli.set_model(args.model)
        
        if args.command == "generate":
            result = cli.generate_code(args.prompt, args.language)
            print(result)
        
        elif args.command == "explain":
            result = cli.explain_code(args.code, args.language)
            print(result)
        
        elif args.command == "optimize":
            result = cli.optimize_code(args.code, args.language)
            print(result)
        
        elif args.command == "chat":
            result = cli.chat(args.message)
            print(result)
    
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
EOF
    
    # Make the script executable
    chmod +x "$INSTALL_DIR/claude-code"
    
    # Create symlink to make it available system-wide
    sudo ln -sf "$INSTALL_DIR/claude-code" /usr/local/bin/claude-code
    
    log "Claude Code CLI wrapper created successfully"
}

# Function to create configuration file
create_config() {
    log "Creating configuration file..."
    
    cat > "$CONFIG_DIR/config.json" << 'EOF'
{
  "default_model": "claude-3-sonnet",
  "available_models": [
    "claude-3-opus",
    "claude-3-sonnet",
    "claude-3-haiku"
  ],
  "default_language": "python",
  "supported_languages": [
    "python",
    "javascript",
    "typescript",
    "java",
    "cpp",
    "csharp",
    "go",
    "rust",
    "php",
    "ruby"
  ],
  "max_tokens": 4096,
  "temperature": 0.7,
  "timeout": 30
}
EOF
    
    log "Configuration file created successfully"
}

# Function to create uninstall script
create_uninstall_script() {
    log "Creating uninstall script..."
    
    cat > "$INSTALL_DIR/uninstall.sh" << 'EOF'
#!/bin/bash

# Uninstall script for Claude Code CLI

set -e

INSTALL_DIR="/opt/vibecode/ai-cli-tools/claude-code"
CONFIG_DIR="/etc/vibecode/claude-code"

echo "Uninstalling Claude Code CLI..."

# Remove symlink
sudo rm -f /usr/local/bin/claude-code

# Remove installation directory
sudo rm -rf "$INSTALL_DIR"

# Remove configuration directory
sudo rm -rf "$CONFIG_DIR"

# Uninstall Python package
pip3 uninstall -y anthropic

echo "Claude Code CLI uninstalled successfully"
EOF
    
    chmod +x "$INSTALL_DIR/uninstall.sh"
    log "Uninstall script created successfully"
}

# Function to test installation
test_installation() {
    log "Testing installation..."
    
    # Test if the CLI is accessible
    if command -v claude-code &> /dev/null; then
        log "Claude Code CLI is accessible"
    else
        error "Claude Code CLI is not accessible"
    fi
    
    # Test Python import
    if python3 -c "import anthropic; print('Anthropic SDK import successful')" 2>/dev/null; then
        log "Anthropic SDK import test passed"
    else
        error "Anthropic SDK import test failed"
    fi
    
    log "Installation test completed successfully"
}

# Function to display usage information
display_usage() {
    echo -e "${BLUE}"
    echo "Claude Code CLI Installation Complete!"
    echo "===================================="
    echo ""
    echo "Installation Directory: $INSTALL_DIR"
    echo "Configuration Directory: $CONFIG_DIR"
    echo "Log File: $LOG_FILE"
    echo ""
    echo "Usage Examples:"
    echo "==============="
    echo ""
    echo "1. Generate Python code:"
    echo "   claude-code generate 'Create a function to calculate fibonacci numbers' --language python"
    echo ""
    echo "2. Explain code:"
    echo "   claude-code explain 'def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)' --language python"
    echo ""
    echo "3. Optimize code:"
    echo "   claude-code optimize 'def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)' --language python"
    echo ""
    echo "4. Chat with Claude:"
    echo "   claude-code chat 'What are the best practices for Python code optimization?'"
    echo ""
    echo "Configuration:"
    echo "=============="
    echo "Set your Anthropic API key:"
    echo "   export ANTHROPIC_API_KEY='your-api-key-here'"
    echo ""
    echo "Or edit the configuration file:"
    echo "   $CONFIG_DIR/config.json"
    echo ""
    echo "Uninstall:"
    echo "=========="
    echo "To uninstall, run:"
    echo "   $INSTALL_DIR/uninstall.sh"
    echo -e "${NC}"
}

# Main installation function
main() {
    echo -e "${BLUE}Claude Code CLI Installation for VibeCode Platform${NC}"
    echo "======================================================="
    echo ""
    
    # Create log file
    sudo mkdir -p "$(dirname "$LOG_FILE")"
    sudo touch "$LOG_FILE"
    sudo chown $USER:$USER "$LOG_FILE"
    
    log "Starting Claude Code CLI installation..."
    
    # Run installation steps
    check_prerequisites
    create_directories
    install_anthropic_sdk
    create_claude_cli
    create_config
    create_uninstall_script
    test_installation
    
    log "Claude Code CLI installation completed successfully!"
    
    display_usage
}

# Run main function
main "$@"