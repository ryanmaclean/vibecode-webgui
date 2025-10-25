#!/bin/bash
# VibeCode CLI - Main Menu
# Central hub for all VibeCode development and operations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Helper functions
print_header() {
    echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${GREEN}$1${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_banner() {
    clear
    echo -e "${CYAN}"
    cat << "EOF"
╦  ╦┬┌┐ ┌─┐╔═╗┌─┐┌┬┐┌─┐  ╔═╗╦  ╦
╚╗╔╝│├┴┐├┤ ║  │ │ ││├┤   ║  ║  ║
 ╚╝ ┴└─┘└─┘╚═╝└─┘─┴┘└─┘  ╚═╝╩═╝╩
EOF
    echo -e "${NC}"
    echo -e "${BLUE}Development & Operations Command Center${NC}\n"
}

# Main menu display
show_main_menu() {
    print_banner

    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Main Menu${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}\n"

    echo -e "${CYAN}1.${NC} Development Operations"
    echo -e "   ${BLUE}└─${NC} Build, Dev Tools, Code Quality, Clean"
    echo ""
    echo -e "${CYAN}2.${NC} Testing & Validation"
    echo -e "   ${BLUE}└─${NC} Unit Tests, Integration, E2E, Validation"
    echo ""
    echo -e "${CYAN}3.${NC} Deployment & Infrastructure"
    echo -e "   ${BLUE}└─${NC} (Coming from Agent 1)"
    echo ""
    echo -e "${CYAN}4.${NC} Security & Database"
    echo -e "   ${BLUE}└─${NC} (Coming from Agent 2)"
    echo ""
    echo -e "${CYAN}5.${NC} VM Operations"
    echo -e "   ${BLUE}└─${NC} (Coming from Agent 1)"
    echo ""
    echo -e "${CYAN}0.${NC} Exit"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}\n"
    echo -n "Select an option [0-5]: "
}

# Main menu handler
main() {
    local choice

    # Check if running with arguments
    if [ "$#" -gt 0 ]; then
        case "$1" in
            dev|development)
                exec "$SCRIPT_DIR/dev-menu.sh"
                ;;
            test|testing)
                exec "$SCRIPT_DIR/test-menu.sh"
                ;;
            --help|-h|help)
                print_header "VibeCode CLI Help"
                echo "Usage: vibecode-cli [command]"
                echo ""
                echo "Commands:"
                echo "  dev, development    Development operations menu"
                echo "  test, testing       Testing & validation menu"
                echo "  help                Show this help message"
                echo ""
                echo "Interactive Mode:"
                echo "  Run without arguments to enter interactive menu"
                exit 0
                ;;
            *)
                print_error "Unknown command: $1"
                print_info "Run 'vibecode-cli --help' for usage information"
                exit 1
                ;;
        esac
    fi

    # Interactive menu loop
    while true; do
        show_main_menu
        read -r choice

        case $choice in
            1)
                "$SCRIPT_DIR/dev-menu.sh"
                ;;
            2)
                "$SCRIPT_DIR/test-menu.sh"
                ;;
            3)
                print_warning "Deployment & Infrastructure menu coming soon (Agent 1)"
                read -p "Press Enter to continue..."
                ;;
            4)
                print_warning "Security & Database menu coming soon (Agent 2)"
                read -p "Press Enter to continue..."
                ;;
            5)
                print_warning "VM Operations menu coming soon (Agent 1)"
                read -p "Press Enter to continue..."
                ;;
            0)
                print_info "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid option. Please try again."
                sleep 1
                ;;
        esac
    done
}

# Run main function
main "$@"
