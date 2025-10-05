#!/bin/bash

# OpenCode CLI Installation Script for VibeCode Platform
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
OPENCODE_CLI_VERSION="1.0.0"
INSTALL_DIR="/opt/vibecode/ai-cli-tools/opencode"
CONFIG_DIR="/etc/vibecode/opencode"
LOG_FILE="/var/log/vibecode/opencode-cli-install.log"

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

# Function to install OpenAI Python SDK (for OpenCode)
install_opencode_deps() {
    log "Installing OpenCode dependencies..."
    
    # Install required Python packages
    pip3 install --user openai anthropic requests
    
    # Verify installation
    if python3 -c "import openai; import anthropic; import requests; print('Dependencies installed successfully')" 2>/dev/null; then
        log "Dependencies installed successfully"
    else
        error "Failed to install dependencies"
    fi
}

# Function to create OpenCode CLI wrapper
create_opencode_cli() {
    log "Creating OpenCode CLI wrapper..."
    
    cat > "$INSTALL_DIR/opencode" << 'EOF'
#!/usr/bin/env python3
"""
OpenCode CLI for VibeCode Platform
A unified command-line interface for multiple AI code models
"""

import argparse
import json
import sys
import os
import time
from typing import Optional, Dict, Any, List
import requests
import openai
import anthropic

class OpenCodeCLI:
    def __init__(self, api_key: Optional[str] = None):
        """Initialize OpenCode CLI with API key"""
        self.api_key = api_key or os.getenv('OPENCODE_API_KEY')
        if not self.api_key:
            raise ValueError("OpenCode API key is required. Set OPENCODE_API_KEY environment variable or pass --api-key")
        
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')
        
        self.default_model = "gpt-4-turbo"
        self.supported_models = {
            "gpt-4-turbo": "openai",
            "gpt-4": "openai",
            "gpt-3.5-turbo": "openai",
            "claude-3-opus": "anthropic",
            "claude-3-sonnet": "anthropic",
            "claude-3-haiku": "anthropic"
        }
        
        # Initialize clients if API keys are available
        if self.openai_api_key:
            openai.api_key = self.openai_api_key
        
        if self.anthropic_api_key:
            self.anthropic_client = anthropic.Anthropic(api_key=self.anthropic_api_key)
    
    def set_model(self, model_name: str = "gpt-4-turbo") -> bool:
        """Set the model to use"""
        if model_name in self.supported_models:
            self.default_model = model_name
            return True
        else:
            print(f"Error: Unsupported model {model_name}")
            print(f"Supported models: {', '.join(self.supported_models.keys())}")
            return False
    
    def _call_openai(self, messages: List[Dict[str, str]], model: str = "gpt-4-turbo") -> str:
        """Call OpenAI API"""
        if not self.openai_api_key:
            raise ValueError("OpenAI API key is required for this model. Set OPENAI_API_KEY environment variable.")
        
        response = openai.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=4096
        )
        return response.choices[0].message.content
    
    def _call_anthropic(self, system: str, messages: List[Dict[str, str]], model: str = "claude-3-sonnet") -> str:
        """Call Anthropic API"""
        if not self.anthropic_api_key:
            raise ValueError("Anthropic API key is required for this model. Set ANTHROPIC_API_KEY environment variable.")
        
        # Convert messages to Anthropic format
        user_message = next((msg["content"] for msg in messages if msg["role"] == "user"), "")
        
        response = self.anthropic_client.messages.create(
            model=model,
            max_tokens=4096,
            temperature=0.7,
            system=system,
            messages=[
                {"role": "user", "content": user_message}
            ]
        )
        return response.content[0].text
    
    def generate_code(self, prompt: str, language: str = "python", model: str = None) -> str:
        """Generate code based on prompt"""
        model = model or self.default_model
        provider = self.supported_models.get(model)
        
        if not provider:
            raise ValueError(f"Unsupported model: {model}")
        
        full_prompt = f"Generate {language} code for the following request: {prompt}\n\nProvide only the code without explanations:"
        system_msg = f"You are a {language} expert. Generate only code without explanations."
        
        try:
            start_time = time.time()
            
            if provider == "openai":
                result = self._call_openai([
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": full_prompt}
                ], model)
            elif provider == "anthropic":
                result = self._call_anthropic(
                    system_msg,
                    [{"role": "user", "content": full_prompt}],
                    model
                )
            
            latency = time.time() - start_time
            print(f"// Generated using {model} (latency: {latency:.2f}s)\n", file=sys.stderr)
            
            return result
        except Exception as e:
            return f"Error generating code: {e}"
    
    def explain_code(self, code: str, language: str = "python", model: str = None) -> str:
        """Explain the provided code"""
        model = model or self.default_model
        provider = self.supported_models.get(model)
        
        if not provider:
            raise ValueError(f"Unsupported model: {model}")
        
        prompt = f"Explain this {language} code in detail:\n\n{code}"
        system_msg = f"You are a {language} expert. Explain the provided code in detail."
        
        try:
            if provider == "openai":
                return self._call_openai([
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt}
                ], model)
            elif provider == "anthropic":
                return self._call_anthropic(
                    system_msg,
                    [{"role": "user", "content": prompt}],
                    model
                )
        except Exception as e:
            return f"Error explaining code: {e}"
    
    def optimize_code(self, code: str, language: str = "python", model: str = None) -> str:
        """Optimize the provided code"""
        model = model or self.default_model
        provider = self.supported_models.get(model)
        
        if not provider:
            raise ValueError(f"Unsupported model: {model}")
        
        prompt = f"Optimize this {language} code for better performance, readability, and best practices:\n\n{code}\n\nProvide only the optimized code:"
        system_msg = f"You are a {language} expert. Optimize the provided code and return only the optimized code."
        
        try:
            if provider == "openai":
                return self._call_openai([
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt}
                ], model)
            elif provider == "anthropic":
                return self._call_anthropic(
                    system_msg,
                    [{"role": "user", "content": prompt}],
                    model
                )
        except Exception as e:
            return f"Error optimizing code: {e}"
    
    def chat(self, message: str, model: str = None) -> str:
        """Chat with the AI model"""
        model = model or self.default_model
        provider = self.supported_models.get(model)
        
        if not provider:
            raise ValueError(f"Unsupported model: {model}")
        
        try:
            if provider == "openai":
                return self._call_openai([
                    {"role": "user", "content": message}
                ], model)
            elif provider == "anthropic":
                return self._call_anthropic(
                    "You are a helpful assistant.",
                    [{"role": "user", "content": message}],
                    model
                )
        except Exception as e:
            return f"Error in chat: {e}"

def main():
    parser = argparse.ArgumentParser(description="OpenCode CLI for VibeCode Platform")
    parser.add_argument("--api-key", help="OpenCode API key")
    parser.add_argument("--model", default="gpt-4-turbo", 
                        help="Model to use (default: gpt-4-turbo, options: gpt-4-turbo, gpt-4, gpt-3.5-turbo, claude-3-opus, claude-3-sonnet, claude-3-haiku)")
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
    chat_parser = subparsers.add_parser("chat", help="Chat with AI")
    chat_parser.add_argument("message", help="Message to send")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    try:
        cli = OpenCodeCLI(args.api_key)
        
        if not cli.set_model(args.model):
            return
        
        if args.command == "generate":
            result = cli.generate_code(args.prompt, args.language, args.model)
            print(result)
        
        elif args.command == "explain":
            result = cli.explain_code(args.code, args.language, args.model)
            print(result)
        
        elif args.command == "optimize":
            result = cli.optimize_code(args.code, args.language, args.model)
            print(result)
        
        elif args.command == "chat":
            result = cli.chat(args.message, args.model)
            print(result)
    
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
EOF
    
    # Make the script executable
    chmod +x "$INSTALL_DIR/opencode"
    
    # Create symlink to make it available system-wide
    sudo ln -sf "$INSTALL_DIR/opencode" /usr/local/bin/opencode
    
    log "OpenCode CLI wrapper created successfully"
}

# Function to create configuration file
create_config() {
    log "Creating configuration file..."
    
    cat > "$CONFIG_DIR/config.json" << 'EOF'
{
  "default_model": "gpt-4-turbo",
  "available_models": [
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
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

# Uninstall script for OpenCode CLI

set -e

INSTALL_DIR="/opt/vibecode/ai-cli-tools/opencode"
CONFIG_DIR="/etc/vibecode/opencode"

echo "Uninstalling OpenCode CLI..."

# Remove symlink
sudo rm -f /usr/local/bin/opencode

# Remove installation directory
sudo rm -rf "$INSTALL_DIR"

# Remove configuration directory
sudo rm -rf "$CONFIG_DIR"

# Uninstall Python packages
pip3 uninstall -y openai anthropic requests

echo "OpenCode CLI uninstalled successfully"
EOF
    
    chmod +x "$INSTALL_DIR/uninstall.sh"
    log "Uninstall script created successfully"
}

# Function to test installation
test_installation() {
    log "Testing installation..."
    
    # Test if the CLI is accessible
    if command -v opencode &> /dev/null; then
        log "OpenCode CLI is accessible"
    else
        error "OpenCode CLI is not accessible"
    fi
    
    # Test Python imports
    if python3 -c "import openai; import anthropic; import requests; print('Dependencies import test passed')" 2>/dev/null; then
        log "Dependencies import test passed"
    else
        error "Dependencies import test failed"
    fi
    
    log "Installation test completed successfully"
}

# Function to display usage information
display_usage() {
    echo -e "${BLUE}"
    echo "OpenCode CLI Installation Complete!"
    echo "=================================="
    echo ""
    echo "Installation Directory: $INSTALL_DIR"
    echo "Configuration Directory: $CONFIG_DIR"
    echo "Log File: $LOG_FILE"
    echo ""
    echo "Usage Examples:"
    echo "==============="
    echo ""
    echo "1. Generate Python code with GPT-4 Turbo:"
    echo "   opencode generate 'Create a function to calculate fibonacci numbers' --language python --model gpt-4-turbo"
    echo ""
    echo "2. Explain code with Claude:"
    echo "   opencode explain 'def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)' --language python --model claude-3-sonnet"
    echo ""
    echo "3. Optimize code:"
    echo "   opencode optimize 'def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)' --language python"
    echo ""
    echo "4. Chat with OpenCode:"
    echo "   opencode chat 'What are the best practices for Python code optimization?'"
    echo ""
    echo "Configuration:"
    echo "=============="
    echo "Set your API keys:"
    echo "   export OPENCODE_API_KEY='your-api-key-here'"
    echo "   export OPENAI_API_KEY='your-openai-api-key'"  
    echo "   export ANTHROPIC_API_KEY='your-anthropic-api-key'"
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
    echo -e "${BLUE}OpenCode CLI Installation for VibeCode Platform${NC}"
    echo "=================================================="
    echo ""
    
    # Create log file
    sudo mkdir -p "$(dirname "$LOG_FILE")"
    sudo touch "$LOG_FILE"
    sudo chown $USER:$USER "$LOG_FILE"
    
    log "Starting OpenCode CLI installation..."
    
    # Run installation steps
    check_prerequisites
    create_directories
    install_opencode_deps
    create_opencode_cli
    create_config
    create_uninstall_script
    test_installation
    
    log "OpenCode CLI installation completed successfully!"
    
    display_usage
}

# Run main function
main "$@"