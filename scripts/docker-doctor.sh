#!/bin/bash
# Docker Doctor - Interactive TUI for Docker troubleshooting
# Comprehensive Docker repair and diagnostics tool

set -e

# Colors for TUI
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# TUI Configuration
TERM_WIDTH=$(tput cols 2>/dev/null || echo 80)
DOCKER_APP="/Applications/Docker.app"
DOCKER_PLIST="$HOME/Library/Group Containers/group.com.docker/settings.json"
DOCKER_DATA_DIR="$HOME/Library/Containers/com.docker.docker"

# Functions for TUI elements
print_header() {
    clear
    echo -e "${CYAN}╔$(printf '═%.0s' $(seq 1 $((TERM_WIDTH - 2))))╗${NC}"
    echo -e "${CYAN}║$(printf ' %.0s' $(seq 1 $(((TERM_WIDTH - ${#1} - 2) / 2))))${WHITE}${BOLD}$1${NC}$(printf ' %.0s' $(seq 1 $(((TERM_WIDTH - ${#1} - 2) / 2))))${CYAN}║${NC}"
    echo -e "${CYAN}╚$(printf '═%.0s' $(seq 1 $((TERM_WIDTH - 2))))╝${NC}"
    echo ""
}

print_section() {
    echo -e "${YELLOW}▶ $1${NC}"
    echo -e "${BLUE}$(printf '─%.0s' $(seq 1 ${#1}))${NC}"
}

print_step() {
    echo -e "  ${GREEN}●${NC} $1"
}

print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
}

print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "  ${CYAN}ℹ${NC} $1"
}

wait_for_input() {
    echo ""
    read -p "Press ENTER to continue or 'q' to quit: " choice
    if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
        echo -e "\n${YELLOW}Exiting Docker Doctor...${NC}"
        exit 0
    fi
}

show_menu() {
    local title="$1"
    shift
    local options=("$@")
    
    print_header "$title"
    
    for i in "${!options[@]}"; do
        echo -e "  ${WHITE}$((i + 1)).${NC} ${options[i]}"
    done
    
    echo ""
    read -p "Select option (1-${#options[@]}) or 'q' to quit: " choice
    
    if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
        echo -e "\n${YELLOW}Exiting Docker Doctor...${NC}"
        exit 0
    fi
    
    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#options[@]}" ]; then
        return $((choice - 1))
    else
        echo -e "\n${RED}Invalid selection. Please try again.${NC}"
        sleep 2
        show_menu "$title" "${options[@]}"
        return $?
    fi
}

# Docker diagnostic functions
check_docker_installation() {
    print_section "Checking Docker Installation"
    
    if [ -d "$DOCKER_APP" ]; then
        print_success "Docker Desktop app found at: $DOCKER_APP"
        
        # Check version
        if [ -f "$DOCKER_APP/Contents/Info.plist" ]; then
            VERSION=$(defaults read "$DOCKER_APP/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || echo "Unknown")
            print_info "Docker Desktop version: $VERSION"
        fi
    else
        print_error "Docker Desktop not found at: $DOCKER_APP"
        print_info "Download from: https://www.docker.com/products/docker-desktop/"
        return 1
    fi
    
    # Check CLI
    if command -v docker >/dev/null 2>&1; then
        print_success "Docker CLI found: $(which docker)"
        CLI_VERSION=$(docker --version 2>/dev/null || echo "CLI not responding")
        print_info "CLI Version: $CLI_VERSION"
    else
        print_warning "Docker CLI not found in PATH"
    fi
    
    return 0
}

check_docker_daemon() {
    print_section "Checking Docker Daemon Status"
    
    # Quick daemon check
    if timeout 5s docker info >/dev/null 2>&1; then
        print_success "Docker daemon is running and responding"
        
        # Show daemon info
        print_info "Daemon details:"
        docker info --format "    Server Version: {{.ServerVersion}}" 2>/dev/null || true
        docker info --format "    Total Memory: {{.MemTotal | humanSize}}" 2>/dev/null || true
        docker info --format "    CPUs: {{.NCPU}}" 2>/dev/null || true
        docker info --format "    Containers: {{.Containers}} ({{.ContainersRunning}} running)" 2>/dev/null || true
        
        return 0
    else
        print_error "Docker daemon is not responding"
        return 1
    fi
}

check_docker_resources() {
    print_section "Checking System Resources"
    
    # Check memory
    if command -v vm_stat >/dev/null 2>&1; then
        TOTAL_MEM=$(sysctl -n hw.memsize 2>/dev/null || echo "0")
        if [ "$TOTAL_MEM" -gt 0 ]; then
            TOTAL_GB=$((TOTAL_MEM / 1024 / 1024 / 1024))
            print_info "Total system memory: ${TOTAL_GB}GB"
            
            if [ "$TOTAL_GB" -lt 4 ]; then
                print_warning "Low system memory (Docker recommends 4GB+)"
            else
                print_success "Sufficient system memory for Docker"
            fi
        fi
    fi
    
    # Check disk space
    DISK_AVAIL=$(df -h "$HOME" | tail -1 | awk '{print $4}')
    print_info "Available disk space: $DISK_AVAIL"
    
    # Check if Docker is using too much space
    if [ -d "$DOCKER_DATA_DIR" ]; then
        DOCKER_SIZE=$(du -sh "$DOCKER_DATA_DIR" 2>/dev/null | cut -f1 || echo "Unknown")
        print_info "Docker data directory size: $DOCKER_SIZE"
    fi
}

check_virtualization_support() {
    print_section "Checking Virtualization Support"
    
    # Check Hypervisor Framework support
    HV_SUPPORT=$(sysctl -n kern.hv_support 2>/dev/null || echo "0")
    if [ "$HV_SUPPORT" = "1" ]; then
        print_success "Apple Hypervisor Framework is supported"
    else
        print_error "Apple Hypervisor Framework NOT supported"
        print_info "Docker Desktop requires Hypervisor Framework support"
        return 1
    fi
    
    # Check CPU architecture
    CPU_ARCH=$(uname -m)
    print_info "CPU Architecture: $CPU_ARCH"
    
    if [ "$CPU_ARCH" = "arm64" ]; then
        print_info "Apple Silicon Mac detected"
        
        # Check for Rosetta 2
        if command -v arch >/dev/null 2>&1; then
            if arch -x86_64 /usr/bin/true 2>/dev/null; then
                print_success "Rosetta 2 is available"
            else
                print_warning "Rosetta 2 not installed (may affect x86_64 containers)"
                print_info "Install with: softwareupdate --install-rosetta"
            fi
        fi
        
        print_info "Note: QEMU virtualization deprecated (use Docker VMM or Apple Virtualization)"
    else
        print_info "Intel Mac detected"
        print_warning "HyperKit will be deprecated in future releases"
    fi
    
    # Check macOS version compatibility
    if command -v sw_vers >/dev/null 2>&1; then
        MACOS_VERSION=$(sw_vers -productVersion)
        MAJOR_VERSION=$(echo "$MACOS_VERSION" | cut -d. -f1)
        print_info "macOS Version: $MACOS_VERSION"
        
        if [ "$MAJOR_VERSION" -ge 11 ]; then
            print_success "macOS version supports modern virtualization"
        else
            print_error "macOS version too old (requires Big Sur 11.0+)"
            return 1
        fi
    fi
    
    return 0
}

check_competing_virtualization() {
    print_section "Checking for Competing Virtualization Software"
    
    # Check for VirtualBox
    if command -v VBoxManage >/dev/null 2>&1 || [ -d "/Applications/VirtualBox.app" ]; then
        print_warning "VirtualBox detected - may conflict with Docker hypervisor"
        
        # Check if VirtualBox VMs are running
        if command -v VBoxManage >/dev/null 2>&1; then
            RUNNING_VMS=$(VBoxManage list runningvms 2>/dev/null | wc -l)
            if [ "$RUNNING_VMS" -gt 0 ]; then
                print_error "VirtualBox has $RUNNING_VMS running VMs - STOP these first"
            else
                print_info "No VirtualBox VMs currently running"
            fi
        fi
    fi
    
    # Check for VMware Fusion
    if [ -d "/Applications/VMware Fusion.app" ] || pgrep -f "VMware" >/dev/null 2>&1; then
        print_warning "VMware Fusion detected - may conflict with Docker"
        
        if pgrep -f "VMware" >/dev/null 2>&1; then
            print_error "VMware processes running - conflicts with Docker hypervisor"
        fi
    fi
    
    # Check for Parallels Desktop
    if [ -d "/Applications/Parallels Desktop.app" ] || pgrep -f "Parallels" >/dev/null 2>&1; then
        print_warning "Parallels Desktop detected - may compete for resources"
        
        if pgrep -f "Parallels" >/dev/null 2>&1; then
            print_warning "Parallels processes running - may impact Docker performance"
        fi
    fi
    
    # Check for UTM (virtualized macOS)
    if [ -d "/Applications/UTM.app" ] || pgrep -f "UTM" >/dev/null 2>&1; then
        print_info "UTM detected"
        
        # Check if running inside a VM
        if system_profiler SPHardwareDataType | grep -q "Virtual"; then
            print_error "Running inside virtualized macOS - Docker may fail with 'Hypervisor check failed'"
            print_info "Docker Desktop doesn't work reliably in virtualized macOS environments"
        fi
    fi
}

diagnose_docker_issues() {
    print_header "🔍 Docker Diagnostic Scan"
    
    echo -e "${CYAN}Running comprehensive Docker diagnostics...${NC}"
    echo ""
    
    # Virtualization support check (critical first)
    VIRT_OK=true
    if ! check_virtualization_support; then
        VIRT_OK=false
        print_error "Critical virtualization issues detected"
    fi
    
    echo ""
    
    # Competing virtualization check
    check_competing_virtualization
    
    echo ""
    
    # Installation check
    INSTALL_OK=true
    if ! check_docker_installation; then
        INSTALL_OK=false
        print_error "Docker installation issues detected"
    fi
    
    echo ""
    
    # Daemon check
    DAEMON_OK=true
    if ! check_docker_daemon; then
        DAEMON_OK=false
        print_error "Docker daemon issues detected"
    fi
    
    echo ""
    
    # Resource check
    check_docker_resources
    
    echo ""
    
    # Process check
    print_section "Checking Docker Processes"
    
    DOCKER_PROCS=$(pgrep -f "Docker" | wc -l)
    if [ "$DOCKER_PROCS" -gt 0 ]; then
        print_success "Found $DOCKER_PROCS Docker-related processes"
        print_info "Docker processes:"
        pgrep -fl "Docker" | head -5 | sed 's/^/    /'
    else
        print_warning "No Docker processes found"
    fi
    
    echo ""
    
    # Port check
    print_section "Checking Docker Ports"
    
    for port in 2375 2376; do
        if lsof -ti:$port >/dev/null 2>&1; then
            print_info "Port $port is in use (Docker daemon port)"
        fi
    done
    
    # Summary
    echo ""
    print_section "Diagnostic Summary"
    
    if [ "$VIRT_OK" = false ]; then
        print_error "CRITICAL: Virtualization not supported - Docker cannot work"
        print_info "Your Mac may not support Docker Desktop or has conflicting virtualization software"
    elif [ "$INSTALL_OK" = false ]; then
        print_error "Installation issues detected - reinstall Docker Desktop"
    elif [ "$DAEMON_OK" = false ]; then
        print_error "Docker daemon issues detected - try restart or preference reset"
    else
        print_success "Docker appears to be working correctly!"
        print_info "If you're still having issues, try the repair options."
    fi
    
    wait_for_input
}

restart_docker_desktop() {
    print_header "🔄 Restarting Docker Desktop"
    
    print_step "Step 1: Stopping Docker Desktop..."
    
    # Kill Docker processes
    print_info "Terminating Docker processes..."
    pkill -f "Docker Desktop" 2>/dev/null || true
    pkill -f "com.docker" 2>/dev/null || true
    
    sleep 3
    
    # Check if processes are gone
    if pgrep -f "Docker" >/dev/null 2>&1; then
        print_warning "Some Docker processes still running, forcing termination..."
        pkill -9 -f "Docker" 2>/dev/null || true
        sleep 2
    fi
    
    print_success "Docker processes terminated"
    
    print_step "Step 2: Starting Docker Desktop..."
    
    if [ -f "$DOCKER_APP/Contents/MacOS/Docker Desktop" ]; then
        open "$DOCKER_APP"
        print_info "Docker Desktop application launched"
    else
        print_error "Docker Desktop executable not found"
        wait_for_input
        return 1
    fi
    
    print_step "Step 3: Waiting for Docker daemon to start..."
    
    echo -n "  "
    for i in {1..60}; do
        if timeout 2s docker info >/dev/null 2>&1; then
            echo ""
            print_success "Docker daemon is now responding!"
            docker --version
            wait_for_input
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo ""
    print_error "Docker daemon failed to start within 60 seconds"
    print_info "This may indicate a deeper issue requiring preferences reset"
    
    wait_for_input
    return 1
}

reset_docker_preferences() {
    print_header "⚠️  Reset Docker Preferences"
    
    echo -e "${YELLOW}WARNING: This will reset ALL Docker settings to defaults!${NC}"
    echo -e "${YELLOW}You will lose:${NC}"
    echo -e "  • Custom resource allocations (CPU, memory)"
    echo -e "  • Network settings"
    echo -e "  • Registry configurations"
    echo -e "  • Experimental features settings"
    echo -e "  • File sharing configurations"
    echo ""
    echo -e "${WHITE}Your images and containers will NOT be deleted.${NC}"
    echo ""
    
    read -p "Are you sure you want to reset Docker preferences? (type 'yes' to confirm): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        echo -e "\n${CYAN}Preferences reset cancelled.${NC}"
        wait_for_input
        return 0
    fi
    
    print_step "Step 1: Stopping Docker Desktop..."
    pkill -f "Docker" 2>/dev/null || true
    sleep 3
    
    print_step "Step 2: Backing up current preferences..."
    
    BACKUP_DIR="$HOME/.docker-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup settings
    if [ -f "$DOCKER_PLIST" ]; then
        cp "$DOCKER_PLIST" "$BACKUP_DIR/settings.json.backup" 2>/dev/null || true
        print_info "Settings backed up to: $BACKUP_DIR"
    fi
    
    print_step "Step 3: Removing Docker preference files..."
    
    # Remove main settings
    rm -f "$DOCKER_PLIST" 2>/dev/null || true
    rm -rf "$HOME/Library/Group Containers/group.com.docker" 2>/dev/null || true
    
    # Remove preference files (.plist)
    rm -f "$HOME/Library/Preferences/com.docker.docker.plist" 2>/dev/null || true
    rm -f "$HOME/Library/Preferences/com.electron.docker-frontend.plist" 2>/dev/null || true
    rm -f "$HOME/Library/Preferences/com.electron.dockerdesktop.plist" 2>/dev/null || true
    
    # Remove application support files
    rm -rf "$HOME/Library/Application Support/Docker Desktop" 2>/dev/null || true
    rm -rf "$HOME/Library/Application Support/com.bugsnag.Bugsnag/com.docker.docker" 2>/dev/null || true
    
    # Remove saved application state
    rm -rf "$HOME/Library/Saved Application State/com.electron.docker-frontend.savedState" 2>/dev/null || true
    rm -rf "$HOME/Library/Saved Application State/com.electron.dockerdesktop.savedState" 2>/dev/null || true
    
    # Remove caches
    rm -rf "$HOME/Library/Caches/com.docker.docker" 2>/dev/null || true
    rm -rf "$HOME/Library/Caches/Docker Desktop" 2>/dev/null || true
    rm -rf "$HOME/Library/Caches/docker-compose" 2>/dev/null || true
    
    # Remove HTTP storages
    rm -rf "$HOME/Library/HTTPStorages/com.docker.docker" 2>/dev/null || true
    
    # Remove application scripts
    rm -rf "$HOME/Library/Application Scripts/group.com.docker" 2>/dev/null || true
    
    # Remove cookies
    rm -f "$HOME/Library/Cookies/com.docker.docker.binarycookies" 2>/dev/null || true
    
    # Remove logs
    rm -rf "$HOME/Library/Logs/Docker Desktop" 2>/dev/null || true
    
    print_success "Docker preferences removed"
    
    print_step "Step 4: Starting Docker Desktop with fresh preferences..."
    
    open "$DOCKER_APP"
    
    print_info "Docker Desktop will now start with default settings"
    print_info "You may need to go through the initial setup wizard"
    
    print_step "Step 5: Waiting for Docker daemon..."
    
    echo -n "  "
    for i in {1..90}; do
        if timeout 3s docker info >/dev/null 2>&1; then
            echo ""
            print_success "Docker daemon is responding with fresh preferences!"
            print_info "Backup created at: $BACKUP_DIR"
            wait_for_input
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo ""
    print_warning "Docker daemon taking longer than expected to start"
    print_info "This is normal after a preferences reset"
    print_info "Check Docker Desktop UI for setup wizard"
    
    wait_for_input
}

clean_docker_data() {
    print_header "🧹 Clean Docker Data"
    
    echo -e "${CYAN}This will clean up Docker data to free space and resolve issues.${NC}"
    echo ""
    
    # Show current usage
    if timeout 5s docker info >/dev/null 2>&1; then
        print_info "Current Docker disk usage:"
        if command -v docker >/dev/null 2>&1; then
            docker system df 2>/dev/null | sed 's/^/  /' || print_warning "Unable to get disk usage"
        fi
        echo ""
    fi
    
    # Cleaning options
    options=(
        "Clean unused containers, networks, and images (safe)"
        "Clean all stopped containers and unused networks"
        "Clean all unused images (including tagged ones)"
        "Nuclear clean - remove EVERYTHING (containers, images, volumes)"
        "Back to main menu"
    )
    
    show_menu "Docker Cleaning Options" "${options[@]}"
    local choice=$?
    
    case $choice in
        0)  # Safe clean
            print_step "Running safe cleanup (unused resources only)..."
            docker system prune -f 2>/dev/null || print_error "Failed to run system prune"
            print_success "Safe cleanup completed"
            ;;
        1)  # Clean containers and networks
            print_step "Cleaning stopped containers and unused networks..."
            docker container prune -f 2>/dev/null || print_error "Failed to clean containers"
            docker network prune -f 2>/dev/null || print_error "Failed to clean networks"
            print_success "Containers and networks cleaned"
            ;;
        2)  # Clean images
            print_step "Cleaning all unused images..."
            docker image prune -a -f 2>/dev/null || print_error "Failed to clean images"
            print_success "Images cleaned"
            ;;
        3)  # Nuclear clean
            echo -e "\n${RED}WARNING: This will delete ALL Docker data!${NC}"
            read -p "Type 'NUKE' to confirm: " confirm
            if [[ "$confirm" == "NUKE" ]]; then
                print_step "Nuclear cleanup in progress..."
                docker system prune -a -f --volumes 2>/dev/null || print_error "Failed to nuke Docker data"
                print_success "Nuclear cleanup completed - Docker is now empty"
            else
                print_info "Nuclear cleanup cancelled"
            fi
            ;;
        4)  # Back to menu
            return 0
            ;;
    esac
    
    # Show new usage
    echo ""
    if timeout 5s docker info >/dev/null 2>&1; then
        print_info "Docker disk usage after cleanup:"
        docker system df 2>/dev/null | sed 's/^/  /' || print_warning "Unable to get disk usage"
    fi
    
    wait_for_input
}

reinstall_docker() {
    print_header "🔄 Reinstall Docker Desktop"
    
    echo -e "${RED}WARNING: This will completely remove and reinstall Docker Desktop!${NC}"
    echo ""
    echo -e "${YELLOW}What will happen:${NC}"
    echo -e "  • Docker Desktop app will be deleted"
    echo -e "  • All Docker settings will be lost"
    echo -e "  • All containers, images, and volumes will be deleted"
    echo -e "  • Fresh Docker Desktop will be downloaded and installed"
    echo ""
    
    read -p "Are you sure you want to reinstall Docker? (type 'REINSTALL' to confirm): " confirm
    
    if [[ "$confirm" != "REINSTALL" ]]; then
        echo -e "\n${CYAN}Reinstall cancelled.${NC}"
        wait_for_input
        return 0
    fi
    
    print_step "Step 1: Stopping Docker Desktop..."
    pkill -f "Docker" 2>/dev/null || true
    sleep 5
    
    print_step "Step 2: Running official Docker uninstaller..."
    if [ -f "$DOCKER_APP/Contents/MacOS/uninstall" ]; then
        print_info "Using official Docker uninstaller..."
        "$DOCKER_APP/Contents/MacOS/uninstall" 2>/dev/null || true
        print_success "Official uninstaller completed"
    else
        print_info "Official uninstaller not found, proceeding with manual removal"
    fi
    
    print_step "Step 3: Removing Docker Desktop application..."
    if [ -d "$DOCKER_APP" ]; then
        rm -rf "$DOCKER_APP"
        print_success "Docker Desktop app removed"
    else
        print_info "Docker Desktop app not found (already removed?)"
    fi
    
    print_step "Step 4: Complete cleanup of Docker data and preferences..."
    
    # Main containers and groups
    rm -rf "$HOME/Library/Group Containers/group.com.docker" 2>/dev/null || true
    rm -rf "$HOME/Library/Containers/com.docker.docker" 2>/dev/null || true
    
    # Preference files (.plist)
    rm -f "$HOME/Library/Preferences/com.docker.docker.plist" 2>/dev/null || true
    rm -f "$HOME/Library/Preferences/com.electron.docker-frontend.plist" 2>/dev/null || true
    rm -f "$HOME/Library/Preferences/com.electron.dockerdesktop.plist" 2>/dev/null || true
    
    # Application support files
    rm -rf "$HOME/Library/Application Support/Docker Desktop" 2>/dev/null || true
    rm -rf "$HOME/Library/Application Support/com.bugsnag.Bugsnag/com.docker.docker" 2>/dev/null || true
    
    # Saved application state
    rm -rf "$HOME/Library/Saved Application State/com.electron.docker-frontend.savedState" 2>/dev/null || true
    rm -rf "$HOME/Library/Saved Application State/com.electron.dockerdesktop.savedState" 2>/dev/null || true
    
    # Caches
    rm -rf "$HOME/Library/Caches/com.docker.docker" 2>/dev/null || true
    rm -rf "$HOME/Library/Caches/Docker Desktop" 2>/dev/null || true
    rm -rf "$HOME/Library/Caches/docker-compose" 2>/dev/null || true
    
    # HTTP storages and other data
    rm -rf "$HOME/Library/HTTPStorages/com.docker.docker" 2>/dev/null || true
    rm -rf "$HOME/Library/Application Scripts/group.com.docker" 2>/dev/null || true
    rm -f "$HOME/Library/Cookies/com.docker.docker.binarycookies" 2>/dev/null || true
    rm -rf "$HOME/Library/Logs/Docker Desktop" 2>/dev/null || true
    
    # User Docker directory
    rm -rf "$HOME/.docker" 2>/dev/null || true
    
    print_success "Complete Docker cleanup finished"
    
    print_step "Step 5: System-level cleanup (optional)..."
    echo -e "\n${YELLOW}Note: Some system-level files may remain and require manual removal:${NC}"
    echo -e "  • /Library/PrivilegedHelperTools/com.docker.vmnetd"
    echo -e "  • /Library/PrivilegedHelperTools/com.docker.socket"
    echo -e "  • /Library/LaunchDaemons/com.docker.socket.plist"
    echo -e "  • /Library/LaunchDaemons/com.docker.vmnetd.plist"
    echo ""
    echo -e "${CYAN}To remove these (requires admin password):${NC}"
    echo -e "  sudo rm -rf /Library/PrivilegedHelperTools/com.docker.*"
    echo -e "  sudo rm -f /Library/LaunchDaemons/com.docker.*.plist"
    echo ""
    
    print_step "Step 6: Downloading Docker Desktop..."
    echo -e "\n${CYAN}Please download and install Docker Desktop manually:${NC}"
    echo -e "  1. Go to: ${WHITE}https://www.docker.com/products/docker-desktop/${NC}"
    echo -e "  2. Download Docker Desktop for Mac"
    echo -e "  3. Install the downloaded .dmg file"
    echo -e "  4. Launch Docker Desktop"
    echo -e "  5. Complete the setup wizard"
    echo ""
    
    print_info "After installation, run this tool again to verify everything works"
    
    # Try to open download page
    if command -v open >/dev/null 2>&1; then
        read -p "Open Docker Desktop download page now? (y/n): " open_page
        if [[ "$open_page" == "y" || "$open_page" == "Y" ]]; then
            open "https://www.docker.com/products/docker-desktop/"
        fi
    fi
    
    wait_for_input
}

run_quick_fixes() {
    print_header "🔧 Quick Docker Fixes"
    
    print_step "Running quick diagnostic and repair sequence..."
    echo ""
    
    # Fix 1: Reset Docker daemon
    print_info "Fix 1: Resetting Docker daemon socket..."
    sudo rm -f /var/run/docker.sock 2>/dev/null || true
    
    # Fix 2: Clear Docker CLI cache
    print_info "Fix 2: Clearing Docker CLI cache..."
    rm -rf "$HOME/.docker/cli-plugins-metadata" 2>/dev/null || true
    
    # Fix 3: Reset Docker context
    print_info "Fix 3: Resetting Docker context..."
    docker context use default 2>/dev/null || true
    
    # Fix 4: Restart Docker service (if running on Linux in VM)
    if command -v systemctl >/dev/null 2>&1; then
        print_info "Fix 4: Restarting Docker service..."
        sudo systemctl restart docker 2>/dev/null || true
    fi
    
    # Fix 5: Clear DNS cache (can affect Docker)
    print_info "Fix 5: Flushing DNS cache..."
    sudo dscacheutil -flushcache 2>/dev/null || true
    sudo killall -HUP mDNSResponder 2>/dev/null || true
    
    # Fix 6: Restart Docker Desktop
    print_info "Fix 6: Restarting Docker Desktop..."
    pkill -f "Docker" 2>/dev/null || true
    sleep 3
    open "$DOCKER_APP" 2>/dev/null || true
    
    print_step "Waiting for Docker to stabilize..."
    sleep 10
    
    # Test if fixes worked
    if timeout 10s docker info >/dev/null 2>&1; then
        print_success "Quick fixes successful! Docker is now responding."
        docker --version
    else
        print_warning "Quick fixes didn't resolve the issue. Try advanced options."
    fi
    
    wait_for_input
}

show_logs_and_diagnostics() {
    print_header "📋 Docker Logs & Diagnostics"
    
    print_step "Gathering Docker diagnostic information..."
    echo ""
    
    # System info
    print_info "System Information:"
    echo "    OS: $(uname -s) $(uname -r)"
    echo "    Architecture: $(uname -m)"
    if command -v sw_vers >/dev/null 2>&1; then
        echo "    macOS: $(sw_vers -productVersion)"
    fi
    echo ""
    
    # Docker installation
    print_info "Docker Installation:"
    if [ -d "$DOCKER_APP" ]; then
        echo "    App Location: $DOCKER_APP"
        if [ -f "$DOCKER_APP/Contents/Info.plist" ]; then
            VERSION=$(defaults read "$DOCKER_APP/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || echo "Unknown")
            echo "    Version: $VERSION"
        fi
    else
        echo "    App: Not installed"
    fi
    
    if command -v docker >/dev/null 2>&1; then
        echo "    CLI: $(which docker)"
        echo "    CLI Version: $(docker --version 2>/dev/null || echo "Not responding")"
    else
        echo "    CLI: Not found"
    fi
    echo ""
    
    # Docker daemon status
    print_info "Docker Daemon Status:"
    if timeout 5s docker info >/dev/null 2>&1; then
        echo "    Status: Running ✓"
        docker info 2>/dev/null | head -10 | sed 's/^/    /' || true
    else
        echo "    Status: Not responding ✗"
    fi
    echo ""
    
    # Processes
    print_info "Docker Processes:"
    if pgrep -f "Docker" >/dev/null 2>&1; then
        pgrep -fl "Docker" | sed 's/^/    /'
    else
        echo "    No Docker processes found"
    fi
    echo ""
    
    # Ports
    print_info "Docker Ports:"
    for port in 2375 2376; do
        if lsof -ti:$port >/dev/null 2>&1; then
            echo "    Port $port: In use"
        else
            echo "    Port $port: Available"
        fi
    done
    echo ""
    
    # Log locations
    print_info "Docker Log Locations:"
    LOG_LOCATIONS=(
        "$HOME/Library/Containers/com.docker.docker/Data/log"
        "/var/log/docker.log"
        "$HOME/.docker/daemon.json"
    )
    
    for location in "${LOG_LOCATIONS[@]}"; do
        if [ -e "$location" ]; then
            echo "    Found: $location"
        fi
    done
    echo ""
    
    # Disk usage
    if timeout 5s docker info >/dev/null 2>&1; then
        print_info "Docker Disk Usage:"
        docker system df 2>/dev/null | sed 's/^/    /' || echo "    Unable to get disk usage"
    fi
    
    wait_for_input
}

# Main TUI loop
main_menu() {
    while true; do
        options=(
            "🔍 Diagnose Docker Issues (Recommended first step)"
            "🔄 Restart Docker Desktop"
            "⚠️  Reset Docker Preferences (Nuclear option)"
            "🧹 Clean Docker Data & Images"
            "🔧 Quick Fixes (Automated repair)"
            "🔄 Reinstall Docker Desktop (Last resort)"
            "📋 Show Logs & Diagnostics"
            "❌ Exit Docker Doctor"
        )
        
        show_menu "🐳 Docker Doctor - Interactive Troubleshooting" "${options[@]}"
        local choice=$?
        
        case $choice in
            0) diagnose_docker_issues ;;
            1) restart_docker_desktop ;;
            2) reset_docker_preferences ;;
            3) clean_docker_data ;;
            4) run_quick_fixes ;;
            5) reinstall_docker ;;
            6) show_logs_and_diagnostics ;;
            7) 
                print_header "👋 Thanks for using Docker Doctor!"
                echo -e "${CYAN}If Docker is still having issues, consider:${NC}"
                echo -e "  • Checking Docker Desktop system requirements"
                echo -e "  • Updating macOS to the latest version"
                echo -e "  • Contacting Docker support"
                echo -e "  • Trying Docker alternatives (Podman, Lima)"
                echo ""
                echo -e "${GREEN}Happy coding! 🚀${NC}"
                exit 0
                ;;
        esac
    done
}

# Startup banner
startup_banner() {
    print_header "🐳 Docker Doctor v2.0 - TUI Troubleshooting Tool"
    echo -e "${CYAN}Welcome to Docker Doctor!${NC}"
    echo ""
    echo -e "This interactive tool will help you diagnose and fix Docker issues."
    echo -e "Choose from the menu options to get your Docker environment working."
    echo ""
    echo -e "${YELLOW}💡 Tip: Start with 'Diagnose Docker Issues' for a comprehensive health check.${NC}"
    echo ""
    wait_for_input
}

# Command line interface functions
show_help() {
    echo "Docker Doctor v2.0 - Docker Desktop Troubleshooting Tool"
    echo ""
    echo "Usage: $0 [OPTIONS] [COMMAND]"
    echo ""
    echo "OPTIONS:"
    echo "  -h, --help              Show this help message"
    echo "  -q, --quiet             Quiet mode (minimal output)"
    echo "  -v, --verbose           Verbose mode (detailed output)"
    echo "  --log FILE              Log output to file"
    echo "  --no-color              Disable colored output"
    echo ""
    echo "COMMANDS:"
    echo "  diagnose                Run comprehensive Docker diagnostics"
    echo "  restart                 Restart Docker Desktop"
    echo "  reset                   Reset Docker preferences (with confirmation)"
    echo "  clean                   Clean Docker data (safe clean only)"
    echo "  quick-fix               Run automated quick fixes"
    echo "  status                  Show Docker status summary"
    echo "  logs                    Display Docker logs and diagnostics"
    echo ""
    echo "EXAMPLES:"
    echo "  $0                      Run interactive TUI (default)"
    echo "  $0 diagnose             Run diagnostics in CLI mode"
    echo "  $0 status --quiet       Show brief status"
    echo "  $0 diagnose --log /tmp/docker-doctor.log"
    echo ""
    echo "For interactive mode, run without arguments."
}

# Command line argument parsing
QUIET_MODE=false
VERBOSE_MODE=false
LOG_FILE=""
NO_COLOR=false
CLI_MODE=false
COMMAND=""

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -q|--quiet)
                QUIET_MODE=true
                CLI_MODE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE_MODE=true
                CLI_MODE=true
                shift
                ;;
            --log)
                LOG_FILE="$2"
                CLI_MODE=true
                shift 2
                ;;
            --no-color)
                NO_COLOR=true
                # Disable all colors
                RED=''
                GREEN=''
                YELLOW=''
                BLUE=''
                MAGENTA=''
                CYAN=''
                WHITE=''
                BOLD=''
                NC=''
                shift
                ;;
            diagnose|restart|reset|clean|quick-fix|status|logs)
                COMMAND="$1"
                CLI_MODE=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Logging function
log_output() {
    if [[ -n "$LOG_FILE" ]]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S'): $1" | tee -a "$LOG_FILE"
    else
        echo "$1"
    fi
}

# CLI mode functions (non-interactive)
cli_diagnose() {
    if [[ "$QUIET_MODE" != true ]]; then
        log_output "🔍 Docker Doctor - Diagnostic Mode"
        log_output "=================================="
    fi
    
    check_virtualization_support
    check_competing_virtualization
    check_docker_installation
    check_docker_daemon
    check_docker_resources
    
    if [[ "$QUIET_MODE" != true ]]; then
        log_output ""
        log_output "Diagnostic complete. Use 'docker-doctor restart' if issues found."
    fi
}

cli_status() {
    if timeout 5s docker info >/dev/null 2>&1; then
        if [[ "$QUIET_MODE" == true ]]; then
            echo "OK"
        else
            log_output "✅ Docker Desktop is running and responding"
        fi
        exit 0
    else
        if [[ "$QUIET_MODE" == true ]]; then
            echo "ERROR"
        else
            log_output "❌ Docker Desktop is not responding"
        fi
        exit 1
    fi
}

cli_quick_fix() {
    if [[ "$QUIET_MODE" != true ]]; then
        log_output "🔧 Running quick fixes..."
    fi
    
    # Run quick fixes without user interaction
    sudo rm -f /var/run/docker.sock 2>/dev/null || true
    rm -rf "$HOME/.docker/cli-plugins-metadata" 2>/dev/null || true
    docker context use default 2>/dev/null || true
    
    if command -v systemctl >/dev/null 2>&1; then
        sudo systemctl restart docker 2>/dev/null || true
    fi
    
    sudo dscacheutil -flushcache 2>/dev/null || true
    sudo killall -HUP mDNSResponder 2>/dev/null || true
    
    pkill -f "Docker" 2>/dev/null || true
    sleep 3
    open "$DOCKER_APP" 2>/dev/null || true
    
    if [[ "$QUIET_MODE" != true ]]; then
        log_output "Quick fixes completed. Waiting for Docker to stabilize..."
    fi
    
    sleep 10
    
    if timeout 10s docker info >/dev/null 2>&1; then
        log_output "✅ Quick fixes successful!"
        exit 0
    else
        log_output "❌ Quick fixes didn't resolve the issue"
        exit 1
    fi
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Check if running on macOS
    if [[ "$(uname)" != "Darwin" ]]; then
        echo -e "${RED}Error: This tool is designed for macOS with Docker Desktop.${NC}"
        echo -e "For Linux Docker issues, try: ${WHITE}sudo systemctl status docker${NC}"
        exit 1
    fi
    
    # Parse command line arguments
    parse_args "$@"
    
    # Setup logging if specified
    if [[ -n "$LOG_FILE" ]]; then
        log_output "Docker Doctor started at $(date)"
        log_output "Command: $0 $*"
        log_output "=================="
    fi
    
    # Run in CLI mode if command specified
    if [[ "$CLI_MODE" == true ]]; then
        case "$COMMAND" in
            diagnose)
                cli_diagnose
                ;;
            status)
                cli_status
                ;;
            quick-fix)
                cli_quick_fix
                ;;
            restart)
                restart_docker_desktop
                ;;
            logs)
                show_logs_and_diagnostics
                ;;
            *)
                if [[ -n "$COMMAND" ]]; then
                    echo "Command '$COMMAND' not yet implemented in CLI mode"
                    echo "Available: diagnose, status, quick-fix, restart, logs"
                    exit 1
                fi
                # Just run diagnostics if flags but no command
                cli_diagnose
                ;;
        esac
    else
        # Interactive TUI mode
        trap 'echo -e "\n${YELLOW}Docker Doctor interrupted. Goodbye!${NC}"; exit 0' INT
        startup_banner
        main_menu
    fi
fi