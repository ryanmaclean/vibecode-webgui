#!/usr/bin/env bash

#####################################################################
# Common Utilities for VibeCode CLI
# Shared functions used across all menu systems
#####################################################################

# Colors and formatting (can be reused)
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly MAGENTA='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

#####################################################################
# Display Helper Functions
#####################################################################

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

print_success() {
    local msg="$1"
    echo -e "${GREEN}✓ ${msg}${NC}"
}

print_error() {
    local msg="$1"
    echo -e "${RED}✗ ${msg}${NC}"
}

print_warning() {
    local msg="$1"
    echo -e "${YELLOW}⚠ ${msg}${NC}"
}

print_info() {
    local msg="$1"
    echo -e "${CYAN}ℹ ${msg}${NC}"
}

#####################################################################
# Validation Functions
#####################################################################

check_command_exists() {
    local cmd="$1"
    if ! command -v "${cmd}" &> /dev/null; then
        print_error "Required command '${cmd}' not found"
        return 1
    fi
    return 0
}

check_file_exists() {
    local file="$1"
    if [[ ! -f "${file}" ]]; then
        print_error "Required file not found: ${file}"
        return 1
    fi
    return 0
}

check_docker_running() {
    if ! docker info &> /dev/null; then
        print_error "Docker is not running"
        return 1
    fi
    return 0
}

check_kubectl_context() {
    if ! kubectl config current-context &> /dev/null; then
        print_error "No kubectl context set"
        return 1
    fi
    print_info "Current context: $(kubectl config current-context)"
    return 0
}

#####################################################################
# Confirmation Functions
#####################################################################

confirm_action() {
    local msg="$1"
    local default="${2:-n}"

    if [[ "${default,,}" == "y" ]]; then
        read -rp "${msg} [Y/n]: " response
        response="${response:-y}"
    else
        read -rp "${msg} [y/N]: " response
        response="${response:-n}"
    fi

    [[ "${response,,}" =~ ^y(es)?$ ]]
}

#####################################################################
# Script Execution Logging
#####################################################################

log_execution() {
    local script_name="$1"
    local status="$2"
    local log_file="${HOME}/.vibecode-cli.log"

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${script_name} - ${status}" >> "${log_file}"
}

#####################################################################
# Environment Detection
#####################################################################

detect_platform() {
    case "$(uname -s)" in
        Darwin*)    echo "macos" ;;
        Linux*)     echo "linux" ;;
        CYGWIN*)    echo "windows" ;;
        MINGW*)     echo "windows" ;;
        *)          echo "unknown" ;;
    esac
}

detect_arch() {
    uname -m
}

is_apple_silicon() {
    [[ "$(uname -m)" == "arm64" ]] && [[ "$(uname -s)" == "Darwin" ]]
}

#####################################################################
# Progress Indicators
#####################################################################

show_spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while ps -p $pid > /dev/null; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

#####################################################################
# Script Management
#####################################################################

list_available_scripts() {
    local dir="$1"
    local pattern="${2:-*.sh}"

    if [[ ! -d "${dir}" ]]; then
        print_error "Directory not found: ${dir}"
        return 1
    fi

    echo -e "${BOLD}Available scripts in ${dir}:${NC}"
    find "${dir}" -maxdepth 1 -name "${pattern}" -type f -exec basename {} \; | sort
}

#####################################################################
# Exports
#####################################################################

# Export functions for use in other scripts
export -f print_menu_item
export -f print_section_header
export -f print_success
export -f print_error
export -f print_warning
export -f print_info
export -f check_command_exists
export -f check_file_exists
export -f check_docker_running
export -f confirm_action
export -f detect_platform
export -f detect_arch
export -f is_apple_silicon
