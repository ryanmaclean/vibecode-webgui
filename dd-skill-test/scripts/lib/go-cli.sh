#!/bin/bash
# Helper for invoking the Go CLI from bash scripts

resolve_go_cli() {
    local base_dir="$1"
    local candidate=""

    if [ -n "${DD_SKILL_GO_CLI:-}" ] && [ -x "${DD_SKILL_GO_CLI}" ]; then
        echo "${DD_SKILL_GO_CLI}"
        return 0
    fi

    candidate="$base_dir/../datadog-skill-go/datadog-cli"
    if [ -x "$candidate" ]; then
        echo "$candidate"
        return 0
    fi

    echo ""
    return 1
}

run_go_cli() {
    local base_dir="$1"
    local command="$2"
    shift 2

    local go_cli
    go_cli="$(resolve_go_cli "$base_dir")" || true

    if [ -z "$go_cli" ]; then
        echo "[ERROR] Go CLI not found. Set DD_SKILL_GO_CLI or build datadog-skill-go/datadog-cli" >&2
        exit 1
    fi

    exec "$go_cli" "$command" "$@"
}
