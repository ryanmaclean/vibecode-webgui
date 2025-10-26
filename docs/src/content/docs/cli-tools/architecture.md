---
title: "CLI Architecture & Development"
description: "Technical architecture and development guide for the VibeCode CLI library"
sidebar:
  order: 3
---

# Vibecode CLI Library

This directory contains modular menu scripts for the Vibecode CLI, providing a unified interface for common development, deployment, and operations tasks.

## Architecture

### Design Philosophy

The Vibecode CLI follows a modular, menu-driven architecture that:

- **Separates concerns** - Each menu handles a specific domain (development, security, deployment, etc.)
- **Promotes reusability** - Common functions are shared across menus
- **Ensures consistency** - All menus follow the same UX patterns and conventions
- **Facilitates discovery** - Interactive menus help users find the right tools
- **Maintains flexibility** - Scripts can be called directly or through the CLI

### Directory Structure

```
scripts/
├── vibecode-cli-lib/          # Modular menu scripts
│   ├── README.md              # This file
│   ├── common.sh              # Shared utilities and functions
│   ├── dev-menu.sh            # Development & Testing menu
│   ├── security-menu.sh       # Security & Compliance menu
│   ├── database-menu.sh       # Database Operations menu
│   ├── deploy-menu.sh         # Deployment Automation menu
│   ├── vm-menu.sh             # VM Management menu
│   └── monitoring-menu.sh     # Monitoring & Observability menu
├── vibecode-cli/              # Installation and configuration
│   ├── install.sh             # CLI installation script
│   ├── uninstall.sh           # CLI removal script
│   └── validate-config.sh     # Configuration validation
├── VIBECODE_CLI.md            # User documentation
└── [individual scripts]       # Original standalone scripts
```

## Menu Organization

### 1. Development & Testing Menu (`dev-menu.sh`)

Handles development workflows, testing, and quality assurance.

**Features:**
- Local development setup and teardown
- Test execution (unit, integration, e2e)
- Code quality checks (lint, format, type-check)
- Build and compilation
- Development server management

**Key Scripts:**
- Local development setup scripts
- Test runners and validators
- Code quality tools
- Build automation

### 2. Security & Compliance Menu (`security-menu.sh`)

Manages security scanning, vulnerability assessment, and compliance checks.

**Features:**
- Dependency vulnerability scanning
- Security audits
- Secret detection
- Compliance validation
- Security monitoring
- Penetration testing tools

**Key Scripts:**
- `security-monitoring.sh` - Continuous security monitoring
- Vulnerability scanners
- Secret detection tools
- Compliance validators

### 3. Database Operations Menu (`database-menu.sh`)

Provides database management, migrations, and operations.

**Features:**
- Schema migrations
- Database seeding
- Backup and restore
- Performance tuning
- Connection testing
- Query optimization

**Key Scripts:**
- Migration tools
- Seed scripts
- Backup utilities
- Database validators

### 4. Deployment Automation Menu (`deploy-menu.sh`)

Orchestrates deployment to various environments and platforms.

**Features:**
- Multi-environment deployment (dev, staging, prod)
- Platform-specific deployment (AKS, Fly.io, Docker)
- Blue/green deployments
- Rollback capabilities
- Deployment validation
- Infrastructure provisioning

**Key Scripts:**
- Platform deployment scripts
- Rollback utilities
- Deployment validators
- Infrastructure automation

### 5. VM Management Menu (`vm-menu.sh`)

Manages virtual machines for development and testing.

**Features:**
- VM creation and destruction
- VM configuration
- Snapshot management
- Resource monitoring
- VM provisioning
- Environment setup

**Key Scripts:**
- VM lifecycle scripts
- Configuration tools
- Provisioning automation
- Resource monitors

### 6. Monitoring & Observability Menu (`monitoring-menu.sh`)

Comprehensive monitoring, metrics, and observability tools.

**Features:**
- Datadog setup and configuration (APM, DBM, CNM)
- Performance baseline recording and comparison
- Log analysis (view, search, tail)
- Metrics dashboards (system and application)
- Health checks (system, services, dependencies)
- Security monitoring

**Key Scripts:**
- `deploy-monitoring.sh` - Deploy monitoring stack
- `setup-azure-openai-monitoring.sh` - Azure OpenAI monitoring
- `security-monitoring.sh` - Security monitoring daemon
- `test-monitoring.sh` - Monitoring validation
- Health check scripts
- Metrics collectors

## Common Utilities (`common.sh`)

Shared functions used across all menus:

### Logging Functions

```bash
log_info "message"      # Blue info message
log_success "message"   # Green success message
log_warn "message"      # Yellow warning message
log_error "message"     # Red error message
log_section "title"     # Section header
```

### Utility Functions

```bash
command_exists "cmd"    # Check if command is available
require_env "VAR"       # Ensure environment variable is set
confirm "prompt"        # Ask for user confirmation
select_option "opts"    # Present selection menu
```

### Color Constants

```bash
RED, GREEN, YELLOW, BLUE, CYAN, MAGENTA, NC
```

## Menu Development Guidelines

### 1. Structure

Each menu script should follow this structure:

```bash
#!/bin/bash
set -e

# 1. Source common utilities
source "$(dirname "$0")/common.sh"

# 2. Define menu-specific functions
function_name() {
    log_section "Function Title"
    # Implementation
}

# 3. Display menu
show_menu() {
    echo "1) Option One"
    echo "2) Option Two"
    echo "0) Back to Main Menu"
}

# 4. Main loop
main() {
    while true; do
        show_header
        show_menu
        read -p "Enter choice: " choice
        case $choice in
            1) function_name ;;
            0) exit 0 ;;
            *) log_error "Invalid choice" ;;
        esac
        read -p "Press Enter to continue..."
    done
}

main "$@"
```

### 2. Best Practices

**Error Handling:**
- Always use `set -e` to exit on errors
- Validate inputs before executing commands
- Provide clear error messages
- Handle missing dependencies gracefully

**User Experience:**
- Clear menu headers and descriptions
- Consistent color coding (blue for info, green for success, etc.)
- Confirmation prompts for destructive operations
- Progress indicators for long-running tasks

**Integration:**
- Check for script existence before calling
- Use absolute paths from `$SCRIPTS_DIR`
- Pass parameters explicitly
- Handle missing scripts gracefully

**Documentation:**
- Comment complex logic
- Include usage examples
- Document required environment variables
- List dependencies

### 3. Naming Conventions

**Functions:**
- Use snake_case: `deploy_monitoring`, `check_health`
- Prefix with action verb: `setup_`, `validate_`, `check_`
- Keep names descriptive but concise

**Variables:**
- UPPER_CASE for constants: `SCRIPTS_DIR`, `PROJECT_ROOT`
- lower_case for local variables: `choice`, `result`
- Meaningful names: `dd_api_key` not `key`

**Files:**
- Lowercase with hyphens: `monitoring-menu.sh`
- Descriptive names: `deploy-monitoring.sh`
- `.sh` extension for bash scripts

## Integration with Main CLI

The main Vibecode CLI (`vibecode-cli.sh`) provides:

1. **Top-level menu** - Lists all available menu categories
2. **Navigation** - Launches menu scripts from this directory
3. **Environment setup** - Sets common environment variables
4. **Help system** - Integrated help and documentation

Example main CLI structure:

```bash
#!/bin/bash
MENU_DIR="$(dirname "$0")/vibecode-cli-lib"

case $choice in
    1) bash "$MENU_DIR/dev-menu.sh" ;;
    2) bash "$MENU_DIR/security-menu.sh" ;;
    3) bash "$MENU_DIR/database-menu.sh" ;;
    4) bash "$MENU_DIR/deploy-menu.sh" ;;
    5) bash "$MENU_DIR/vm-menu.sh" ;;
    6) bash "$MENU_DIR/monitoring-menu.sh" ;;
esac
```

## Script Mapping

Migration from standalone scripts to menu structure:

| Original Script | Menu Category | Menu Option |
|----------------|---------------|-------------|
| `deploy-monitoring.sh` | Monitoring | Deploy Datadog Monitoring Stack |
| `setup-azure-openai-monitoring.sh` | Monitoring | Setup Azure OpenAI Monitoring |
| `security-monitoring.sh` | Monitoring | Start Security Monitoring |
| `test-monitoring.sh` | Monitoring | Validate Monitoring Setup |
| `setup-aks-datadog-monitoring.sh` | Monitoring | Setup AKS Datadog Monitoring |
| `setup-postgres-datadog-monitoring.sh` | Monitoring | Setup PostgreSQL Datadog Monitoring |
| `validate-healthchecks.sh` | Monitoring | Validate Health Endpoints |
| `test-health-endpoints.sh` | Monitoring | Check Services Health |

## Environment Variables

Common environment variables used across menus:

### Project Paths
```bash
PROJECT_ROOT          # Root directory of the project
SCRIPTS_DIR           # scripts/ directory path
MENU_DIR              # vibecode-cli-lib/ directory path
```

### Datadog Configuration
```bash
DD_API_KEY            # Datadog API key (preferred)
DATADOG_API_KEY       # Datadog API key (fallback)
DD_SERVICE            # Service name for APM
DD_ENV                # Environment (dev, staging, prod)
DD_VERSION            # Application version
DD_SITE               # Datadog site (datadoghq.com)
DD_LLMOBS_ENABLED     # Enable LLM observability
```

### Database Configuration
```bash
DATABASE_URL          # PostgreSQL connection string
POSTGRES_USER         # PostgreSQL username
POSTGRES_PASSWORD     # PostgreSQL password
POSTGRES_DB           # Database name
```

### Azure Configuration
```bash
AZURE_CLIENT_ID       # Azure service principal client ID
AZURE_CLIENT_SECRET   # Azure service principal secret
AZURE_TENANT_ID       # Azure tenant ID
AZURE_SUBSCRIPTION_ID # Azure subscription ID
```

### Deployment Configuration
```bash
ENVIRONMENT           # Target environment (production, staging, etc.)
DEPLOY_METHOD         # Deployment method (docker-compose, kubernetes)
NAMESPACE             # Kubernetes namespace
```

## Testing

### Unit Testing Menus

Each menu can be tested independently:

```bash
# Test menu navigation (dry-run mode)
bash scripts/vibecode-cli-lib/monitoring-menu.sh --dry-run

# Test specific function
bash -c 'source scripts/vibecode-cli-lib/monitoring-menu.sh && view_baselines'
```

### Integration Testing

Test menu integration with the main CLI:

```bash
# Test full CLI flow
bash scripts/vibecode-cli.sh

# Automated testing
bash scripts/test-vibecode-cli.sh
```

## Troubleshooting

### Common Issues

**Menu doesn't appear:**
- Check execute permissions: `chmod +x scripts/vibecode-cli-lib/*.sh`
- Verify script location is correct
- Check for syntax errors: `bash -n script.sh`

**Scripts not found:**
- Ensure `SCRIPTS_DIR` is set correctly
- Check relative paths from menu location
- Verify script exists in expected location

**Environment variables not set:**
- Source `.env` or `.env.local` before running
- Use `validate-config.sh` to check configuration
- Set required variables in environment

**Colors not displaying:**
- Terminal may not support ANSI colors
- Set `NO_COLOR=1` to disable colors
- Use a terminal with color support

## Contributing

### Adding a New Menu

1. Create menu script in `scripts/vibecode-cli-lib/`
2. Follow the structure outlined in "Menu Development Guidelines"
3. Add menu to main CLI navigation
4. Update documentation (this README and VIBECODE_CLI.md)
5. Add tests for new functionality
6. Update script mapping table

### Adding a Function to Existing Menu

1. Define function following naming conventions
2. Add menu option in `show_menu()`
3. Add case statement in `main()`
4. Update menu documentation
5. Test the new function

### Code Review Checklist

- [ ] Follows structure and naming conventions
- [ ] Includes error handling
- [ ] Has user-friendly messages and prompts
- [ ] Uses common utilities from `common.sh`
- [ ] Documents required environment variables
- [ ] Includes inline comments for complex logic
- [ ] Updated relevant documentation
- [ ] Tested independently and integrated

## Future Enhancements

### Planned Features

1. **Auto-completion** - Bash completion for menu navigation
2. **Configuration profiles** - Named configuration sets
3. **Parallel execution** - Run multiple operations concurrently
4. **Remote execution** - Execute scripts on remote hosts
5. **Audit logging** - Track all CLI operations
6. **Plugin system** - Allow custom menu extensions
7. **Web interface** - Browser-based CLI access
8. **AI assistance** - Natural language command interpretation

### Enhancement Requests

Submit enhancement requests via:
- GitHub Issues
- Pull Requests
- Team discussions

## References

- [Main CLI Documentation](../../../../../scripts/VIBECODE_CLI.md)
- [Installation Guide](../../../../../scripts/vibecode-cli/install.sh)
- [Project README](../../../../../README.md)
- [Development Docs](../../../../)

## Support

For help and support:
- Check documentation: `scripts/VIBECODE_CLI.md`
- Run with `--help` flag
- Review logs in `.vibecode-cli/logs/`
- Contact development team

---

**Last Updated:** 2025-10-24
**Version:** 1.0.0
**Maintainer:** Vibecode Platform Team
