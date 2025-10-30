#!/usr/bin/env bash
# Install Ollama in Lima VM (Full Linux with package manager)
# Ollama requires: curl, persistent storage, network access

set -euo pipefail

echo "🦙 Installing Ollama in Lima VM"
echo "================================"
echo ""

# Check if Lima is installed
if ! command -v limactl &> /dev/null; then
    echo "❌ Lima not found. Installing via Homebrew..."
    brew install lima
fi

# Start Lima VM with sufficient resources for Ollama
echo "🚀 Starting Lima VM (ollama-vm)..."
echo "   CPU: 4 cores"
echo "   Memory: 8GB"
echo "   Disk: 50GB (for models)"
echo ""

limactl start --name=ollama-vm \
    --cpus=4 \
    --memory=8 \
    --disk=50 \
    --vm-type=vz \
    template://default 2>&1 || echo "VM already exists"

echo ""
echo "📦 Installing Ollama inside VM..."
echo ""

limactl shell ollama-vm <<'INSTALL_SCRIPT'
echo "=== Inside Lima VM ==="
echo ""

# Update packages
sudo apk update

# Install curl if not present
sudo apk add curl

# Install Ollama
echo "📥 Downloading Ollama installer..."
curl -fsSL https://ollama.com/install.sh | sh

# Verify installation
echo ""
echo "✅ Ollama installed!"
ollama --version

echo ""
echo "🦙 Starting Ollama service..."
ollama serve &
OLLAMA_PID=$!
sleep 3

echo ""
echo "📦 Pulling a small test model (tinyllama - 637MB)..."
ollama pull tinyllama

echo ""
echo "🧪 Testing Ollama..."
echo "Question: What is 2+2?"
ollama run tinyllama "What is 2+2? Answer in one sentence."

echo ""
echo "✅ Ollama is working!"
echo ""
echo "Available commands:"
echo "  ollama list                    # List installed models"
echo "  ollama pull llama3.2           # Download Llama 3.2"
echo "  ollama run llama3.2            # Run model"
echo "  ollama serve                   # Start server"
echo ""
echo "API endpoint: http://localhost:11434"
echo ""
echo "Stopping test service..."
kill $OLLAMA_PID 2>/dev/null || true

INSTALL_SCRIPT

echo ""
echo "✅ Ollama installation complete!"
echo ""
echo "To use Ollama:"
echo "  limactl shell ollama-vm"
echo "  ollama serve                    # Start server"
echo "  ollama run llama3.2            # Run a model"
echo ""
echo "From host machine:"
echo "  curl http://localhost:11434/api/generate -d '{\"model\":\"tinyllama\",\"prompt\":\"Why is the sky blue?\"}'"
echo ""
echo "Popular models:"
echo "  ollama pull llama3.2           # 2GB - Fast, efficient"
echo "  ollama pull codellama          # 3.8GB - Code assistant"
echo "  ollama pull mistral            # 4.1GB - Good general model"
echo "  ollama pull llama3.2:70b       # 40GB - Most capable"

