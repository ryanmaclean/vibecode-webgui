#!/bin/bash
# VibeCode CLI - Development Menu
# Provides access to build, dev tools, code quality, and cleanup operations

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
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

# Helper functions
print_header() {
    echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${GREEN}$1${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

print_section() {
    echo -e "\n${BLUE}▸ $1${NC}"
    echo -e "${BLUE}─────────────────────────────────────────────${NC}"
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

# Menu display functions
show_dev_menu() {
    clear
    print_header "VibeCode Development Menu"

    echo -e "${CYAN}1.${NC} Build Operations"
    echo -e "${CYAN}2.${NC} Development Tools"
    echo -e "${CYAN}3.${NC} Code Quality"
    echo -e "${CYAN}4.${NC} Clean & Maintenance"
    echo -e "${CYAN}5.${NC} Back to Main Menu"
    echo ""
    echo -n "Select an option [1-5]: "
}

show_build_menu() {
    clear
    print_header "Build Operations"

    print_section "Production Builds"
    echo -e "  ${CYAN}1.${NC} Build Production (Full)"
    echo -e "  ${CYAN}2.${NC} Build and Push Code Server"
    echo -e "  ${CYAN}3.${NC} Build Multiarch Images"

    print_section "Development Builds"
    echo -e "  ${CYAN}4.${NC} Build Code Server (Local)"
    echo -e "  ${CYAN}5.${NC} Build and Test Code Server"
    echo -e "  ${CYAN}6.${NC} Build Apple Runtime"

    print_section "Specialized Builds"
    echo -e "  ${CYAN}7.${NC} Build Code Server Multiarch"
    echo -e "  ${CYAN}8.${NC} Build Fast OpenVSCode VM with AI Tools"
    echo -e "  ${CYAN}9.${NC} Build Complete Wiki"
    echo -e "  ${CYAN}10.${NC} Build Profiles"

    echo ""
    echo -e "${CYAN}0.${NC} Back to Development Menu"
    echo ""
    echo -n "Select an option: "
}

show_devtools_menu() {
    clear
    print_header "Development Tools"

    print_section "TypeScript & Test Fixes"
    echo -e "  ${CYAN}1.${NC} Fix TypeScript Baseline"
    echo -e "  ${CYAN}2.${NC} Fix All Tests"
    echo -e "  ${CYAN}3.${NC} Fix Test Syntax"
    echo -e "  ${CYAN}4.${NC} Fix TS Ignore Statements"

    print_section "Component Fixes"
    echo -e "  ${CYAN}5.${NC} Fix Logger Circular Dependency"
    echo -e "  ${CYAN}6.${NC} Fix Cognitive Search Adapter"
    echo -e "  ${CYAN}7.${NC} Fix Database Connections"
    echo -e "  ${CYAN}8.${NC} Fix Network Policy"

    print_section "Merge & Conflict Resolution"
    echo -e "  ${CYAN}9.${NC} Fix Merge Conflicts"
    echo -e "  ${CYAN}10.${NC} Fix Merge Conflicts (Better)"

    print_section "General Dev Tools"
    echo -e "  ${CYAN}11.${NC} Run Dev Tools Script"

    echo ""
    echo -e "${CYAN}0.${NC} Back to Development Menu"
    echo ""
    echo -n "Select an option: "
}

show_quality_menu() {
    clear
    print_header "Code Quality & Auditing"

    print_section "License & Compliance"
    echo -e "  ${CYAN}1.${NC} Check Licenses"
    echo -e "  ${CYAN}2.${NC} Verify Extension Licenses"
    echo -e "  ${CYAN}3.${NC} Verify GPL-Free"

    print_section "Security & Auditing"
    echo -e "  ${CYAN}4.${NC} Security Audit"
    echo -e "  ${CYAN}5.${NC} Component Status Audit"
    echo -e "  ${CYAN}6.${NC} Audit Documentation"

    print_section "Verification"
    echo -e "  ${CYAN}7.${NC} Verify Setup"
    echo -e "  ${CYAN}8.${NC} Verify Onboarding"
    echo -e "  ${CYAN}9.${NC} Verify Environment Consolidation"

    echo ""
    echo -e "${CYAN}0.${NC} Back to Development Menu"
    echo ""
    echo -n "Select an option: "
}

show_clean_menu() {
    clear
    print_header "Clean & Maintenance"

    print_section "Cleanup Operations"
    echo -e "  ${CYAN}1.${NC} KIND Cleanup"
    echo -e "  ${CYAN}2.${NC} Cleanup Local Environment"
    echo -e "  ${CYAN}3.${NC} Safe Root Cleanup"

    print_section "Resource Management"
    echo -e "  ${CYAN}4.${NC} Check Resource Deletion"

    echo ""
    echo -e "${CYAN}0.${NC} Back to Development Menu"
    echo ""
    echo -n "Select an option: "
}

# Build operations
handle_build_menu() {
    local choice

    while true; do
        show_build_menu
        read -r choice

        case $choice in
            1)
                print_info "Running production build..."
                "$SCRIPTS_DIR/build-production.sh"
                ;;
            2)
                print_info "Building and pushing code server..."
                "$SCRIPTS_DIR/build-and-push-codeserver.sh"
                ;;
            3)
                print_info "Building multiarch images..."
                "$SCRIPTS_DIR/build-multiarch.sh"
                ;;
            4)
                print_info "Building code server locally..."
                "$SCRIPTS_DIR/build-codeserver-local.sh"
                ;;
            5)
                print_info "Building and testing code server..."
                "$SCRIPTS_DIR/build-and-test-code-server.sh"
                ;;
            6)
                print_info "Building Apple runtime..."
                "$SCRIPTS_DIR/build-apple-runtime.sh"
                ;;
            7)
                print_info "Building code server multiarch..."
                "$SCRIPTS_DIR/build-codeserver-multiarch.sh"
                ;;
            8)
                print_info "Building fast OpenVSCode VM with AI tools..."
                "$SCRIPTS_DIR/build-fast-openvscode-vm-with-ai-tools.sh"
                ;;
            9)
                print_info "Building complete wiki..."
                "$SCRIPTS_DIR/build-complete-wiki.sh"
                ;;
            10)
                print_info "Building profiles..."
                "$SCRIPTS_DIR/build-profiles.sh"
                ;;
            0)
                return
                ;;
            *)
                print_error "Invalid option. Please try again."
                ;;
        esac

        if [ "$choice" != "0" ]; then
            echo ""
            read -p "Press Enter to continue..."
        fi
    done
}

# Dev tools operations
handle_devtools_menu() {
    local choice

    while true; do
        show_devtools_menu
        read -r choice

        case $choice in
            1)
                print_info "Fixing TypeScript baseline..."
                "$SCRIPTS_DIR/fix-typescript-baseline.sh"
                ;;
            2)
                print_info "Fixing all tests..."
                "$SCRIPTS_DIR/fix-all-tests.sh"
                ;;
            3)
                print_info "Fixing test syntax..."
                "$SCRIPTS_DIR/fix-test-syntax.sh"
                ;;
            4)
                print_info "Fixing TS ignore statements..."
                "$SCRIPTS_DIR/fix-ts-ignore.sh"
                ;;
            5)
                print_info "Fixing logger circular dependency..."
                "$SCRIPTS_DIR/fix-logger-circular-dependency.sh"
                ;;
            6)
                print_info "Fixing cognitive search adapter..."
                "$SCRIPTS_DIR/fix-cognitive-search-adapter.sh"
                ;;
            7)
                print_info "Fixing database connections..."
                "$SCRIPTS_DIR/fix-database-connections.sh"
                ;;
            8)
                print_info "Fixing network policy..."
                "$SCRIPTS_DIR/fix-network-policy.sh"
                ;;
            9)
                print_info "Fixing merge conflicts..."
                "$SCRIPTS_DIR/fix-merge-conflicts.sh"
                ;;
            10)
                print_info "Fixing merge conflicts (better)..."
                "$SCRIPTS_DIR/fix-merge-conflicts-better.sh"
                ;;
            11)
                print_info "Running dev tools..."
                "$SCRIPTS_DIR/dev-tools.sh"
                ;;
            0)
                return
                ;;
            *)
                print_error "Invalid option. Please try again."
                ;;
        esac

        if [ "$choice" != "0" ]; then
            echo ""
            read -p "Press Enter to continue..."
        fi
    done
}

# Code quality operations
handle_quality_menu() {
    local choice

    while true; do
        show_quality_menu
        read -r choice

        case $choice in
            1)
                print_info "Checking licenses..."
                "$SCRIPTS_DIR/check-licenses.sh"
                ;;
            2)
                print_info "Verifying extension licenses..."
                "$SCRIPTS_DIR/verify-extension-licenses.sh"
                ;;
            3)
                print_info "Verifying GPL-free status..."
                "$SCRIPTS_DIR/verify-gpl-free.sh"
                ;;
            4)
                print_info "Running security audit..."
                "$SCRIPTS_DIR/security-audit.sh"
                ;;
            5)
                print_info "Running component status audit..."
                "$SCRIPTS_DIR/component-status-audit.sh"
                ;;
            6)
                print_info "Auditing documentation..."
                "$SCRIPTS_DIR/audit-documentation.sh"
                ;;
            7)
                print_info "Verifying setup..."
                "$SCRIPTS_DIR/verify-setup.sh"
                ;;
            8)
                print_info "Verifying onboarding..."
                "$SCRIPTS_DIR/verify-onboarding.sh"
                ;;
            9)
                print_info "Verifying environment consolidation..."
                "$SCRIPTS_DIR/verify-env-consolidation.sh"
                ;;
            0)
                return
                ;;
            *)
                print_error "Invalid option. Please try again."
                ;;
        esac

        if [ "$choice" != "0" ]; then
            echo ""
            read -p "Press Enter to continue..."
        fi
    done
}

# Clean operations
handle_clean_menu() {
    local choice

    while true; do
        show_clean_menu
        read -r choice

        case $choice in
            1)
                print_info "Running KIND cleanup..."
                "$SCRIPTS_DIR/kind-cleanup.sh"
                ;;
            2)
                print_info "Cleaning up local environment..."
                "$SCRIPTS_DIR/cleanup-local-env.sh"
                ;;
            3)
                print_warning "This will perform safe root cleanup..."
                read -p "Are you sure? (y/N): " confirm
                if [[ $confirm == [yY] ]]; then
                    "$SCRIPTS_DIR/safe-root-cleanup.sh"
                fi
                ;;
            4)
                print_info "Checking resource deletion..."
                "$SCRIPTS_DIR/check-resource-deletion.sh"
                ;;
            0)
                return
                ;;
            *)
                print_error "Invalid option. Please try again."
                ;;
        esac

        if [ "$choice" != "0" ]; then
            echo ""
            read -p "Press Enter to continue..."
        fi
    done
}

# Main menu handler
main() {
    local choice

    while true; do
        show_dev_menu
        read -r choice

        case $choice in
            1)
                handle_build_menu
                ;;
            2)
                handle_devtools_menu
                ;;
            3)
                handle_quality_menu
                ;;
            4)
                handle_clean_menu
                ;;
            5)
                print_info "Returning to main menu..."
                exit 0
                ;;
            *)
                print_error "Invalid option. Please try again."
                read -p "Press Enter to continue..."
                ;;
        esac
    done
}

# Run main menu if script is executed directly
if [ "${BASH_SOURCE[0]}" -eq "$0" ]; then
    main
fi
