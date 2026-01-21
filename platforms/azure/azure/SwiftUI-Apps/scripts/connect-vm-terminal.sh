#!/bin/bash
#
# connect-vm-terminal.sh
# VibeCode Terminal Connection Script
#
# Purpose: Connect to a running VM's PTY console for interactive terminal access
# Usage: ./scripts/connect-vm-terminal.sh [PTY_DEVICE]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored message
print_msg() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

print_error() {
    print_msg "$RED" "[ERROR] $@"
}

print_success() {
    print_msg "$GREEN" "[SUCCESS] $@"
}

print_info() {
    print_msg "$BLUE" "[INFO] $@"
}

print_warning() {
    print_msg "$YELLOW" "[WARNING] $@"
}

# Print banner
print_banner() {
    cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║         VibeCode VM Terminal Connection               ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
EOF
}

# Print usage
print_usage() {
    cat << EOF

Usage: $0 [OPTIONS] [PTY_DEVICE]

Connect to a running VM's console via PTY for interactive terminal access.

Options:
    -h, --help          Show this help message
    -l, --list          List available PTY devices
    -a, --auto          Auto-detect PTY from running VMs
    -r, --raw           Use raw terminal mode (no screen wrapper)
    -s, --screen        Use GNU screen (default)
    --tmux              Use tmux instead of screen
    --minicom           Use minicom instead of screen

Arguments:
    PTY_DEVICE          Path to PTY device (e.g., /dev/ttys001)
                        If omitted, will auto-detect or prompt for selection

Examples:
    # Auto-detect and connect
    $0 --auto

    # Connect to specific PTY device
    $0 /dev/ttys001

    # List available PTY devices
    $0 --list

    # Use tmux instead of screen
    $0 --tmux --auto

Terminal Controls:
    Ctrl+A, D           Detach from screen session (screen mode)
    Ctrl+A, K           Kill screen session (screen mode)
    Ctrl+B, D           Detach from tmux session (tmux mode)
    Ctrl+C              Send interrupt to VM
    Ctrl+D              Send EOF to VM

EOF
}

# List available PTY devices
list_pty_devices() {
    print_info "Searching for PTY devices..."
    echo

    # Check /tmp for vibecode console logs
    if ls /tmp/vibecode-console-*.log &>/dev/null; then
        print_info "Found VibeCode console logs:"
        for log in /tmp/vibecode-console-*.log; do
            local vm_id=$(basename "$log" | sed 's/vibecode-console-\(.*\)\.log/\1/')
            local size=$(du -h "$log" | cut -f1)
            echo "  - VM ID: $vm_id"
            echo "    Log: $log ($size)"

            # Try to find associated PTY by checking running processes
            local pty=$(ps aux | grep "$vm_id" | grep -v grep | grep -oE '/dev/ttys[0-9]+' | head -1)
            if [ -n "$pty" ]; then
                echo "    PTY: $pty"
            fi
            echo
        done
    fi

    # List all tty slave devices
    print_info "Available TTY devices:"
    ls -l /dev/ttys* 2>/dev/null | head -20 || print_warning "No /dev/ttys* devices found"
    echo
}

# Auto-detect PTY device
auto_detect_pty() {
    print_info "Auto-detecting PTY device..."

    # Method 1: Check for recently modified /dev/ttys* devices
    local recent_pty=$(ls -t /dev/ttys* 2>/dev/null | head -1)

    if [ -n "$recent_pty" ]; then
        # Check if device was modified in last 5 minutes
        local mod_time=$(stat -f %m "$recent_pty" 2>/dev/null || stat -c %Y "$recent_pty" 2>/dev/null)
        local now=$(date +%s)
        local age=$((now - mod_time))

        if [ $age -lt 300 ]; then
            print_success "Found recently active PTY: $recent_pty (${age}s ago)"
            echo "$recent_pty"
            return 0
        fi
    fi

    # Method 2: Check for VibeCode processes with PTY
    local pty_from_ps=$(ps aux | grep -i vibecode | grep -v grep | grep -oE '/dev/ttys[0-9]+' | head -1)
    if [ -n "$pty_from_ps" ]; then
        print_success "Found PTY from running process: $pty_from_ps"
        echo "$pty_from_ps"
        return 0
    fi

    print_error "Could not auto-detect PTY device"
    print_info "Try using --list to see available devices"
    return 1
}

# Connect to PTY with screen
connect_with_screen() {
    local pty_device=$1

    print_info "Connecting to $pty_device with GNU screen..."
    print_info "Press Ctrl+A, D to detach, Ctrl+A, K to kill session"
    echo

    # Check if screen is installed
    if ! command -v screen &>/dev/null; then
        print_error "GNU screen is not installed"
        print_info "Install with: brew install screen"
        exit 1
    fi

    # Connect with screen
    # -L: Enable logging
    # -S: Session name
    screen -L -S vibecode-vm "$pty_device"
}

# Connect to PTY with tmux
connect_with_tmux() {
    local pty_device=$1

    print_info "Connecting to $pty_device with tmux..."
    print_info "Press Ctrl+B, D to detach"
    echo

    # Check if tmux is installed
    if ! command -v tmux &>/dev/null; then
        print_error "tmux is not installed"
        print_info "Install with: brew install tmux"
        exit 1
    fi

    # Create a new tmux session or attach to existing
    local session_name="vibecode-vm"

    # Check if session exists
    if tmux has-session -t "$session_name" 2>/dev/null; then
        print_info "Attaching to existing tmux session: $session_name"
        tmux attach-session -t "$session_name"
    else
        # Create new session with cat to PTY device
        tmux new-session -s "$session_name" "cat $pty_device"
    fi
}

# Connect to PTY with minicom
connect_with_minicom() {
    local pty_device=$1

    print_info "Connecting to $pty_device with minicom..."
    echo

    # Check if minicom is installed
    if ! command -v minicom &>/dev/null; then
        print_error "minicom is not installed"
        print_info "Install with: brew install minicom"
        exit 1
    fi

    # Connect with minicom
    minicom -D "$pty_device"
}

# Connect to PTY in raw mode
connect_raw() {
    local pty_device=$1

    print_info "Connecting to $pty_device in raw mode..."
    print_info "Press Ctrl+C to exit"
    echo

    # Save current terminal settings
    local old_settings=$(stty -g)

    # Set raw mode
    stty raw -echo

    # Cleanup on exit
    trap "stty $old_settings" EXIT INT TERM

    # Read from PTY and write to stdout, read from stdin and write to PTY
    cat "$pty_device" &
    local cat_pid=$!

    # Forward stdin to PTY
    while IFS= read -r -n1 char; do
        echo -n "$char" > "$pty_device"
    done

    # Cleanup
    kill $cat_pid 2>/dev/null || true
    stty "$old_settings"
}

# Interactive PTY selection
interactive_select_pty() {
    print_info "Available PTY devices:"
    echo

    # Get list of devices
    local devices=($(ls /dev/ttys* 2>/dev/null | head -20))

    if [ ${#devices[@]} -eq 0 ]; then
        print_error "No PTY devices found"
        return 1
    fi

    # Display numbered list
    local i=1
    for device in "${devices[@]}"; do
        local mod_time=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$device" 2>/dev/null || stat -c "%y" "$device" 2>/dev/null | cut -d. -f1)
        echo "  [$i] $device (modified: $mod_time)"
        ((i++))
    done

    echo
    read -p "Select device number (or 'q' to quit): " selection

    if [ "$selection" = "q" ] || [ "$selection" = "Q" ]; then
        print_info "Cancelled"
        exit 0
    fi

    # Validate selection
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt ${#devices[@]} ]; then
        print_error "Invalid selection"
        return 1
    fi

    # Return selected device (arrays are 0-indexed)
    echo "${devices[$((selection-1))]}"
}

# Verify PTY device
verify_pty_device() {
    local pty_device=$1

    if [ ! -e "$pty_device" ]; then
        print_error "Device does not exist: $pty_device"
        return 1
    fi

    if [ ! -c "$pty_device" ]; then
        print_error "Not a character device: $pty_device"
        return 1
    fi

    if [ ! -r "$pty_device" ] || [ ! -w "$pty_device" ]; then
        print_error "Insufficient permissions for: $pty_device"
        print_info "You may need to run with sudo or fix permissions"
        return 1
    fi

    return 0
}

# Main function
main() {
    local pty_device=""
    local mode="screen"
    local auto_detect=false
    local list_only=false

    # Parse arguments
    while [ $# -gt 0 ]; do
        case "$1" in
            -h|--help)
                print_banner
                print_usage
                exit 0
                ;;
            -l|--list)
                list_only=true
                shift
                ;;
            -a|--auto)
                auto_detect=true
                shift
                ;;
            -r|--raw)
                mode="raw"
                shift
                ;;
            -s|--screen)
                mode="screen"
                shift
                ;;
            --tmux)
                mode="tmux"
                shift
                ;;
            --minicom)
                mode="minicom"
                shift
                ;;
            /dev/*)
                pty_device="$1"
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done

    print_banner
    echo

    # List mode
    if [ "$list_only" = true ]; then
        list_pty_devices
        exit 0
    fi

    # Auto-detect mode
    if [ "$auto_detect" = true ] && [ -z "$pty_device" ]; then
        pty_device=$(auto_detect_pty) || exit 1
    fi

    # Interactive selection if no device specified
    if [ -z "$pty_device" ]; then
        pty_device=$(interactive_select_pty) || exit 1
    fi

    # Verify device
    if ! verify_pty_device "$pty_device"; then
        exit 1
    fi

    print_success "Using PTY device: $pty_device"
    echo

    # Connect based on mode
    case "$mode" in
        screen)
            connect_with_screen "$pty_device"
            ;;
        tmux)
            connect_with_tmux "$pty_device"
            ;;
        minicom)
            connect_with_minicom "$pty_device"
            ;;
        raw)
            connect_raw "$pty_device"
            ;;
        *)
            print_error "Unknown mode: $mode"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
