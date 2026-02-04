#!/bin/bash
# Route beads to appropriate agents based on priority
# Usage: route-by-priority.sh <bead-id>

set -e

BEAD_ID="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ -z "$BEAD_ID" ]]; then
    echo "Usage: route-by-priority.sh <bead-id>"
    exit 1
fi

# Get bead info
BEAD_INFO=$(bd --no-daemon show "$BEAD_ID" --json 2>/dev/null)
if [[ -z "$BEAD_INFO" ]]; then
    echo "Error: Bead $BEAD_ID not found"
    exit 1
fi

PRIORITY=$(echo "$BEAD_INFO" | jq -r '.priority // 2')
LABELS=$(echo "$BEAD_INFO" | jq -r '.labels // [] | join(",")')

# Determine agent based on priority routing rules
determine_agent() {
    local priority=$1
    local labels=$2

    # Label-based routing takes precedence
    if [[ "$labels" == *"ollama-task"* ]] || [[ "$labels" == *"quick-check"* ]]; then
        echo "ollama-fast"
        return
    fi

    if [[ "$labels" == *"api-audit"* ]]; then
        echo "ollama"
        return
    fi

    # Priority-based routing
    case $priority in
        0|1)
            echo "claude"
            ;;
        2)
            echo "ollama"
            ;;
        3|4)
            echo "ollama-fast"
            ;;
        *)
            echo "claude"
            ;;
    esac
}

AGENT=$(determine_agent "$PRIORITY" "$LABELS")
echo "Routing $BEAD_ID (P$PRIORITY) to agent: $AGENT"

# Get agent command
case $AGENT in
    ollama-fast)
        AGENT_CMD="/Applications/Ollama.app/Contents/Resources/ollama run qwen2.5:1.5b"
        ;;
    ollama)
        AGENT_CMD="/Applications/Ollama.app/Contents/Resources/ollama run codellama:7b"
        ;;
    gemma)
        AGENT_CMD="/Applications/Ollama.app/Contents/Resources/ollama run gemma3n:latest"
        ;;
    claude)
        AGENT_CMD="claude --dangerously-skip-permissions"
        ;;
    codex)
        AGENT_CMD="codex --yolo"
        ;;
    *)
        AGENT_CMD="claude --dangerously-skip-permissions"
        ;;
esac

# Execute with tracing
if [[ -x "$SCRIPT_DIR/trace-agent.sh" ]]; then
    exec "$SCRIPT_DIR/trace-agent.sh" "$AGENT" "$BEAD_ID" $AGENT_CMD
else
    exec $AGENT_CMD
fi
