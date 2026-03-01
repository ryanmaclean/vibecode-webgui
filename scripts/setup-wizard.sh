#!/usr/bin/env bash

###############################################################################
# VibeCode Unified Setup Wizard
# Interactive wizard to guide users through deployment mode selection and setup
###############################################################################

set -e

# Color definitions (matching pattern from other scripts)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
RESET='\033[0m'

# Configuration
INTERACTIVE=true
SELECTED_MODE=""
DRY_RUN=false

###############################################################################
# Utility Functions
###############################################################################

log() {
    local message="$1"
    local color="${2:-$CYAN}"
    echo -e "${color}${message}${RESET}"
}

log_error() {
    log "$1" "$RED"
}

log_success() {
    log "$1" "$GREEN"
}

log_warning() {
    log "$1" "$YELLOW"
}

log_info() {
    log "$1" "$BLUE"
}

log_header() {
    local message="$1"
    echo ""
    log "=====================================================================" "$CYAN"
    log "  $message" "$CYAN"
    log "=====================================================================" "$CYAN"
    echo ""
}

###############################################################################
# Help and Usage
###############################################################################

show_usage() {
    cat << 'EOF'
Usage: ./scripts/setup-wizard.sh [OPTIONS]

Interactive wizard to help you choose and set up the right deployment mode
for VibeCode based on your needs.

OPTIONS:
    --mode MODE         Skip wizard and set up specific mode directly
                        Available modes: docker-compose, kind, tauri, vfkit
    --dry-run           Show what would be done without executing
    --non-interactive   Run in non-interactive mode (requires --mode)
    -h, --help          Show this help message

DEPLOYMENT MODES:
    docker-compose      Fast setup with Docker Compose (recommended for most)
    kind                Kubernetes in Docker (for K8s learning/teams)
    tauri               Native macOS desktop app (for personal use)
    vfkit               Apple Virtualization with vfkit (production/isolation)

EXAMPLES:
    # Interactive mode (recommended for first-time users)
    ./scripts/setup-wizard.sh

    # Set up Docker Compose directly
    ./scripts/setup-wizard.sh --mode docker-compose

    # Preview KIND setup without executing
    ./scripts/setup-wizard.sh --mode kind --dry-run

    # Non-interactive Docker Compose setup
    ./scripts/setup-wizard.sh --mode docker-compose --non-interactive

DOCUMENTATION:
    Full docs: docs/INSTALLATION_MASTER_GUIDE.md
    Quick start: docs/QUICKSTART_CHECKLIST.md
    Decision tree: docs/setup/DEPLOYMENT_DECISION_TREE.md

EOF
}

###############################################################################
# System Detection
###############################################################################

detect_operating_system() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Linux"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "Windows"
    else
        echo "Unknown"
    fi
}

check_prerequisites() {
    local mode="$1"
    local all_ok=true

    case "$mode" in
        docker-compose)
            log_info "Checking prerequisites for Docker Compose mode..."
            if ! command -v docker &> /dev/null; then
                log_error "  ✗ Docker not installed"
                all_ok=false
            else
                log_success "  ✓ Docker found"
            fi
            if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
                log_error "  ✗ Docker Compose not installed"
                all_ok=false
            else
                log_success "  ✓ Docker Compose found"
            fi
            ;;
        kind)
            log_info "Checking prerequisites for KIND Kubernetes mode..."
            if ! command -v docker &> /dev/null; then
                log_error "  ✗ Docker not installed"
                all_ok=false
            else
                log_success "  ✓ Docker found"
            fi
            if ! command -v kubectl &> /dev/null; then
                log_error "  ✗ kubectl not installed"
                all_ok=false
            else
                log_success "  ✓ kubectl found"
            fi
            if ! command -v kind &> /dev/null; then
                log_error "  ✗ KIND not installed"
                all_ok=false
            else
                log_success "  ✓ KIND found"
            fi
            ;;
        tauri)
            log_info "Checking prerequisites for Tauri Desktop mode..."
            local os
            os=$(detect_operating_system)
            if [ "$os" != "macOS" ]; then
                log_warning "  ⚠ Tauri Desktop is currently macOS-only"
                log_warning "  Consider using Docker Compose or KIND instead"
                all_ok=false
            else
                log_success "  ✓ macOS detected"
            fi
            if ! command -v node &> /dev/null; then
                log_error "  ✗ Node.js not installed"
                all_ok=false
            else
                log_success "  ✓ Node.js found"
            fi
            ;;
        vfkit)
            log_info "Checking prerequisites for Apple Virtualization mode..."
            local os
            os=$(detect_operating_system)
            if [ "$os" != "macOS" ]; then
                log_error "  ✗ Apple Virtualization requires macOS"
                all_ok=false
            else
                log_success "  ✓ macOS detected"
            fi
            if ! command -v vfkit &> /dev/null; then
                log_warning "  ⚠ vfkit not installed (will guide through installation)"
            else
                log_success "  ✓ vfkit found"
            fi
            ;;
    esac

    echo ""
    if [ "$all_ok" = true ]; then
        return 0
    else
        return 1
    fi
}

###############################################################################
# Interactive Wizard
###############################################################################

show_welcome() {
    clear
    log_header "Welcome to VibeCode Setup Wizard"

    log "This wizard will help you:" "$CYAN"
    log "  1. Choose the right deployment mode for your needs" "$CYAN"
    log "  2. Verify prerequisites are installed" "$CYAN"
    log "  3. Run automated setup for your chosen mode" "$CYAN"
    log "  4. Get started with VibeCode in minutes" "$CYAN"
    echo ""

    log "Press ENTER to continue or Ctrl+C to exit..."
    read -r
}

show_deployment_modes() {
    clear
    log_header "Choose Your Deployment Mode"

    local os
    os=$(detect_operating_system)

    log "Detected OS: $os" "$MAGENTA"
    echo ""

    log "Available deployment modes:" "$CYAN"
    echo ""

    log "1) Docker Compose" "$GREEN"
    log "   ✓ Fastest setup (< 5 minutes)" "$YELLOW"
    log "   ✓ Best for: Development, testing, quick start" "$YELLOW"
    log "   ✓ Platform: macOS, Linux, Windows (WSL2)" "$YELLOW"
    log "   ✓ Resource usage: Low (4GB RAM minimum)" "$YELLOW"
    echo ""

    log "2) KIND Kubernetes" "$GREEN"
    log "   ✓ Kubernetes cluster in Docker" "$YELLOW"
    log "   ✓ Best for: Learning K8s, team environments, CI/CD" "$YELLOW"
    log "   ✓ Platform: macOS, Linux, Windows (WSL2)" "$YELLOW"
    log "   ✓ Resource usage: Medium (8GB RAM recommended)" "$YELLOW"
    echo ""

    if [ "$os" = "macOS" ]; then
        log "3) Tauri Desktop" "$GREEN"
        log "   ✓ Native macOS application" "$YELLOW"
        log "   ✓ Best for: Personal use, offline work, native experience" "$YELLOW"
        log "   ✓ Platform: macOS only" "$YELLOW"
        log "   ✓ Resource usage: Low (4GB RAM minimum)" "$YELLOW"
        echo ""

        log "4) Apple Virtualization (vfkit)" "$GREEN"
        log "   ✓ Full VM isolation with Apple Hypervisor" "$YELLOW"
        log "   ✓ Best for: Production, security-critical, complete isolation" "$YELLOW"
        log "   ✓ Platform: macOS only (Apple Silicon recommended)" "$YELLOW"
        log "   ✓ Resource usage: High (16GB RAM recommended)" "$YELLOW"
        echo ""
    fi

    log "💡 Not sure which to choose? See: docs/setup/DEPLOYMENT_DECISION_TREE.md" "$CYAN"
    echo ""
}

prompt_mode_selection() {
    local os
    os=$(detect_operating_system)

    while true; do
        if [ "$os" = "macOS" ]; then
            log "Enter your choice (1-4): " "$CYAN"
        else
            log "Enter your choice (1-2): " "$CYAN"
        fi

        read -r choice

        case "$choice" in
            1)
                SELECTED_MODE="docker-compose"
                break
                ;;
            2)
                SELECTED_MODE="kind"
                break
                ;;
            3)
                if [ "$os" = "macOS" ]; then
                    SELECTED_MODE="tauri"
                    break
                else
                    log_error "Invalid choice. Please enter 1 or 2."
                fi
                ;;
            4)
                if [ "$os" = "macOS" ]; then
                    SELECTED_MODE="vfkit"
                    break
                else
                    log_error "Invalid choice. Please enter 1 or 2."
                fi
                ;;
            *)
                if [ "$os" = "macOS" ]; then
                    log_error "Invalid choice. Please enter 1-4."
                else
                    log_error "Invalid choice. Please enter 1-2."
                fi
                ;;
        esac
    done
}

show_mode_summary() {
    local mode="$1"

    clear
    log_header "Deployment Mode: $(echo "$mode" | tr '[:lower:]' '[:upper:]' | tr '-' ' ')"

    case "$mode" in
        docker-compose)
            log "You selected: Docker Compose" "$GREEN"
            log ""
            log "What to expect:" "$CYAN"
            log "  • Setup time: 3-5 minutes" "$YELLOW"
            log "  • Prerequisites: Docker, Docker Compose" "$YELLOW"
            log "  • Next: Will run scripts/quick-setup-docker-compose.sh" "$YELLOW"
            ;;
        kind)
            log "You selected: KIND Kubernetes" "$GREEN"
            log ""
            log "What to expect:" "$CYAN"
            log "  • Setup time: 5-10 minutes" "$YELLOW"
            log "  • Prerequisites: Docker, kubectl, KIND" "$YELLOW"
            log "  • Next: Will run scripts/quick-setup-kind.sh" "$YELLOW"
            ;;
        tauri)
            log "You selected: Tauri Desktop" "$GREEN"
            log ""
            log "What to expect:" "$CYAN"
            log "  • Setup time: 10-15 minutes (includes build)" "$YELLOW"
            log "  • Prerequisites: Node.js, Rust toolchain, Xcode" "$YELLOW"
            log "  • Next: Will guide you through Tauri setup" "$YELLOW"
            ;;
        vfkit)
            log "You selected: Apple Virtualization" "$GREEN"
            log ""
            log "What to expect:" "$CYAN"
            log "  • Setup time: 15-20 minutes (includes VM provisioning)" "$YELLOW"
            log "  • Prerequisites: macOS, vfkit, VM images" "$YELLOW"
            log "  • Next: Will guide you through vfkit setup" "$YELLOW"
            ;;
    esac

    echo ""
    log "Press ENTER to check prerequisites, or Ctrl+C to exit..."
    read -r
}

confirm_setup() {
    local mode="$1"

    echo ""
    log "Ready to begin setup for: $mode" "$GREEN"
    log ""
    log "Continue with setup? (y/n): " "$CYAN"

    read -r confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_warning "Setup cancelled by user"
        exit 0
    fi
}

###############################################################################
# Setup Execution
###############################################################################

run_docker_compose_setup() {
    log_header "Running Docker Compose Setup"

    local script="./scripts/quick-setup-docker-compose.sh"

    if [ ! -f "$script" ]; then
        log_error "ERROR: Setup script not found: $script"
        log_warning "Please ensure you're running this from the project root directory"
        exit 1
    fi

    local dry_run_flag=""
    if [ "$DRY_RUN" = true ]; then
        dry_run_flag="--dry-run"
    fi

    log_info "Executing: bash $script $dry_run_flag"
    echo ""

    bash "$script" $dry_run_flag
}

run_kind_setup() {
    log_header "Running KIND Kubernetes Setup"

    local script="./scripts/quick-setup-kind.sh"

    if [ ! -f "$script" ]; then
        log_error "ERROR: Setup script not found: $script"
        log_warning "Please ensure you're running this from the project root directory"
        exit 1
    fi

    local dry_run_flag=""
    if [ "$DRY_RUN" = true ]; then
        dry_run_flag="--dry-run"
    fi

    log_info "Executing: bash $script $dry_run_flag"
    echo ""

    bash "$script" $dry_run_flag
}

run_tauri_setup() {
    log_header "Tauri Desktop Setup"

    log_warning "Tauri Desktop setup is currently manual"
    echo ""
    log "Please follow these steps:" "$CYAN"
    echo ""
    log "1. Install Rust toolchain:" "$YELLOW"
    log "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh" "$YELLOW"
    echo ""
    log "2. Install Xcode Command Line Tools:" "$YELLOW"
    log "   xcode-select --install" "$YELLOW"
    echo ""
    log "3. Install Node.js dependencies:" "$YELLOW"
    log "   npm install" "$YELLOW"
    echo ""
    log "4. Build Tauri app:" "$YELLOW"
    log "   cd platforms/tauri" "$YELLOW"
    log "   npm run tauri build" "$YELLOW"
    echo ""
    log "5. Launch the application:" "$YELLOW"
    log "   npm run tauri dev" "$YELLOW"
    echo ""
    log "For more information, see:" "$CYAN"
    log "  docs/INSTALLATION_MASTER_GUIDE.md" "$YELLOW"
}

run_vfkit_setup() {
    log_header "Apple Virtualization (vfkit) Setup"

    log_warning "Apple Virtualization setup is currently manual"
    echo ""
    log "Please follow these steps:" "$CYAN"
    echo ""
    log "1. Install vfkit:" "$YELLOW"
    log "   brew install vfkit" "$YELLOW"
    echo ""
    log "2. Download a VM image (Ubuntu recommended):" "$YELLOW"
    log "   # Download from https://cloud-images.ubuntu.com/releases/22.04/release/" "$YELLOW"
    echo ""
    log "3. Configure and start VM:" "$YELLOW"
    log "   # See platforms/vfkit/README.md for detailed instructions" "$YELLOW"
    echo ""
    log "4. Deploy VibeCode inside the VM:" "$YELLOW"
    log "   # Use Docker Compose or Kubernetes within the VM" "$YELLOW"
    echo ""
    log "For more information, see:" "$CYAN"
    log "  docs/INSTALLATION_MASTER_GUIDE.md" "$YELLOW"
    log "  platforms/vfkit/README.md" "$YELLOW"
}

run_setup() {
    local mode="$1"

    case "$mode" in
        docker-compose)
            run_docker_compose_setup
            ;;
        kind)
            run_kind_setup
            ;;
        tauri)
            run_tauri_setup
            ;;
        vfkit)
            run_vfkit_setup
            ;;
        *)
            log_error "ERROR: Unknown mode: $mode"
            exit 1
            ;;
    esac
}

show_completion() {
    local mode="$1"

    echo ""
    log_header "Setup Wizard Complete!"

    log_success "✓ Deployment mode: $mode"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN COMPLETE - No changes were made"
        log_info "Run without --dry-run to apply changes"
    else
        log "Next steps:" "$CYAN"
        echo ""

        case "$mode" in
            docker-compose)
                log "• Start services: docker compose -f config/docker/docker-compose.dev.yml up -d" "$YELLOW"
                log "• View logs: docker compose -f config/docker/docker-compose.dev.yml logs -f" "$YELLOW"
                log "• Access app: http://localhost:3000" "$YELLOW"
                ;;
            kind)
                log "• Deploy app: kubectl apply -f platforms/kubernetes/k8s/vibecode-app-simple.yaml" "$YELLOW"
                log "• Check status: kubectl get pods -n vibecode" "$YELLOW"
                log "• Port forward: kubectl port-forward -n vibecode svc/vibecode 3000:80" "$YELLOW"
                ;;
            tauri|vfkit)
                log "• Follow the manual steps shown above" "$YELLOW"
                log "• Refer to documentation for detailed guidance" "$YELLOW"
                ;;
        esac

        echo ""
        log "📚 Documentation:" "$CYAN"
        log "  • Master guide: docs/INSTALLATION_MASTER_GUIDE.md" "$YELLOW"
        log "  • Quick start: docs/QUICKSTART_CHECKLIST.md" "$YELLOW"
        log "  • Troubleshooting: docs/setup/INSTALLATION_TROUBLESHOOTING.md" "$YELLOW"
    fi

    echo ""
}

###############################################################################
# Main Flow
###############################################################################

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mode)
                SELECTED_MODE="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --non-interactive)
                INTERACTIVE=false
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo ""
                show_usage
                exit 1
                ;;
        esac
    done

    # Validate arguments
    if [ "$INTERACTIVE" = false ] && [ -z "$SELECTED_MODE" ]; then
        log_error "ERROR: --non-interactive requires --mode"
        echo ""
        show_usage
        exit 1
    fi

    # Interactive wizard flow
    if [ "$INTERACTIVE" = true ] && [ -z "$SELECTED_MODE" ]; then
        show_welcome
        show_deployment_modes
        prompt_mode_selection
        show_mode_summary "$SELECTED_MODE"
    fi

    # Validate mode if provided via --mode
    if [ -n "$SELECTED_MODE" ]; then
        case "$SELECTED_MODE" in
            docker-compose|kind|tauri|vfkit)
                # Valid mode
                ;;
            *)
                log_error "ERROR: Invalid mode: $SELECTED_MODE"
                log_info "Valid modes: docker-compose, kind, tauri, vfkit"
                exit 1
                ;;
        esac
    fi

    # Check prerequisites
    if ! check_prerequisites "$SELECTED_MODE"; then
        log_error "Prerequisites check failed!"
        echo ""
        log_warning "Please install missing prerequisites and try again"
        log_info "See: docs/setup/PREREQUISITES.md"
        exit 1
    fi

    # Confirm setup
    if [ "$INTERACTIVE" = true ]; then
        confirm_setup "$SELECTED_MODE"
    fi

    # Run setup
    run_setup "$SELECTED_MODE"

    # Show completion
    show_completion "$SELECTED_MODE"
}

# Run main function
main "$@"
