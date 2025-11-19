#!/bin/bash

# Test script for Electron app
# This script launches the app and checks if it starts successfully

echo "========================================="
echo "  Testing Electron App Launch"
echo "========================================="
echo ""

cd "$(dirname "$0")"

echo "Starting Electron app..."
echo "This will launch in a GUI window."
echo ""
echo "To test:"
echo "1. Check if window appears"
echo "2. Verify mock VS Code Server loads"
echo "3. Click 'Launch VS Code' button"
echo "4. Close the window when done"
echo ""
echo "Press Ctrl+C to stop"
echo ""

NODE_ENV=development npm start
