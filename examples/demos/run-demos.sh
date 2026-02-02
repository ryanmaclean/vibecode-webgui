#!/bin/bash
#
# VibeCode Demo Runner
#
# Runs demos with proper environment setup and error handling
# Sources .env.local for API keys (not committed to repo)
#

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$SCRIPT_DIR/venv"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Banner
echo "======================================================================"
echo "  VibeCode Demo Runner"
echo "======================================================================"
echo ""

# 1. Source .env.local for API keys
log_info "Loading environment variables from .env.local..."
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    set -a  # Automatically export all variables
    source "$PROJECT_ROOT/.env.local"
    set +a
    log_success "Loaded .env.local"

    # Verify critical keys
    if [ -z "$DD_API_KEY" ]; then
        log_warning "DD_API_KEY not found in .env.local"
    else
        log_success "DD_API_KEY loaded (${DD_API_KEY:0:10}...)"
    fi

    if [ -z "$OPENAI_API_KEY" ]; then
        log_warning "OPENAI_API_KEY not set (required for AI demos)"
    else
        log_success "OPENAI_API_KEY loaded (${OPENAI_API_KEY:0:10}...)"
    fi
else
    log_error ".env.local not found at $PROJECT_ROOT/.env.local"
    log_info "Create .env.local with your API keys:"
    echo ""
    echo "  DD_API_KEY=<your-key-here>"
    echo "  OPENAI_API_KEY=<your-key-here>"
    echo ""
    exit 1
fi

# 2. Set Python 3.14 compatibility flag
export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1
log_info "Set Python 3.14 compatibility flag (PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1)"

# 3. Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
log_info "Python version: $PYTHON_VERSION"

# 4. Setup virtual environment
if [ ! -d "$VENV_DIR" ]; then
    log_info "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    log_success "Virtual environment created"
fi

# 5. Activate virtual environment
log_info "Activating virtual environment..."
source "$VENV_DIR/bin/activate"
log_success "Virtual environment activated"

# 6. Install dependencies
log_info "Installing/upgrading dependencies..."
pip install --upgrade pip setuptools wheel -q
pip install -r "$SCRIPT_DIR/requirements.txt" -q 2>&1 | grep -E "(Successfully|error|ERROR)" || true
log_success "Dependencies installed"

# 7. Display menu
echo ""
echo "======================================================================"
echo "  Available Demos"
echo "======================================================================"
echo ""
echo "FREE Demos (No API costs):"
echo "  1. Datadog LLM Obs Agentless Proof (verify Datadog integration)"
echo "  2. Datadog dd-trace Basic Test (verify APM tracing)"
echo "  3. CrewAI VM Management Demo (no LLM calls, free)"
echo ""
echo "PAID Demos (Requires OpenAI API key):"
echo "  4. CrewAI Daily Health Check (~\$0.20-0.40 per run)"
echo "  5. Datadog LLM Obs I/O Capture Test (~\$0.01)"
echo ""
echo "Utilities:"
echo "  6. Run all FREE demos"
echo "  7. Install dependencies only"
echo "  0. Exit"
echo ""

# Function to run a demo with error handling
run_demo() {
    local demo_file="$1"
    local demo_name="$2"
    local demo_cost="$3"

    echo ""
    echo "======================================================================"
    echo "  Running: $demo_name"
    if [ -n "$demo_cost" ]; then
        echo "  Cost: $demo_cost"
    fi
    echo "======================================================================"
    echo ""

    if [ ! -f "$SCRIPT_DIR/$demo_file" ]; then
        log_error "Demo file not found: $demo_file"
        return 1
    fi

    # Run the demo and capture exit code
    if python "$SCRIPT_DIR/$demo_file"; then
        echo ""
        log_success "Demo completed successfully: $demo_name"
        return 0
    else
        EXIT_CODE=$?
        echo ""
        log_error "Demo failed with exit code $EXIT_CODE: $demo_name"
        return $EXIT_CODE
    fi
}

# Menu selection
if [ -n "$1" ]; then
    # Non-interactive mode (argument passed)
    CHOICE="$1"
else
    # Interactive mode
    read -p "Select demo (0-7): " CHOICE
fi

case $CHOICE in
    1)
        run_demo "datadog-llmobs-agentless-proof.py" "Datadog LLM Obs Agentless Proof" "FREE"
        ;;
    2)
        run_demo "datadog-ddtrace-basic-test.py" "Datadog dd-trace Basic Test" "FREE"
        ;;
    3)
        run_demo "crewai-vm-management-demo.py" "CrewAI VM Management Demo" "FREE"
        ;;
    4)
        if [ -z "$OPENAI_API_KEY" ]; then
            log_error "OPENAI_API_KEY not set. Add to .env.local"
            exit 1
        fi
        log_warning "This demo will cost ~\$0.20-0.40 in OpenAI API calls"
        read -p "Continue? (y/N): " CONFIRM
        if [[ $CONFIRM =~ ^[Yy]$ ]]; then
            run_demo "crewai-4-agent-openai-workflow.py" "CrewAI Daily Health Check" "~\$0.20-0.40"
        else
            log_info "Demo cancelled"
        fi
        ;;
    5)
        if [ -z "$OPENAI_API_KEY" ]; then
            log_error "OPENAI_API_KEY not set. Add to .env.local"
            exit 1
        fi
        log_warning "This demo will cost ~\$0.01 in OpenAI API calls"
        read -p "Continue? (y/N): " CONFIRM
        if [[ $CONFIRM =~ ^[Yy]$ ]]; then
            run_demo "datadog-llmobs-io-capture-test.py" "Datadog LLM Obs I/O Capture Test" "~\$0.01"
        else
            log_info "Demo cancelled"
        fi
        ;;
    6)
        log_info "Running all FREE demos..."
        run_demo "datadog-llmobs-agentless-proof.py" "Datadog LLM Obs Agentless Proof" "FREE"
        run_demo "datadog-ddtrace-basic-test.py" "Datadog dd-trace Basic Test" "FREE"
        run_demo "crewai-vm-management-demo.py" "CrewAI VM Management Demo" "FREE"
        log_success "All FREE demos completed"
        ;;
    7)
        log_success "Dependencies already installed"
        ;;
    0)
        log_info "Exiting"
        exit 0
        ;;
    *)
        log_error "Invalid selection: $CHOICE"
        exit 1
        ;;
esac

echo ""
echo "======================================================================"
log_success "Demo runner complete"
echo "======================================================================"
echo ""
echo "View results in Datadog:"
echo "  https://app.datadoghq.com/llm/traces"
echo ""
