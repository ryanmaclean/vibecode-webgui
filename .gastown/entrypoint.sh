#!/bin/bash
# Gas Town Portable Runtime Entrypoint
# Toyota Production System Edition

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Gas Town (Toyota Way Edition) ===${NC}"
echo -e "Runtime: ${GASTOWN_RUNTIME:-native}"
echo -e "Genba: ${GENBA:-$(pwd)}"
echo ""

# Initialize Gas Town if not already done
if [ ! -d ".beads" ]; then
    echo -e "${YELLOW}Initializing Kanban board...${NC}"
    gt init
fi

# Command dispatch
case "${1:-sensei}" in
    sensei)
        echo -e "${GREEN}Starting Sensei (先生) - The Orchestrator${NC}"
        exec gt may at
        ;;
    jidoka)
        echo -e "${GREEN}Spawning Jidoka Workers (自働化)${NC}"
        POOL_SIZE=${2:-6}
        for i in $(seq 1 $POOL_SIZE); do
            gt polecat spawn &
        done
        wait
        ;;
    kaizen)
        echo -e "${GREEN}Running Kaizen (改善) Code Review${NC}"
        exec gt review --workflow kaizen
        ;;
    gemba)
        echo -e "${GREEN}Starting Gemba Walk (現場歩き) - Witness Patrol${NC}"
        exec gt witness patrol
        ;;
    heijunka)
        echo -e "${GREEN}Starting Heijunka (平準化) Convoy${NC}"
        exec gt convoy start "$@"
        ;;
    andon)
        echo -e "${GREEN}Checking Andon (行灯) Escalations${NC}"
        exec gt escalations list
        ;;
    muda)
        echo -e "${GREEN}Running Muda (無駄) Cleanup${NC}"
        exec gt cleanup --stale --orphaned
        ;;
    status)
        echo -e "${GREEN}Gas Town Status${NC}"
        gt status
        bd ls
        ;;
    *)
        echo "Usage: $0 {sensei|jidoka|kaizen|gemba|heijunka|andon|muda|status}"
        echo ""
        echo "Toyota Way Commands:"
        echo "  sensei   - Start the Orchestrator (Mayor)"
        echo "  jidoka   - Spawn autonomous workers (Polecats)"
        echo "  kaizen   - Run code review sweep"
        echo "  gemba    - Start anomaly patrol (Witness)"
        echo "  heijunka - Start load-balanced convoy"
        echo "  andon    - Check escalations"
        echo "  muda     - Eliminate waste (cleanup)"
        echo "  status   - Show current state"
        exit 1
        ;;
esac
