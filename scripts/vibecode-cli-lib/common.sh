#!/usr/bin/env bash
# vibecode-cli Common Functions
# Shared utilities for the TUI framework

set -euo pipefail

# Colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export MAGENTA='\033[0;35m'
export CYAN='\033[0;36m'
export NC='\033[0m' # No Color

# Paths
export VIBECODE_ROOT="${VIBECODE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export VIBECODE_SCRIPTS="${VIBECODE_ROOT}/scripts"
export VIBECODE_LOGS="${VIBECODE_ROOT}/logs"
export VIBECODE_CLI_LOG="${VIBECODE_LOGS}/vibecode-cli.log"

# Ensure log directory exists
mkdir -p "${VIBECODE_LOGS}"

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" >> "${VIBECODE_CLI_LOG}"
}

log_info() {
    log "INFO" "$@"
    echo -e "${CYAN}[INFO]${NC} $*"
}

log_success() {
    log "SUCCESS" "$@"
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    log "WARNING" "$@"
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    log "ERROR" "$@"
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

# Detect which dialog tool to use
detect_dialog() {
    if command -v dialog &> /dev/null; then
        echo "dialog"
    elif command -v whiptail &> /dev/null; then
        echo "whiptail"
    else
        log_error "Neither dialog nor whiptail found. Please install one of them."
        echo "  macOS: dialog is built-in, or: brew install dialog"
        echo "  Linux: sudo apt-get install dialog  OR  sudo yum install dialog"
        exit 1
    fi
}

export DIALOG_TOOL=$(detect_dialog)

# Dialog wrapper functions
show_menu() {
    local title="$1"
    local breadcrumb="$2"
    shift 2
    local items=("$@")

    local temp_file=$(mktemp)
    trap "rm -f ${temp_file}" EXIT

    if [[ "${DIALOG_TOOL}" == "dialog" ]]; then
        dialog --clear --title "${title}" \
               --backtitle "${breadcrumb}" \
               --menu "Select an option:" 20 70 15 \
               "${items[@]}" 2>"${temp_file}"
    else
        whiptail --clear --title "${title}" \
                 --backtitle "${breadcrumb}" \
                 --menu "Select an option:" 20 70 15 \
                 "${items[@]}" 2>"${temp_file}"
    fi

    local exit_code=$?
    local choice=$(cat "${temp_file}" 2>/dev/null || echo "")
    rm -f "${temp_file}"

    if [[ ${exit_code} -eq 0 ]]; then
        echo "${choice}"
        return 0
    else
        return 1
    fi
}

show_msgbox() {
    local title="$1"
    local message="$2"
    local height="${3:-10}"
    local width="${4:-60}"

    if [[ "${DIALOG_TOOL}" == "dialog" ]]; then
        dialog --clear --title "${title}" --msgbox "${message}" ${height} ${width}
    else
        whiptail --clear --title "${title}" --msgbox "${message}" ${height} ${width}
    fi
}

show_yesno() {
    local title="$1"
    local question="$2"
    local height="${3:-10}"
    local width="${4:-60}"

    if [[ "${DIALOG_TOOL}" == "dialog" ]]; then
        dialog --clear --title "${title}" --yesno "${question}" ${height} ${width}
    else
        whiptail --clear --title "${title}" --yesno "${question}" ${height} ${width}
    fi
}

show_inputbox() {
    local title="$1"
    local prompt="$2"
    local default="${3:-}"
    local height="${4:-10}"
    local width="${5:-60}"

    local temp_file=$(mktemp)
    trap "rm -f ${temp_file}" EXIT

    if [[ "${DIALOG_TOOL}" == "dialog" ]]; then
        dialog --clear --title "${title}" \
               --inputbox "${prompt}" ${height} ${width} "${default}" 2>"${temp_file}"
    else
        whiptail --clear --title "${title}" \
                 --inputbox "${prompt}" ${height} ${width} "${default}" 2>"${temp_file}"
    fi

    local exit_code=$?
    local result=$(cat "${temp_file}" 2>/dev/null || echo "")
    rm -f "${temp_file}"

    if [[ ${exit_code} -eq 0 ]]; then
        echo "${result}"
        return 0
    else
        return 1
    fi
}

show_infobox() {
    local title="$1"
    local message="$2"
    local height="${3:-10}"
    local width="${4:-60}"

    if [[ "${DIALOG_TOOL}" == "dialog" ]]; then
        dialog --clear --title "${title}" --infobox "${message}" ${height} ${width}
    else
        whiptail --clear --title "${title}" --infobox "${message}" ${height} ${width}
    fi
}

# Execute a command with logging
execute_command() {
    local description="$1"
    shift
    local command=("$@")

    log_info "Executing: ${description}"
    log_info "Command: ${command[*]}"

    show_infobox "Executing" "${description}\n\nPlease wait..." 8 60

    if "${command[@]}" >> "${VIBECODE_CLI_LOG}" 2>&1; then
        log_success "Command completed: ${description}"
        show_msgbox "Success" "Operation completed successfully:\n\n${description}" 10 60
        return 0
    else
        local exit_code=$?
        log_error "Command failed (exit code: ${exit_code}): ${description}"
        show_msgbox "Error" "Operation failed:\n\n${description}\n\nExit code: ${exit_code}\n\nCheck ${VIBECODE_CLI_LOG} for details." 12 60
        return ${exit_code}
    fi
}

# Placeholder function for not-yet-implemented features
show_not_implemented() {
    local feature="$1"
    log_warning "Feature not yet implemented: ${feature}"
    show_msgbox "Coming Soon" "This feature is not yet implemented:\n\n${feature}\n\nPlease check back in a future update." 10 60
}

# Clear screen helper
clear_screen() {
    clear
    if [[ "${DIALOG_TOOL}" == "dialog" ]]; then
        dialog --clear
    else
        whiptail --clear
    fi
}
