#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Docker wrapper for OpenTofu to ensure consistent versions
# Usage: ./tofu-docker.sh [tofu command arguments]

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Configuration
OPENTOFU_VERSION="1.7.3"
DOCKER_IMAGE="ghcr.io/opentofu/opentofu:${OPENTOFU_VERSION}"
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOFU_DIR="${WORKSPACE_DIR}/tofu"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        log_info "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        log_info "Please start Docker daemon"
        exit 1
    fi
}

# Pull OpenTofu Docker image if not present
pull_image() {
    if ! docker image inspect "${DOCKER_IMAGE}" &> /dev/null; then
        log_info "Pulling OpenTofu Docker image: ${DOCKER_IMAGE}"
        docker pull "${DOCKER_IMAGE}"
    fi
}

# Check if we're in the right directory
check_directory() {
    if [[ ! -d "${TOFU_DIR}" ]]; then
        log_error "Tofu directory not found: ${TOFU_DIR}"
        log_info "Please run this script from the project root or ensure tofu/ directory exists"
        exit 1
    fi
}

# Set up Azure authentication for container
setup_azure_auth() {
    local auth_args=""

    # Check if Azure CLI is authenticated
    if az account show &> /dev/null; then
        # Mount Azure CLI configuration
        local azure_config_dir="${HOME}/.azure"
        if [[ -d "${azure_config_dir}" ]]; then
            auth_args="${auth_args} -v ${azure_config_dir}:/root/.azure:ro"
            log_info "Azure CLI configuration mounted"
        fi
    else
        log_warn "Azure CLI not authenticated. Some operations may fail."
        log_info "Run 'az login' to authenticate"
    fi

    echo "${auth_args}"
}

# Main execution function
run_tofu() {
    local azure_auth_args
    azure_auth_args="$(setup_azure_auth)"

    # Set up environment variables for container
    local env_args=""

    # Pass through Azure-related environment variables
    for var in ARM_CLIENT_ID ARM_CLIENT_SECRET ARM_SUBSCRIPTION_ID ARM_TENANT_ID; do
        if [[ -n "${!var:-}" ]]; then
            env_args="${env_args} -e ${var}=${!var}"
        fi
    done

    # Pass through Datadog keys if set
    for var in DATADOG_API_KEY DATADOG_APP_KEY; do
        if [[ -n "${!var:-}" ]]; then
            env_args="${env_args} -e ${var}=${!var}"
        fi
    done

    log_info "Running OpenTofu v${OPENTOFU_VERSION}: $*"

    # Execute OpenTofu in container
    # shellcheck disable=SC2086
    docker run --rm -it \
        -v "${TOFU_DIR}:/workspace" \
        -w /workspace \
        ${azure_auth_args} \
        ${env_args} \
        "${DOCKER_IMAGE}" \
        "$@"
}

# Help function
show_help() {
    cat <<EOF
OpenTofu Docker Wrapper v${OPENTOFU_VERSION}

Usage: $(basename "$0") [OPTIONS] COMMAND [ARGS...]

This script runs OpenTofu commands in a Docker container to ensure consistent
versions across different environments.

Examples:
  $(basename "$0") version
  $(basename "$0") init
  $(basename "$0") plan -var-file=dev.tfvars
  $(basename "$0") apply -auto-approve

Options:
  -h, --help    Show this help message

Common OpenTofu Commands:
  init          Initialize working directory
  plan          Create execution plan
  apply         Apply changes
  destroy       Destroy infrastructure
  validate      Validate configuration
  fmt           Format configuration files
  version       Show OpenTofu version

Requirements:
- Docker must be installed and running
- Azure CLI authentication (for Azure operations)
- Proper directory structure with tofu/ directory

For more information about OpenTofu: https://opentofu.org/
EOF
}

# Parse arguments
case "${1:-}" in
    -h|--help|help)
        show_help
        exit 0
        ;;
    "")
        log_error "No command specified"
        show_help
        exit 1
        ;;
esac

# Main execution
main() {
    check_docker
    check_directory
    pull_image
    run_tofu "$@"
}

# Run main function with all arguments
main "$@"