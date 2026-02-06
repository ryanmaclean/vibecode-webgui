#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Docker Client Setup Script for VibeCode Unified VM
# This script configures your macOS environment to use Docker in the VibeCode VM

# Initialize log aggregation
init_log_aggregation


set -e

echo "======================================"
echo "  Docker Client Setup for VibeCode"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Detect shell
SHELL_NAME=$(basename "$SHELL")
case "$SHELL_NAME" in
    bash)
        PROFILE="$HOME/.bash_profile"
        RC_FILE="$HOME/.bashrc"
        ;;
    zsh)
        PROFILE="$HOME/.zshrc"
        RC_FILE="$HOME/.zshrc"
        ;;
    *)
        echo -e "${YELLOW}⚠ Unknown shell: $SHELL_NAME${NC}"
        echo "Defaulting to .profile"
        PROFILE="$HOME/.profile"
        RC_FILE="$HOME/.profile"
        ;;
esac

echo "Detected shell: $SHELL_NAME"
echo "Profile file: $PROFILE"
echo ""

# Step 1: Check if Docker CLI is installed
echo "Step 1: Checking for Docker CLI..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓${NC} Docker CLI found: $DOCKER_VERSION"
else
    echo -e "${RED}✗${NC} Docker CLI not found"
    echo ""
    echo "Would you like to install Docker CLI? (y/n)"
    read -r INSTALL_DOCKER

    if [[ "$INSTALL_DOCKER" =~ ^[Yy]$ ]]; then
        echo "Installing Docker CLI via Homebrew..."
        if command -v brew &> /dev/null; then
            brew install docker
            echo -e "${GREEN}✓${NC} Docker CLI installed"
        else
            echo -e "${RED}✗${NC} Homebrew not found. Please install Homebrew first:"
            echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi
    else
        echo ""
        echo "You can install Docker CLI later with:"
        echo "  brew install docker"
        echo ""
        echo "Note: You don't need Docker Desktop, just the CLI is enough."
        exit 0
    fi
fi
echo ""

# Step 2: Check if VM is running
echo "Step 2: Checking if VibeCode VM is running..."
if nc -z localhost 2375 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Docker daemon accessible on localhost:2375"
else
    echo -e "${YELLOW}⚠${NC} Docker daemon not accessible on localhost:2375"
    echo ""
    echo "Make sure:"
    echo "  1. UnifiedServicesVibeCodeApp is running"
    echo "  2. VM has finished booting (wait 30-60 seconds after launch)"
    echo "  3. Docker service started successfully inside VM"
    echo ""
    echo "Continue anyway? (y/n)"
    read -r CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi
echo ""

# Step 3: Configure DOCKER_HOST
echo "Step 3: Configuring DOCKER_HOST environment variable..."

# Check if already configured
if grep -q "DOCKER_HOST=tcp://localhost:2375" "$PROFILE" 2>/dev/null; then
    echo -e "${YELLOW}⚠${NC} DOCKER_HOST already configured in $PROFILE"
    echo ""
    echo "Would you like to skip this step? (y/n)"
    read -r SKIP_CONFIG
    if [[ "$SKIP_CONFIG" =~ ^[Yy]$ ]]; then
        echo "Skipping configuration..."
    else
        echo "Updating configuration..."
        # Remove old entry
        sed -i.bak '/DOCKER_HOST=tcp:\/\/localhost:2375/d' "$PROFILE"
        # Add new entry
        echo "" >> "$PROFILE"
        echo "# VibeCode Docker Configuration" >> "$PROFILE"
        echo "export DOCKER_HOST=tcp://localhost:2375" >> "$PROFILE"
        echo -e "${GREEN}✓${NC} Configuration updated"
    fi
else
    # Add configuration
    echo "" >> "$PROFILE"
    echo "# VibeCode Docker Configuration" >> "$PROFILE"
    echo "# Added by docker-setup.sh on $(date)" >> "$PROFILE"
    echo "export DOCKER_HOST=tcp://localhost:2375" >> "$PROFILE"
    echo -e "${GREEN}✓${NC} DOCKER_HOST configured in $PROFILE"
fi

# Export for current session
export DOCKER_HOST=tcp://localhost:2375
echo ""

# Step 4: Test connection
echo "Step 4: Testing Docker connection..."
if docker version &> /dev/null; then
    echo -e "${GREEN}✓${NC} Successfully connected to Docker daemon"
    echo ""
    echo "Docker Server Info:"
    docker version | grep -A 5 "Server:"
else
    echo -e "${RED}✗${NC} Failed to connect to Docker daemon"
    echo ""
    echo "Troubleshooting steps:"
    echo "  1. Make sure UnifiedServicesVibeCodeApp is running"
    echo "  2. Check if port 2375 is accessible: nc -z localhost 2375"
    echo "  3. View Docker logs: ssh root@localhost -p 2222 'tail -f /tmp/docker.log'"
    echo "     (password: vibecode)"
    exit 1
fi
echo ""

# Step 5: Test Docker functionality
echo "Step 5: Testing Docker functionality..."
echo "Pulling alpine:latest image (small test image)..."

if docker pull alpine:latest &> /dev/null; then
    echo -e "${GREEN}✓${NC} Successfully pulled alpine:latest"

    echo "Running test container..."
    TEST_OUTPUT=$(docker run --rm alpine:latest echo "Hello from Docker in VibeCode VM!" 2>&1)

    if echo "$TEST_OUTPUT" | grep -q "Hello from Docker"; then
        echo -e "${GREEN}✓${NC} Test container executed successfully"
        echo "  Output: $TEST_OUTPUT"
    else
        echo -e "${YELLOW}⚠${NC} Container ran but output unexpected"
        echo "  Output: $TEST_OUTPUT"
    fi
else
    echo -e "${YELLOW}⚠${NC} Failed to pull alpine image"
    echo "This might be a network issue or Docker daemon issue."
fi
echo ""

# Step 6: Summary
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "Docker is now configured to use the VibeCode VM."
echo ""
echo "Important notes:"
echo "  • Docker host: tcp://localhost:2375"
echo "  • Profile updated: $PROFILE"
echo "  • Current session: DOCKER_HOST is set"
echo ""
echo "To use Docker in a new terminal:"
echo "  1. Open a new terminal (to load the profile)"
echo "  OR"
echo "  2. Run: source $PROFILE"
echo ""
echo "Basic Docker commands:"
echo "  docker images          # List images"
echo "  docker ps              # List containers"
echo "  docker pull <image>    # Pull an image"
echo "  docker run <image>     # Run a container"
echo "  docker info            # Show Docker info"
echo ""
echo "For more information:"
echo "  • Usage guide: DOCKER_USAGE_GUIDE.md"
echo "  • Troubleshooting: DOCKER_TROUBLESHOOTING.md"
echo ""
echo -e "${GREEN}Happy containerizing! 🐳${NC}"
echo ""

# Optional: Create helper aliases
echo "Would you like to add helpful Docker aliases? (y/n)"
read -r ADD_ALIASES

if [[ "$ADD_ALIASES" =~ ^[Yy]$ ]]; then
    echo "" >> "$PROFILE"
    echo "# Docker Aliases (added by docker-setup.sh)" >> "$PROFILE"
    echo "alias dps='docker ps'" >> "$PROFILE"
    echo "alias dpsa='docker ps -a'" >> "$PROFILE"
    echo "alias di='docker images'" >> "$PROFILE"
    echo "alias dv='docker volume ls'" >> "$PROFILE"
    echo "alias dn='docker network ls'" >> "$PROFILE"
    echo "alias dclean='docker system prune -f'" >> "$PROFILE"
    echo "alias dlogs='docker logs'" >> "$PROFILE"
    echo "alias dexec='docker exec -it'" >> "$PROFILE"
    echo "alias dstop='docker stop \$(docker ps -q)'" >> "$PROFILE"
    echo "alias drm='docker rm \$(docker ps -aq)'" >> "$PROFILE"
    echo ""
    echo -e "${GREEN}✓${NC} Aliases added to $PROFILE"
    echo ""
    echo "Available aliases:"
    echo "  dps      # docker ps"
    echo "  dpsa     # docker ps -a"
    echo "  di       # docker images"
    echo "  dv       # docker volume ls"
    echo "  dn       # docker network ls"
    echo "  dclean   # docker system prune -f"
    echo "  dlogs    # docker logs"
    echo "  dexec    # docker exec -it"
    echo "  dstop    # Stop all containers"
    echo "  drm      # Remove all containers"
    echo ""
fi

# Optional: Create docker-compose alias if needed
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓${NC} docker-compose found: $(docker-compose --version)"
else
    echo -e "${YELLOW}⚠${NC} docker-compose not found"
    echo ""
    echo "Would you like to install docker-compose? (y/n)"
    read -r INSTALL_COMPOSE

    if [[ "$INSTALL_COMPOSE" =~ ^[Yy]$ ]]; then
        if command -v brew &> /dev/null; then
            brew install docker-compose
            echo -e "${GREEN}✓${NC} docker-compose installed"
        else
            echo "Please install via: brew install docker-compose"
        fi
    fi
fi

echo ""
echo "Setup script completed successfully!"
echo ""
