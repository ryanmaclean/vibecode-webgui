#!/bin/bash
#
# Python 3.14 Compatibility Setup for VibeCode Demos
#
# This script sets environment variables needed for Python 3.14 compatibility
# with packages that haven't updated their PyO3 dependencies yet
#

export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1

echo "✓ Set PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 for Python 3.14 compatibility"
echo ""
echo "This allows PyO3-based packages (tiktoken, etc.) to build with Python 3.14"
echo ""
echo "To make this permanent for your shell, add to your ~/.zshrc or ~/.bashrc:"
echo "  export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1"
echo ""
