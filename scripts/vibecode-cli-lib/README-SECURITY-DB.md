# Security & Database Operations Menus

This document describes the Security & Compliance and Database Operations menu modules for vibecode-cli.

## Security & Compliance Menu

The Security & Compliance menu (`security-menu.sh`) provides access to security scanning, license verification, authentication setup, and compliance reporting.

### Main Menu Options

1. **Security Scans** - Vulnerability and security analysis
2. **License Checks** - License verification and compliance
3. **SAML & Authentication** - Authentication setup and testing
4. **Compliance Reports** - Security and license reporting
5. **Security Monitoring** - Security monitoring setup

### Security Scans Submenu

- **Vulnerability Scan** - Run `vulnerability-scan.sh` to check for known vulnerabilities
- **Security Audit (Full)** - Execute comprehensive security audit with `security-audit.sh`
- **Security Scan (Quick)** - Quick security scan using `security-scan.sh`
- **SAST Analysis** - Static Application Security Testing (not yet implemented)
- **Security Test Suite** - Run security test suite with `security-test.sh`

### License Checks Submenu

- **Verify Extension Licenses** - Check VSCode extension licenses with `verify-extension-licenses.sh`
- **Check All Licenses** - Comprehensive license check using `check-licenses.sh`
- **Verify GPL-Free Status** - Ensure no GPL-licensed code with `verify-gpl-free.sh`

### SAML & Authentication Submenu

- **Deploy Authelia** - Deploy Authelia authentication with `deploy-authelia.sh`
- **Test Authelia Automation** - Test Authelia setup with `test-authelia-automation.sh`
- **Setup Authentication** - General authentication setup (not yet implemented)

### Compliance Reports Submenu

- **Generate Security Report** - (not yet implemented)
- **Generate License Report** - (not yet implemented)
- **Generate Full Compliance Report** - (not yet implemented)

### Security Monitoring Submenu

- **Setup Security Monitoring** - Initial setup with `security-setup.sh`
- **Run Security Monitoring** - Execute monitoring with `security-monitoring.sh`
- **Security Setup (Initial)** - Run initial security configuration
- **View Security Logs** - (not yet implemented)

## Database Operations Menu

The Database Operations menu (`db-menu.sh`) provides access to database migrations, monitoring, scaling, and validation operations.

### Main Menu Options

1. **Migrations** - Database migration operations
2. **Monitoring & DBM Setup** - Datadog DBM and APM integration
3. **Scaling & Performance** - Database scaling and performance testing
4. **Connection Validation** - Database connection testing and troubleshooting
5. **Database Scenarios** - DBM scenarios and test suites

### Migrations Submenu

- **Deploy Database Migrations** - Run migrations with `deploy-database-migrations.sh`
- **Check Migration Status** - (not yet implemented)
- **Rollback Last Migration** - (not yet implemented, includes safety confirmation)
- **Validate Migration Files** - (not yet implemented)

### Monitoring & DBM Setup Submenu

- **Deploy Datadog DBM** - Deploy Datadog Database Monitoring with `deploy-datadog-dbm.sh`
- **Test DBM Setup** - Verify DBM setup with `test-dbm-setup.sh`
- **Deploy DBM + APM (All Environments)** - Deploy to all environments with `deploy-dbm-apm-all.sh`
- **Deploy DBM + APM (Azure)** - Deploy to Azure with `deploy-dbm-apm-azure.sh`
- **Deploy DBM + APM (KIND)** - Deploy to KIND cluster with `deploy-dbm-apm-kind.sh`
- **Validate DBM-APM Connection** - Test connection with `validate-dbm-apm-connection.sh`
- **Check Datadog DBM Metrics** - View metrics with `check-datadog-dbmon-metrics.sh`
- **Verify Datadog DBM** - Full verification with `verify-datadog-dbm.sh`

### Scaling & Performance Submenu

- **Test Database Scaling** - Run scaling tests with `test-database-scaling.sh`
- **Setup K8s DB Scaling** - Configure Kubernetes autoscaling with `setup-k8s-db-scaling.sh`
- **Run Performance Tests** - (not yet implemented)
- **Run Load Tests** - (not yet implemented)
- **Benchmark Database** - (not yet implemented)

### Connection Validation Submenu

- **Validate Database Config** - Verify configuration with `validate-database-config.sh`
- **Test Database Connection** - (not yet implemented)
- **Check Connection Pool** - (not yet implemented)
- **Troubleshoot Database** - Run diagnostics with `troubleshoot-database.sh`

### Database Scenarios Submenu

- **Run DBM Scenarios** - Execute DBM test scenarios with `run-dbm-scenarios.sh`
- **Test DBM-APM API** - API integration tests with `tests/datadog/test-dbm-apm-api.sh`
- **Run All Scenarios** - (not yet implemented)
- **Custom Scenario** - (not yet implemented)

## Script Mapping

### Security Scripts

- `scripts/security-scan.sh` - Quick security scan
- `scripts/security-audit.sh` - Comprehensive security audit
- `scripts/security-test.sh` - Security test suite
- `scripts/security-monitoring.sh` - Security monitoring
- `scripts/security-setup.sh` - Initial security setup
- `scripts/vulnerability-scan.sh` - Vulnerability scanning
- `scripts/verify-extension-licenses.sh` - Extension license verification
- `scripts/check-licenses.sh` - License compliance check
- `scripts/verify-gpl-free.sh` - GPL-free verification
- `scripts/deploy-authelia.sh` - Authelia deployment
- `scripts/test-authelia-automation.sh` - Authelia testing

### Database Scripts

- `scripts/deploy-database-migrations.sh` - Database migrations
- `scripts/validate-database-config.sh` - Configuration validation
- `scripts/test-database-scaling.sh` - Scaling tests
- `scripts/setup-k8s-db-scaling.sh` - Kubernetes scaling setup
- `scripts/deploy-datadog-dbm.sh` - DBM deployment
- `scripts/test-dbm-setup.sh` - DBM testing
- `scripts/deploy-dbm-apm-all.sh` - DBM+APM all environments
- `scripts/deploy-dbm-apm-azure.sh` - DBM+APM for Azure
- `scripts/deploy-dbm-apm-kind.sh` - DBM+APM for KIND
- `scripts/validate-dbm-apm-connection.sh` - Connection validation
- `scripts/check-datadog-dbmon-metrics.sh` - Metrics checking
- `scripts/verify-datadog-dbm.sh` - DBM verification
- `scripts/run-dbm-scenarios.sh` - DBM scenarios
- `scripts/tests/datadog/test-dbm-apm-api.sh` - API tests
- `scripts/troubleshoot-database.sh` - Database troubleshooting

## Usage

These menus are designed to be integrated into the main vibecode-cli framework. They can be sourced and called from the main menu:

```bash
# Source the menu modules
source scripts/vibecode-cli-lib/security-menu.sh
source scripts/vibecode-cli-lib/db-menu.sh

# Call from main menu
show_security_menu
show_database_menu
```

## Integration with vibecode-cli

To integrate these menus into the main vibecode-cli, add menu options in the main CLI that call:

- `show_security_menu` for Security & Compliance operations
- `show_database_menu` for Database Operations

Both menus follow the vibecode-cli framework conventions:
- Use `common.sh` for dialog utilities and logging
- Use breadcrumb navigation
- Execute scripts with proper logging via `execute_command`
- Mark incomplete features with `show_not_implemented`

## Dependencies

- `common.sh` - Common utilities and dialog functions
- `dialog` or `whiptail` - TUI framework (auto-detected)
- All mapped shell scripts must exist in `${VIBECODE_SCRIPTS}` directory
