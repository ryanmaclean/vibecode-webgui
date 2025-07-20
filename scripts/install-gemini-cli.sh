#!/bin/bash

# Google Gemini CLI Installation Script for VibeCode Platform
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
GEMINI_CLI_VERSION="1.0.0"
INSTALL_DIR="/opt/vibecode/ai-cli-tools/gemini"
CONFIG_DIR="/etc/vibecode/gemini"
LOG_FILE="/var/log/vibecode/gemini-cli-install.log"

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

# Function to install Google AI Python SDK
install_google_ai_sdk() {
    log "Installing Google AI Python SDK..."
    
    # Install the Google AI Python SDK
    pip3 install --user google-generativeai
    
    # Verify installation
    if python3 -c "import google.generativeai; print('Google AI SDK installed successfully')" 2>/dev/null; then
        log "Google AI SDK installed successfully"
    else
        error "Failed to install Google AI SDK"
    fi
}

# Function to create Gemini CLI wrapper
create_gemini_cli() {
    log "Creating Gemini CLI wrapper..."
    
    cat > "$INSTALL_DIR/gemini-cli" << 'EOF'
#!/usr/bin/env python3
"""
Google Gemini CLI for VibeCode Platform
A command-line interface for Google's Gemini AI models
"""

import argparse
import json
import sys
import os
from typing import Optional, Dict, Any
import google.generativeai as genai

class GeminiCLI:
    def __init__(self, api_key: Optional[str] = None):
        """Initialize Gemini CLI with API key"""
        self.api_key = api_key or os.getenv('GOOGLE_AI_API_KEY')
        if not self.api_key:
            raise ValueError("Google AI API key is required. Set GOOGLE_AI_API_KEY environment variable or pass --api-key")
        
        genai.configure(api_key=self.api_key)
        self.model = None
    
    def set_model(self, model_name: str = "gemini-pro"):
        """Set the model to use"""
        try:
            self.model = genai.GenerativeModel(model_name)
            return True
        except Exception as e:
            print(f"Error setting model {model_name}: {e}")
            return False
    
    def generate_code(self, prompt: str, language: str = "python") -> str:
        """Generate code based on prompt"""
        if not self.model:
            if not self.set_model():
                return "Error: Could not initialize model"
        
        try:
            full_prompt = f"Generate {language} code for the following request: {prompt}\n\nProvide only the code without explanations:"
            response = self.model.generate_content(full_prompt)
            return response.text
        except Exception as e:
            return f"Error generating code: {e}"
    
    def explain_code(self, code: str, language: str = "python") -> str:
        """Explain the provided code"""
        if not self.model:
            if not self.set_model():
                return "Error: Could not initialize model"
        
        try:
            prompt = f"Explain this {language} code in detail:\n\n{code}"
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Error explaining code: {e}"
    
    def optimize_code(self, code: str, language: str = "python") -> str:
        """Optimize the provided code"""
        if not self.model:
            if not self.set_model():
                return "Error: Could not initialize model"
        
        try:
            prompt = f"Optimize this {language} code for better performance, readability, and best practices:\n\n{code}\n\nProvide only the optimized code:"
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Error optimizing code: {e}"
    
    def chat(self, message: str) -> str:
        """Chat with Gemini"""
        if not self.model:
            if not self.set_model():
                return "Error: Could not initialize model"
        
        try:
            response = self.model.generate_content(message)
            return response.text
        except Exception as e:
            return f"Error in chat: {e}"

def main():
    parser = argparse.ArgumentParser(description="Google Gemini CLI for VibeCode Platform")
    parser.add_argument("--api-key", help="Google AI API key")
    parser.add_argument("--model", default="gemini-pro", help="Model to use (default: gemini-pro)")
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
    chat_parser = subparsers.add_parser("chat", help="Chat with Gemini")
    chat_parser.add_argument("message", help="Message to send")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    try:
        cli = GeminiCLI(args.api_key)
        
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
    chmod +x "$INSTALL_DIR/gemini-cli"
    
    # Create symlink to make it available system-wide
    sudo ln -sf "$INSTALL_DIR/gemini-cli" /usr/local/bin/gemini-cli
    
    log "Gemini CLI wrapper created successfully"
}

# Function to create configuration file
create_config() {
    log "Creating configuration file..."
    
    cat > "$CONFIG_DIR/config.json" << 'EOF'
{
  "default_model": "gemini-pro",
  "available_models": [
    "gemini-pro",
    "gemini-1.5-pro"
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

# Function to create VibeCode integration
create_vibecode_integration() {
    log "Creating VibeCode integration..."
    
    # Create TypeScript integration file
    cat > "$INSTALL_DIR/vibecode-integration.ts" << 'EOF'
/**
 * VibeCode Integration for Google Gemini CLI
 * Provides seamless integration with VibeCode platform
 */

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  language?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CodeGenerationRequest {
  prompt: string;
  language?: string;
  context?: string;
}

export interface CodeGenerationResponse {
  code: string;
  explanation?: string;
  model: string;
  tokens: number;
}

export class VibeCodeGeminiIntegration {
  private config: GeminiConfig;
  private cliPath: string;

  constructor(config: GeminiConfig) {
    this.config = config;
    this.cliPath = '/usr/local/bin/gemini-cli';
  }

  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      const command = `${this.cliPath} generate "${request.prompt}" --language ${request.language || 'python'} --model ${this.config.model || 'gemini-pro'}`;
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, GOOGLE_AI_API_KEY: this.config.apiKey }
      });

      if (stderr) {
        throw new Error(stderr);
      }

      return {
        code: stdout.trim(),
        model: this.config.model || 'gemini-pro',
        tokens: 0 // TODO: Implement token counting
      };
    } catch (error) {
      throw new Error(`Gemini CLI error: ${error.message}`);
    }
  }

  async explainCode(code: string, language: string = 'python'): Promise<string> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      const command = `${this.cliPath} explain "${code}" --language ${language} --model ${this.config.model || 'gemini-pro'}`;
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, GOOGLE_AI_API_KEY: this.config.apiKey }
      });

      if (stderr) {
        throw new Error(stderr);
      }

      return stdout.trim();
    } catch (error) {
      throw new Error(`Gemini CLI error: ${error.message}`);
    }
  }

  async optimizeCode(code: string, language: string = 'python'): Promise<string> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      const command = `${this.cliPath} optimize "${code}" --language ${language} --model ${this.config.model || 'gemini-pro'}`;
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, GOOGLE_AI_API_KEY: this.config.apiKey }
      });

      if (stderr) {
        throw new Error(stderr);
      }

      return stdout.trim();
    } catch (error) {
      throw new Error(`Gemini CLI error: ${error.message}`);
    }
  }

  async chat(message: string): Promise<string> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      const command = `${this.cliPath} chat "${message}" --model ${this.config.model || 'gemini-pro'}`;
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, GOOGLE_AI_API_KEY: this.config.apiKey }
      });

      if (stderr) {
        throw new Error(stderr);
      }

      return stdout.trim();
    } catch (error) {
      throw new Error(`Gemini CLI error: ${error.message}`);
    }
  }
}
EOF

    log "VibeCode integration created successfully"
}

# Function to create systemd service (optional)
create_systemd_service() {
    log "Creating systemd service..."
    
    cat > "$INSTALL_DIR/gemini-cli.service" << EOF
[Unit]
Description=Google Gemini CLI Service for VibeCode
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
Environment=GOOGLE_AI_API_KEY=
ExecStart=/usr/local/bin/gemini-cli
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    log "Systemd service file created (not installed by default)"
}

# Function to create uninstall script
create_uninstall_script() {
    log "Creating uninstall script..."
    
    cat > "$INSTALL_DIR/uninstall.sh" << 'EOF'
#!/bin/bash

# Uninstall script for Google Gemini CLI

set -e

INSTALL_DIR="/opt/vibecode/ai-cli-tools/gemini"
CONFIG_DIR="/etc/vibecode/gemini"

echo "Uninstalling Google Gemini CLI..."

# Remove symlink
sudo rm -f /usr/local/bin/gemini-cli

# Remove installation directory
sudo rm -rf "$INSTALL_DIR"

# Remove configuration directory
sudo rm -rf "$CONFIG_DIR"

# Uninstall Python package
pip3 uninstall -y google-generativeai

echo "Google Gemini CLI uninstalled successfully"
EOF

    chmod +x "$INSTALL_DIR/uninstall.sh"
    log "Uninstall script created successfully"
}

# Function to test installation
test_installation() {
    log "Testing installation..."
    
    # Test if the CLI is accessible
    if command -v gemini-cli &> /dev/null; then
        log "Gemini CLI is accessible"
    else
        error "Gemini CLI is not accessible"
    fi
    
    # Test Python import
    if python3 -c "import google.generativeai; print('Google AI SDK import successful')" 2>/dev/null; then
        log "Google AI SDK import test passed"
    else
        error "Google AI SDK import test failed"
    fi
    
    log "Installation test completed successfully"
}

# Function to display usage information
display_usage() {
    echo -e "${BLUE}"
    echo "Google Gemini CLI Installation Complete!"
    echo "========================================"
    echo ""
    echo "Installation Directory: $INSTALL_DIR"
    echo "Configuration Directory: $CONFIG_DIR"
    echo "Log File: $LOG_FILE"
    echo ""
    echo "Usage Examples:"
    echo "==============="
    echo ""
    echo "1. Generate Python code:"
    echo "   gemini-cli generate 'Create a function to calculate fibonacci numbers' --language python"
    echo ""
    echo "2. Explain code:"
    echo "   gemini-cli explain 'def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)' --language python"
    echo ""
    echo "3. Optimize code:"
    echo "   gemini-cli optimize 'def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)' --language python"
    echo ""
    echo "4. Chat with Gemini:"
    echo "   gemini-cli chat 'What are the best practices for Python code optimization?'"
    echo ""
    echo "Configuration:"
    echo "=============="
    echo "Set your Google AI API key:"
    echo "   export GOOGLE_AI_API_KEY='your-api-key-here'"
    echo ""
    echo "Or edit the configuration file:"
    echo "   $CONFIG_DIR/config.json"
    echo ""
    echo "VibeCode Integration:"
    echo "===================="
    echo "The TypeScript integration file is available at:"
    echo "   $INSTALL_DIR/vibecode-integration.ts"
    echo ""
    echo "Uninstall:"
    echo "=========="
    echo "To uninstall, run:"
    echo "   $INSTALL_DIR/uninstall.sh"
    echo -e "${NC}"
}

# Main installation function
main() {
    echo -e "${BLUE}Google Gemini CLI Installation for VibeCode Platform${NC}"
    echo "================================================================"
    echo ""
    
    # Create log file
    sudo mkdir -p "$(dirname "$LOG_FILE")"
    sudo touch "$LOG_FILE"
    sudo chown $USER:$USER "$LOG_FILE"
    
    log "Starting Google Gemini CLI installation..."
    
    # Run installation steps
    check_prerequisites
    create_directories
    install_google_ai_sdk
    create_gemini_cli
    create_config
    create_vibecode_integration
    create_systemd_service
    create_uninstall_script
    test_installation
    
    log "Google Gemini CLI installation completed successfully!"
    
    display_usage
}

# Run main function
main "$@" 