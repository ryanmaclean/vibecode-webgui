# shellcheck shell=bash
# Shared logging helpers for bash scripts.

if [[ -n "${LOGGING_SH_SOURCED:-}" ]]; then
  return
fi

LOGGING_SH_SOURCED=1

# ANSI color codes
LOG_COLOR_RED='\033[0;31m'
LOG_COLOR_GREEN='\033[0;32m'
LOG_COLOR_YELLOW='\033[0;33m'
LOG_COLOR_BLUE='\033[0;34m'
LOG_COLOR_RESET='\033[0m'

# Backwards-compatible color aliases for legacy scripts that expect the
# uppercase variables directly after sourcing.
: "${RED:=${LOG_COLOR_RED}}"
: "${GREEN:=${LOG_COLOR_GREEN}}"
: "${YELLOW:=${LOG_COLOR_YELLOW}}"
: "${BLUE:=${LOG_COLOR_BLUE}}"
: "${NC:=${LOG_COLOR_RESET}}"

log_info() {
  printf '%bINFO:%b %s\n' "${LOG_COLOR_BLUE}" "${LOG_COLOR_RESET}" "$*"
}

log_success() {
  printf '%bSUCCESS:%b %s\n' "${LOG_COLOR_GREEN}" "${LOG_COLOR_RESET}" "$*"
}

log_warn() {
  printf '%bWARNING:%b %s\n' "${LOG_COLOR_YELLOW}" "${LOG_COLOR_RESET}" "$*"
}

log_error() {
  printf '%bERROR:%b %s\n' "${LOG_COLOR_RED}" "${LOG_COLOR_RESET}" "$*" >&2
}

log_step() {
  printf '\n%b==>%b %s\n' "${LOG_COLOR_GREEN}" "${LOG_COLOR_RESET}" "$*"
}

# Alias used by older scripts that relied on log_warning().
log_warning() {
  log_warn "$@"
}
