#!/usr/bin/env bash

#####################################################################
# VibeCode CLI - Universal Menu System
# Consolidates 126+ scripts into organized, navigable menus
#####################################################################

set -euo pipefail

# Colors and formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly MAGENTA='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_LIB_DIR="${SCRIPT_DIR}/../vibecode-cli-lib"

# Source common utilities if available
if [[ -f "${CLI_LIB_DIR}/common.sh" ]]; then
    source "${CLI_LIB_DIR}/common.sh"
fi

#####################################################################
# Display Functions
#####################################################################

print_header() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                     VibeCode CLI v1.0                          ║"
    echo "║              Universal Script Management System                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo
}

print_menu_item() {
    local num="$1"
    local desc="$2"
    local color="${3:-$GREEN}"
    echo -e "  ${color}${num})${NC} ${desc}"
}

print_section_header() {
    local title="$1"
    echo -e "\n${BOLD}${BLUE}═══ ${title} ═══${NC}\n"
}

#####################################################################
# Main Menu
#####################################################################

show_main_menu() {
    print_header

    print_section_header "Core Operations"
    print_menu_item "1" "Deployment Management (Kind/K8s, Docker, Production)" "$MAGENTA"
    print_menu_item "2" "VM Management (vfkit, Lima, Benchmarks)" "$CYAN"
    print_menu_item "3" "Development Tools" "$GREEN"
    print_menu_item "4" "Testing & Validation" "$YELLOW"

    print_section_header "Infrastructure"
    print_menu_item "5" "Database Operations" "$BLUE"
    print_menu_item "6" "Security & Monitoring" "$RED"

    print_section_header "Utilities"
    print_menu_item "7" "Documentation Tools" "$GREEN"
    print_menu_item "8" "Build & CI/CD" "$YELLOW"

    echo
    print_menu_item "0" "Exit" "$RED"
    echo
}

#####################################################################
# Menu Handlers
#####################################################################

handle_deployment_menu() {
    if [[ -f "${CLI_LIB_DIR}/deploy-menu.sh" ]]; then
        source "${CLI_LIB_DIR}/deploy-menu.sh"
        show_deploy_menu
    else
        echo -e "${RED}Error: Deployment menu not found${NC}"
        read -p "Press Enter to continue..."
    fi
}

handle_vm_menu() {
    if [[ -f "${CLI_LIB_DIR}/vm-menu.sh" ]]; then
        source "${CLI_LIB_DIR}/vm-menu.sh"
        show_vm_menu
    else
        echo -e "${RED}Error: VM menu not found${NC}"
        read -p "Press Enter to continue..."
    fi
}

handle_dev_tools() {
    echo -e "${YELLOW}Development tools menu coming soon...${NC}"
    read -p "Press Enter to continue..."
}

handle_testing() {
    echo -e "${YELLOW}Testing menu coming soon...${NC}"
    read -p "Press Enter to continue..."
}

handle_database() {
    echo -e "${YELLOW}Database operations menu coming soon...${NC}"
    read -p "Press Enter to continue..."
}

handle_security() {
    echo -e "${YELLOW}Security & monitoring menu coming soon...${NC}"
    read -p "Press Enter to continue..."
}

handle_documentation() {
    echo -e "${YELLOW}Documentation tools menu coming soon...${NC}"
    read -p "Press Enter to continue..."
}

handle_build_ci() {
    echo -e "${YELLOW}Build & CI/CD menu coming soon...${NC}"
    read -p "Press Enter to continue..."
}

#####################################################################
# Main Loop
#####################################################################

main() {
    local choice

    while true; do
        show_main_menu
        read -rp "Select an option: " choice

        case $choice in
            1) handle_deployment_menu ;;
            2) handle_vm_menu ;;
            3) handle_dev_tools ;;
            4) handle_testing ;;
            5) handle_database ;;
            6) handle_security ;;
            7) handle_documentation ;;
            8) handle_build_ci ;;
            0)
                echo -e "${GREEN}Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option. Please try again.${NC}"
                sleep 1
                ;;
        esac
    done
}

# Run main menu
main "$@"
