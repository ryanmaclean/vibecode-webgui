#!/bin/bash
set -euo pipefail

# Datadog Cloud Network Monitoring Setup for GitHub Actions
# This script configures CNM for CI/CD environments

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔧 Setting up Datadog Cloud Network Monitoring for GitHub Actions..."

# Check if running in GitHub Actions
if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "✅ Running in GitHub Actions environment"
    RUNNER_TYPE="github-actions"
else
    echo "ℹ️  Running in local environment"
    RUNNER_TYPE="local"
fi

# Function to check required environment variables
check_env_vars() {
    local missing_vars=()
    
    if [ -z "${DD_API_KEY:-}" ]; then
        missing_vars+=("DD_API_KEY")
    fi
    
    if [ -z "${DD_SITE:-}" ]; then
        missing_vars+=("DD_SITE")
    fi
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo "❌ Missing required environment variables: ${missing_vars[*]}"
        echo "Please set these variables in your GitHub Actions secrets or environment"
        return 1
    fi
    
    echo "✅ Required environment variables are set"
    return 0
}

# Function to configure CNM environment variables
configure_cnm_env() {
    echo "🔧 Configuring Cloud Network Monitoring environment variables..."
    
    # Core CNM settings
    export DD_SYSTEM_PROBE_NETWORK_ENABLED=true
    export DD_PROCESS_AGENT_ENABLED=true
    export DD_SYSTEM_PROBE_ENABLED=true
    
    # EBPF settings for GitHub Actions (ebpf-less mode)
    export DD_NETWORK_CONFIG_ENABLE_EBPFLESS=true
    export DD_NETWORK_CONFIG_ENABLE_EBPF=false
    
    # Network monitoring specific settings
    export DD_NETWORK_CONFIG_ENABLE_DNS_INSPECTION=true
    export DD_NETWORK_CONFIG_ENABLE_HTTP_MONITORING=true
    export DD_NETWORK_CONFIG_ENABLE_TCP_MONITORING=true
    
    # CI Visibility settings
    export DD_CI_VISIBILITY_ENABLED=true
    export DD_SERVICE="${DD_SERVICE:-vibecode-webgui}"
    export DD_ENV="${DD_ENV:-ci}"
    export DD_VERSION="${DD_VERSION:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"
    
    echo "✅ CNM environment variables configured"
}

# Function to install Datadog Agent (if needed)
install_datadog_agent() {
    if command -v datadog-agent &> /dev/null; then
        echo "✅ Datadog Agent is already installed"
        return 0
    fi
    
    echo "📦 Installing Datadog Agent..."
    
    if [ "$RUNNER_TYPE" = "github-actions" ]; then
        # For GitHub Actions, we'll use a lightweight approach
        echo "ℹ️  GitHub Actions detected - using ebpf-less mode"
        echo "No agent installation needed for ebpf-less CNM"
    else
        # For local development
        if [ -z "${DD_API_KEY:-}" ]; then
            echo "❌ DD_API_KEY is required for agent installation"
            return 1
        fi
        
        DD_API_KEY="$DD_API_KEY" DD_SITE="${DD_SITE:-datadoghq.com}" \
            bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"
    fi
}

# Function to create CNM configuration
create_cnm_config() {
    echo "📝 Creating CNM configuration..."
    
    local config_dir="/etc/datadog-agent/conf.d/network.d"
    
    if [ "$RUNNER_TYPE" = "github-actions" ]; then
        echo "ℹ️  GitHub Actions detected - using environment-based configuration"
        echo "CNM will be configured via environment variables"
    else
        # Create configuration directory
        sudo mkdir -p "$config_dir"
        
        # Create CNM configuration
        sudo tee "$config_dir/conf.yaml" > /dev/null <<EOF
init_config:

instances:
  - collect_tcp_metrics: true
    collect_dns_metrics: true
    collect_http_metrics: true
    enable_ebpf_less: true
    enable_ebpf: false
    network_config:
      enable_dns_inspection: true
      enable_http_monitoring: true
      enable_tcp_monitoring: true
EOF
        
        echo "✅ CNM configuration created at $config_dir/conf.yaml"
    fi
}

# Function to verify CNM setup
verify_cnm_setup() {
    echo "🔍 Verifying Cloud Network Monitoring setup..."
    
    # Check environment variables
    local required_vars=(
        "DD_SYSTEM_PROBE_NETWORK_ENABLED"
        "DD_PROCESS_AGENT_ENABLED"
        "DD_NETWORK_CONFIG_ENABLE_EBPFLESS"
    )
    
    for var in "${required_vars[@]}"; do
        if [ "${!var:-}" = "true" ]; then
            echo "✅ $var is enabled"
        else
            echo "❌ $var is not enabled"
            return 1
        fi
    done
    
    # Check Datadog Agent status (if available)
    if command -v datadog-agent &> /dev/null; then
        echo "✅ Datadog Agent is available"
        if datadog-agent status | grep -i "network" > /dev/null; then
            echo "✅ Network monitoring is active in agent"
        else
            echo "ℹ️  Network monitoring status not visible in agent status"
        fi
    else
        echo "ℹ️  Datadog Agent not available - using ebpf-less mode"
    fi
    
    echo "✅ CNM setup verification completed"
}

# Function to create GitHub Actions workflow template
create_workflow_template() {
    echo "📝 Creating GitHub Actions workflow template..."
    
    local template_file="$PROJECT_ROOT/.github/workflows/datadog-cnm-template.yml"
    
    cat > "$template_file" <<'EOF'
# Template for Datadog Cloud Network Monitoring in GitHub Actions
# Copy this configuration to your workflow files

env:
  # Core Datadog settings
  DD_API_KEY: ${{ secrets.DD_API_KEY }}
  DD_SITE: datadoghq.com
  
  # CI Visibility settings
  DD_CI_VISIBILITY_ENABLED: true
  DD_SERVICE: vibecode-webgui
  DD_ENV: ci
  DD_VERSION: ${{ github.sha }}
  
  # Cloud Network Monitoring settings
  DD_SYSTEM_PROBE_NETWORK_ENABLED: true
  DD_PROCESS_AGENT_ENABLED: true
  DD_SYSTEM_PROBE_ENABLED: true
  
  # EBPF settings for GitHub Actions (ebpf-less mode)
  DD_NETWORK_CONFIG_ENABLE_EBPFLESS: true
  DD_NETWORK_CONFIG_ENABLE_EBPF: false
  
  # Network monitoring specific settings
  DD_NETWORK_CONFIG_ENABLE_DNS_INSPECTION: true
  DD_NETWORK_CONFIG_ENABLE_HTTP_MONITORING: true
  DD_NETWORK_CONFIG_ENABLE_TCP_MONITORING: true
  
  # Git metadata for enhanced tracking
  DD_GIT_COMMIT_SHA: ${{ github.sha }}
  DD_GIT_REPOSITORY_URL: ${{ github.server_url }}/${{ github.repository }}
  DD_GIT_BRANCH: ${{ github.ref_name }}
  DD_GIT_COMMIT_MESSAGE: ${{ github.event.head_commit.message }}
  DD_GIT_COMMIT_AUTHOR_NAME: ${{ github.event.head_commit.author.name }}
  DD_GIT_COMMIT_AUTHOR_EMAIL: ${{ github.event.head_commit.author.email }}
  DD_GIT_COMMIT_AUTHOR_DATE: ${{ github.event.head_commit.timestamp }}
  DD_GIT_COMMIT_COMMITTER_NAME: ${{ github.event.head_commit.committer.name }}
  DD_GIT_COMMIT_COMMITTER_EMAIL: ${{ github.event.head_commit.committer.email }}
  DD_GIT_COMMIT_COMMITTER_DATE: ${{ github.event.head_commit.timestamp }}

# Add this step to your workflow
steps:
  - name: Setup Datadog CNM
    run: |
      echo "Setting up Cloud Network Monitoring..."
      echo "DD_SYSTEM_PROBE_NETWORK_ENABLED=$DD_SYSTEM_PROBE_NETWORK_ENABLED"
      echo "DD_NETWORK_CONFIG_ENABLE_EBPFLESS=$DD_NETWORK_CONFIG_ENABLE_EBPFLESS"
      echo "DD_PROCESS_AGENT_ENABLED=$DD_PROCESS_AGENT_ENABLED"
EOF
    
    echo "✅ Workflow template created at $template_file"
}

# Function to test CNM integration
test_cnm_integration() {
    echo "🧪 Testing CNM integration..."
    
    # Test environment variables
    echo "Testing environment variables:"
    echo "  DD_SYSTEM_PROBE_NETWORK_ENABLED: ${DD_SYSTEM_PROBE_NETWORK_ENABLED:-not set}"
    echo "  DD_NETWORK_CONFIG_ENABLE_EBPFLESS: ${DD_NETWORK_CONFIG_ENABLE_EBPFLESS:-not set}"
    echo "  DD_PROCESS_AGENT_ENABLED: ${DD_PROCESS_AGENT_ENABLED:-not set}"
    
    # Test network connectivity (if possible)
    if command -v curl &> /dev/null; then
        echo "Testing network connectivity to Datadog..."
        if curl -s --max-time 10 "https://api.${DD_SITE:-datadoghq.com}" > /dev/null; then
            echo "✅ Network connectivity to Datadog is working"
        else
            echo "⚠️  Network connectivity to Datadog may be limited"
        fi
    fi
    
    echo "✅ CNM integration test completed"
}

# Main execution
main() {
    echo "🚀 Starting Datadog Cloud Network Monitoring setup..."
    
    # Check environment variables
    if ! check_env_vars; then
        echo "❌ Setup failed due to missing environment variables"
        exit 1
    fi
    
    # Configure CNM environment
    configure_cnm_env
    
    # Install Datadog Agent (if needed)
    install_datadog_agent
    
    # Create CNM configuration
    create_cnm_config
    
    # Verify setup
    verify_cnm_setup
    
    # Create workflow template
    create_workflow_template
    
    # Test integration
    test_cnm_integration
    
    echo "🎉 Datadog Cloud Network Monitoring setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Ensure your GitHub Actions workflows include the CNM environment variables"
    echo "2. Run a test pipeline to verify network data appears in Datadog"
    echo "3. Check the CI Visibility dashboard for network metrics"
    echo ""
    echo "For troubleshooting, see: .github/datadog-cnm-config.yml"
}

# Run main function
main "$@"
