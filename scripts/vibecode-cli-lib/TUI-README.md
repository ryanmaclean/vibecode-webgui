# VibeCode TUI Framework

Interactive Text User Interface (TUI) for managing VibeCode operations.

## Overview

This TUI framework consolidates 285+ shell scripts into an organized, navigable menu system with 7 main operational categories.

## Features

- **Dialog/Whiptail Support**: Automatically detects and uses available TUI tools
- **7 Main Categories**: Comprehensive organization of operations
- **Breadcrumb Navigation**: Always know where you are
- **Color-Coded Output**: Easy-to-read status messages
- **Operation Logging**: All operations logged to `logs/vibecode-cli.log`
- **Error Handling**: Graceful error handling and user feedback
- **Help System**: Built-in help and documentation

## Main Categories

1. **Development**
   - Code generation & scaffolding
   - Development environment setup
   - Build tools and dev servers
   - Git operations
   - Dependency management

2. **Testing & Validation**
   - Unit tests (Jest, etc.)
   - Integration tests
   - E2E tests (Cypress, Playwright)
   - Security testing
   - Code coverage

3. **Deployment**
   - Development environment
   - Staging environment
   - Production deployment
   - Docker/Container deployment
   - Kubernetes deployment
   - Cloud platforms (AWS/GCP/Azure)

4. **VM Management**
   - VM lifecycle (start/stop/restart)
   - VM creation & provisioning
   - VFKit operations
   - Snapshots & backups
   - Resource monitoring

5. **Security & Compliance**
   - Vulnerability scanning
   - Security audits
   - Compliance checks (GDPR, SOC2, HIPAA, etc.)
   - Secrets management
   - Certificate management

6. **Database Operations**
   - Database migrations
   - Backups and restore
   - Query operations
   - Schema management
   - Data seeding

7. **Monitoring & Observability**
   - Application monitoring
   - Infrastructure monitoring
   - Log management
   - Metrics & analytics
   - Alerts & notifications

## Usage

### Launch TUI

```bash
./scripts/vibecode-tui
```

### Skip Banner

```bash
./scripts/vibecode-tui --no-banner
```

### Show Help

```bash
./scripts/vibecode-tui --help
```

### Show Version

```bash
./scripts/vibecode-tui --version
```

## File Structure

```
scripts/
├── vibecode-tui              # Main entry point
└── vibecode-cli-lib/         # Library modules
    ├── common.sh             # Shared functions and utilities
    ├── menu-development.sh   # Development menu
    ├── menu-testing.sh       # Testing menu
    ├── menu-deployment.sh    # Deployment menu
    ├── menu-vm.sh           # VM management menu
    ├── menu-security.sh     # Security menu
    ├── menu-database.sh     # Database menu
    └── menu-monitoring.sh   # Monitoring menu
```

## Requirements

- bash 4.0 or higher
- dialog or whiptail (whiptail is built-in on macOS)
- Standard Unix tools (grep, sed, awk, etc.)

## Logging

All operations are logged to:
```
logs/vibecode-cli.log
```

Logs include:
- Timestamps
- Log levels (INFO, SUCCESS, WARNING, ERROR)
- Operation details
- Command execution results

## Development

### Adding New Menu Items

1. Open the appropriate menu file in `scripts/vibecode-cli-lib/`
2. Add new menu item to the `show_menu` call
3. Add corresponding case statement
4. Implement the functionality or use `show_not_implemented`

Example:

```bash
show_my_menu() {
    local choice=$(show_menu "My Menu" "breadcrumb" \
        "1" "New Feature" \
        "2" "Another Feature" \
        "3" "Back")
    
    case "${choice}" in
        1) implement_new_feature ;;
        2) implement_another_feature ;;
        3) return 0 ;;
    esac
}
```

### Using Common Functions

The `common.sh` library provides:

- `log_info()` - Log informational messages
- `log_success()` - Log success messages
- `log_warning()` - Log warnings
- `log_error()` - Log errors
- `show_menu()` - Display a menu
- `show_msgbox()` - Display a message box
- `show_yesno()` - Display a yes/no dialog
- `show_inputbox()` - Get user input
- `show_infobox()` - Show transient info
- `execute_command()` - Execute with logging
- `show_not_implemented()` - Placeholder for future features

### Testing Changes

1. Check syntax: `bash -n scripts/vibecode-tui`
2. Verify structure: `./scripts/vibecode-cli-lib/verify-structure.sh`
3. Test navigation: `./scripts/vibecode-tui --no-banner`

## Next Steps

1. Implement actual functionality for menu items
2. Connect to existing shell scripts
3. Add input validation
4. Add progress indicators for long operations
5. Implement script discovery and dynamic menu generation
6. Add configuration file support

## License

Part of the VibeCode project.
