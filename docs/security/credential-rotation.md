# Credential Rotation Guide

**Last Updated:** 2025-11-18  
**Owner:** Security Team  
**Review Cycle:** Quarterly

## Overview

This guide provides step-by-step procedures for rotating all credentials used in the VibeCode platform. Regular credential rotation is a critical security practice that limits the impact of potential credential compromise.

## Rotation Schedule

| Credential Type | Rotation Frequency | Owner | Risk Level |
|----------------|-------------------|-------|-----------|
| OpenAI API Keys | 90 days | Platform Team | 🔴 HIGH |
| Datadog API/APP Keys | 365 days | Observability Team | 🟡 MEDIUM |
| PostgreSQL Passwords | 90 days | Database Team | 🔴 HIGH |
| CSRF Secrets | 180 days | Security Team | 🟡 MEDIUM |
| NextAuth Secrets | 180 days | Security Team | 🔴 HIGH |
| JWT Secrets | 180 days | Security Team | 🔴 HIGH |
| Docker Hub Tokens | 90 days | DevOps Team | 🟡 MEDIUM |
| Azure Credentials | 180 days | Platform Team | 🟡 MEDIUM |

**Note:** Rotate immediately if:
- Credential exposure is suspected or confirmed
- Team member with access leaves the organization
- Security audit recommends rotation
- Compliance requirement mandates it

---

## Prerequisites

Before rotating any credentials, ensure you have:

1. **Access Required:**
   - Admin access to the relevant service (OpenAI, Datadog, etc.)
   - GitHub repository admin access for secrets
   - Production environment access (if applicable)
   - Secret management tool access (1Password, Azure Key Vault, etc.)

2. **Tools Installed:**
   - `gh` - GitHub CLI
   - `openssl` - For generating secure secrets
   - `psql` - PostgreSQL client (for database rotation)
   - Service-specific CLIs (Azure CLI, etc.)

3. **Preparation:**
   - Schedule maintenance window if downtime is required
   - Notify team members of planned rotation
   - Have rollback plan ready
   - Test in non-production environment first

---

## OpenAI API Key Rotation

### Risk Impact
- **High**: API key compromise can lead to unauthorized usage, cost overruns, and data exposure

### Prerequisites
- OpenAI organization admin access
- Access to all environments using the key

### Steps

1. **Create New API Key:**
   ```bash
   # Log into OpenAI Platform: https://platform.openai.com/api-keys
   # Click "Create new secret key"
   # Name: vibecode-prod-$(date +%Y%m%d)
   # Permissions: Read (if available), or All
   # Copy the key immediately (only shown once)
   ```

2. **Update Environment Variables:**
   ```bash
   # For local development:
   # Update .env file
   OPENAI_API_KEY=sk-proj-new-key-here
   
   # For production (GitHub Actions):
   gh secret set OPENAI_API_KEY --repo ryanmaclean/vibecode-webgui
   
   # For Kubernetes deployments:
   kubectl create secret generic openai-credentials \
     --from-literal=api-key=sk-proj-new-key-here \
     --namespace vibecode \
     --dry-run=client -o yaml | kubectl apply -f -
   
   # For Azure App Service:
   az webapp config appsettings set \
     --name vibecode-app \
     --resource-group vibecode-rg \
     --settings OPENAI_API_KEY=sk-proj-new-key-here
   ```

3. **Update macOS Keychain (if used):**
   ```bash
   # Delete old key
   security delete-generic-password -s "com.vibecode.secrets" -a "OPENAI_API_KEY"
   
   # Add new key
   security add-generic-password \
     -s "com.vibecode.secrets" \
     -a "OPENAI_API_KEY" \
     -w "sk-proj-new-key-here" \
     -U
   ```

4. **Verify New Key:**
   ```bash
   # Test API key with a simple request
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer sk-proj-new-key-here"
   
   # Expected: JSON response with model list
   # If error, do NOT proceed with old key revocation
   ```

5. **Rolling Deployment (if needed):**
   ```bash
   # For Kubernetes deployments, restart pods to pick up new secret
   kubectl rollout restart deployment/vibecode-api -n vibecode
   kubectl rollout status deployment/vibecode-api -n vibecode
   
   # Monitor logs for errors
   kubectl logs -f deployment/vibecode-api -n vibecode
   ```

6. **Revoke Old Key:**
   ```bash
   # Only after verification succeeds
   # OpenAI Platform → API Keys → Revoke old key
   # Monitor for any failed requests in logs/metrics
   ```

7. **Document Rotation:**
   - Update secret management system (1Password, Vault)
   - Record rotation date and next rotation date
   - Set calendar reminder for next rotation (90 days)

### Rollback Procedure

If issues occur:
1. Stop revoking the old key
2. Revert to old key in environment variables
3. Restart affected services
4. Investigate root cause before retrying

---

## Datadog API and Application Keys Rotation

### Risk Impact
- **Medium**: Key compromise can expose monitoring data and allow unauthorized metric submission

### Prerequisites
- Datadog organization admin access
- Access to all services using Datadog keys

### Steps

1. **Create New API Key:**
   ```bash
   # Datadog → Organization Settings → API Keys → New Key
   # Name: vibecode-api-$(date +%Y%m%d)
   # Copy the key
   ```

2. **Create New Application Key:**
   ```bash
   # Datadog → Organization Settings → Application Keys → New Key
   # Name: vibecode-app-$(date +%Y%m%d)
   # Scopes: Minimal required (typically monitoring read)
   # Copy the key
   ```

3. **Update Environment Variables:**
   ```bash
   # GitHub Actions secrets
   gh secret set DD_API_KEY --repo ryanmaclean/vibecode-webgui
   gh secret set DD_APP_KEY --repo ryanmaclean/vibecode-webgui
   
   # Kubernetes secrets
   kubectl create secret generic datadog-credentials \
     --from-literal=api-key=new-api-key \
     --from-literal=app-key=new-app-key \
     --namespace vibecode \
     --dry-run=client -o yaml | kubectl apply -f -
   
   # Local development
   # Update .env file
   DD_API_KEY=new-api-key
   DD_APP_KEY=new-app-key
   ```

4. **Restart Datadog Agent:**
   ```bash
   # For Kubernetes DaemonSet
   kubectl rollout restart daemonset/datadog-agent -n vibecode
   
   # For Docker
   docker restart datadog-agent
   
   # For systemd
   sudo systemctl restart datadog-agent
   ```

5. **Verify Metrics Flow:**
   ```bash
   # Check Datadog UI for recent metrics
   # Verify host/container status in Infrastructure List
   # Check for authentication errors in agent logs
   
   # Agent status
   datadog-agent status
   ```

6. **Revoke Old Keys:**
   ```bash
   # Datadog → Organization Settings → API Keys → Revoke
   # Datadog → Organization Settings → Application Keys → Revoke
   # Monitor for 24 hours to ensure no services are using old keys
   ```

7. **Document Rotation:**
   - Update rotation schedule
   - Record in secret management system
   - Set reminder for next rotation (365 days)

---

## PostgreSQL Credential Rotation

### Risk Impact
- **High**: Database credential compromise can lead to data breaches and system compromise

### Prerequisites
- Database admin access (SUPERUSER or equivalent)
- Access to all applications using the database
- Maintenance window scheduled (brief connection interruption)

### Steps

1. **Generate New Password:**
   ```bash
   # Generate cryptographically secure password
   NEW_PASSWORD=$(openssl rand -base64 32)
   echo "New password: $NEW_PASSWORD"
   # Save this securely before proceeding
   ```

2. **Update Database User Password:**
   ```sql
   -- Connect as admin user
   psql -h localhost -U postgres -d vibecode
   
   -- Rotate application user password
   ALTER USER vibecode_app WITH PASSWORD 'NEW_SECURE_PASSWORD_HERE';
   
   -- Verify user can connect
   \q
   psql -h localhost -U vibecode_app -d vibecode -c "SELECT version();"
   ```

3. **Update Connection Strings:**
   ```bash
   # Update DATABASE_URL in all environments
   NEW_DB_URL="postgresql://vibecode_app:NEW_PASSWORD@localhost:5432/vibecode?sslmode=require"
   
   # GitHub Actions
   gh secret set DATABASE_URL --repo ryanmaclean/vibecode-webgui
   
   # Kubernetes secret
   kubectl create secret generic postgres-credentials \
     --from-literal=url="$NEW_DB_URL" \
     --from-literal=password="NEW_PASSWORD" \
     --namespace vibecode \
     --dry-run=client -o yaml | kubectl apply -f -
   
   # Azure App Service
   az webapp config connection-string set \
     --name vibecode-app \
     --resource-group vibecode-rg \
     --connection-string-type PostgreSQL \
     --settings DATABASE_URL="$NEW_DB_URL"
   ```

4. **Rolling Update Applications:**
   ```bash
   # Kubernetes deployment
   kubectl set env deployment/vibecode-api \
     DATABASE_URL="$NEW_DB_URL" \
     -n vibecode
   
   # Wait for rollout
   kubectl rollout status deployment/vibecode-api -n vibecode
   
   # Verify database connectivity
   kubectl logs deployment/vibecode-api -n vibecode | grep -i "database\|postgres"
   ```

5. **Verify Application Functionality:**
   ```bash
   # Run health checks
   curl https://api.vibecode.dev/health/db
   
   # Check active connections
   psql -U postgres -c "SELECT * FROM pg_stat_activity WHERE usename = 'vibecode_app';"
   
   # Run automated tests
   npm run test:db
   ```

6. **Update Local Development:**
   ```bash
   # Update .env file
   DATABASE_URL=postgresql://vibecode_app:NEW_PASSWORD@localhost:5432/vibecode
   POSTGRES_PASSWORD=NEW_PASSWORD
   ```

7. **Document Rotation:**
   - Update password in secret management system
   - Record rotation date
   - Set reminder for next rotation (90 days)
   - Update disaster recovery documentation

### Emergency Rollback

If issues occur:
```sql
-- Restore old password temporarily
ALTER USER vibecode_app WITH PASSWORD 'OLD_PASSWORD';
```

---

## CSRF Secret Rotation

### Risk Impact
- **Medium**: CSRF secret compromise can enable cross-site request forgery attacks

### Prerequisites
- Application deployment access
- Understanding of session impact (active sessions will be invalidated)

### Steps

1. **Generate New CSRF Secret:**
   ```bash
   # Generate cryptographically secure secret (minimum 32 bytes)
   NEW_CSRF_SECRET=$(openssl rand -base64 48)
   echo "New CSRF secret: $NEW_CSRF_SECRET"
   ```

2. **Update Environment Variables:**
   ```bash
   # GitHub Actions
   gh secret set CSRF_SECRET --repo ryanmaclean/vibecode-webgui
   
   # Kubernetes
   kubectl create secret generic app-secrets \
     --from-literal=csrf-secret="$NEW_CSRF_SECRET" \
     --namespace vibecode \
     --dry-run=client -o yaml | kubectl apply -f -
   
   # Local development
   # Update .env file
   CSRF_SECRET=$NEW_CSRF_SECRET
   ```

3. **Deploy Application:**
   ```bash
   # Kubernetes rolling update
   kubectl rollout restart deployment/vibecode-api -n vibecode
   kubectl rollout status deployment/vibecode-api -n vibecode
   ```

4. **User Impact Notice:**
   - **Warning**: All active user sessions will be invalidated
   - Users will need to log in again
   - CSRF tokens in forms will be regenerated
   - Schedule rotation during low-traffic period

5. **Verify Functionality:**
   ```bash
   # Test CSRF protection
   curl -X POST https://api.vibecode.dev/api/test \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   
   # Expected: 403 Forbidden (CSRF token missing)
   
   # Test with valid CSRF token (from browser)
   # Expected: 200 OK with proper token
   ```

6. **Document Rotation:**
   - Record rotation date
   - Set reminder for next rotation (180 days)

---

## NextAuth Secret Rotation

### Risk Impact
- **High**: NextAuth secret compromise can enable session hijacking and authentication bypass

### Prerequisites
- Application deployment access
- User notification system ready
- Maintenance window scheduled

### Steps

1. **Generate New NextAuth Secret:**
   ```bash
   # Generate cryptographically secure secret (minimum 32 bytes)
   NEW_NEXTAUTH_SECRET=$(openssl rand -base64 48)
   echo "New NextAuth secret: $NEW_NEXTAUTH_SECRET"
   ```

2. **Update Environment Variables:**
   ```bash
   # GitHub Actions
   gh secret set NEXTAUTH_SECRET --repo ryanmaclean/vibecode-webgui
   
   # Kubernetes
   kubectl create secret generic auth-secrets \
     --from-literal=nextauth-secret="$NEW_NEXTAUTH_SECRET" \
     --namespace vibecode \
     --dry-run=client -o yaml | kubectl apply -f -
   
   # Azure App Service
   az webapp config appsettings set \
     --name vibecode-app \
     --resource-group vibecode-rg \
     --settings NEXTAUTH_SECRET="$NEW_NEXTAUTH_SECRET"
   
   # Local development
   # Update .env file
   NEXTAUTH_SECRET=$NEW_NEXTAUTH_SECRET
   ```

3. **Deploy Application:**
   ```bash
   # Kubernetes rolling update
   kubectl rollout restart deployment/vibecode-api -n vibecode
   kubectl rollout status deployment/vibecode-api -n vibecode
   
   # Monitor logs for authentication errors
   kubectl logs -f deployment/vibecode-api -n vibecode | grep -i "nextauth\|auth"
   ```

4. **User Impact:**
   - **Critical**: ALL active user sessions will be invalidated
   - All users will be logged out immediately
   - Users must sign in again
   - OAuth sessions may need re-authorization
   - **Recommendation**: Notify users in advance via email/banner

5. **Verify Authentication:**
   ```bash
   # Test sign-in flow
   # 1. Navigate to https://app.vibecode.dev/auth/signin
   # 2. Sign in with test credentials
   # 3. Verify successful authentication
   # 4. Check session cookie is set
   # 5. Test protected routes
   ```

6. **Monitor for Issues:**
   ```bash
   # Check authentication error rates
   # Monitor user complaints
   # Verify OAuth callback URLs still work
   ```

7. **Document Rotation:**
   - Record rotation date and user impact
   - Update incident response documentation
   - Set reminder for next rotation (180 days)

### Rollback Procedure

If critical issues occur:
1. Revert to old NEXTAUTH_SECRET immediately
2. Redeploy application
3. Users may need to sign in again (twice)
4. Investigate root cause

---

## JWT Secret Rotation

### Risk Impact
- **High**: JWT secret compromise enables token forgery and unauthorized access

### Prerequisites
- Application deployment access
- Understanding of WebSocket/real-time connection impact

### Steps

1. **Generate New JWT Secret:**
   ```bash
   # Generate cryptographically secure secret (minimum 32 bytes)
   NEW_JWT_SECRET=$(openssl rand -base64 48)
   echo "New JWT secret: $NEW_JWT_SECRET"
   ```

2. **Update Environment Variables:**
   ```bash
   # GitHub Actions
   gh secret set JWT_SECRET --repo ryanmaclean/vibecode-webgui
   
   # Kubernetes
   kubectl create secret generic auth-secrets \
     --from-literal=jwt-secret="$NEW_JWT_SECRET" \
     --namespace vibecode \
     --dry-run=client -o yaml | kubectl apply -f -
   
   # Local development
   # Update .env file
   JWT_SECRET=$NEW_JWT_SECRET
   ```

3. **Deploy Application:**
   ```bash
   # Kubernetes rolling update
   kubectl rollout restart deployment/vibecode-api -n vibecode
   kubectl rollout status deployment/vibecode-api -n vibecode
   ```

4. **User Impact:**
   - **Warning**: Active WebSocket connections will be disconnected
   - API tokens will be invalidated
   - Users may need to refresh or reconnect
   - Terminal sessions may be interrupted

5. **Verify Token Generation:**
   ```bash
   # Test JWT generation endpoint
   curl -X POST https://api.vibecode.dev/api/auth/token \
     -H "Content-Type: application/json" \
     -d '{"user": "test"}' \
     -b session_cookie
   
   # Verify token can be validated
   # Check WebSocket reconnection works
   ```

6. **Monitor Services:**
   ```bash
   # Check WebSocket connection metrics
   # Monitor API authentication success rate
   # Verify terminal sessions reconnect
   ```

7. **Document Rotation:**
   - Record rotation date
   - Note any service interruptions
   - Set reminder for next rotation (180 days)

---

## Docker Hub Token Rotation

See [GitHub Actions Security Checklist](./GITHUB_ACTIONS_SECURITY_CHECKLIST.md#docker-hub-token-rotation) for detailed Docker Hub token rotation procedures.

**Quick Reference:**
1. Generate new token in Docker Hub (90-day expiration)
2. Update `DOCKERHUB_TOKEN` secret in GitHub
3. Verify with test workflow run
4. Revoke old token
5. Update rotation schedule

---

## Azure Service Principal Rotation

See [GitHub Actions Security Checklist](./GITHUB_ACTIONS_SECURITY_CHECKLIST.md#azure-credentials-rotation) for detailed Azure credentials rotation procedures.

**Quick Reference:**
1. Create new service principal with Azure CLI
2. Update `AZURE_CREDENTIALS` secret in GitHub
3. Test deployment workflow
4. Delete old service principal
5. Document rotation

---

## Emergency Rotation Procedures

### Suspected Credential Compromise

If credential exposure is suspected:

1. **Immediate Actions (within 1 hour):**
   - Rotate the compromised credential immediately
   - Revoke old credential (don't wait for verification)
   - Review access logs for unauthorized usage
   - Enable additional monitoring/alerting
   - Notify security team

2. **Investigation (within 24 hours):**
   - Determine scope of exposure
   - Identify affected systems
   - Review recent activity logs
   - Check for data exfiltration
   - Document incident timeline

3. **Remediation:**
   - Rotate all potentially affected credentials
   - Apply additional security controls
   - Update access control lists
   - Implement monitoring improvements
   - Create incident report

4. **Post-Incident:**
   - Conduct lessons learned session
   - Update security procedures
   - Implement preventive measures
   - Train team on incident response

### Mass Rotation Event

For organization-wide credential rotation (e.g., security audit, compliance):

1. Create rotation plan with priority order
2. Schedule maintenance windows
3. Notify all stakeholders
4. Rotate credentials by risk level (HIGH → MEDIUM → LOW)
5. Verify each rotation before proceeding to next
6. Document all changes
7. Update all documentation

---

## Automation Opportunities

### Recommended Automation

1. **Expiration Alerts:**
   ```bash
   # Create calendar reminders 2 weeks before rotation due date
   # GitHub Actions workflow to check credential age
   # Slack/email notifications for upcoming rotations
   ```

2. **Rotation Tracking:**
   - GitHub Issues for rotation tasks
   - Spreadsheet or database for rotation history
   - Automated tickets 2 weeks before expiration

3. **Verification Scripts:**
   - Automated health checks after rotation
   - Integration tests to verify credential validity
   - Rollback automation for failed rotations

4. **Future State:**
   - Implement HashiCorp Vault for dynamic secrets
   - Use AWS Secrets Manager rotation lambdas
   - Azure Key Vault automatic rotation
   - Short-lived credentials where possible

---

## Troubleshooting

### Common Issues

**Issue**: New credential doesn't work after rotation
- **Solution**: Verify credential was correctly copied (no extra spaces/newlines)
- **Solution**: Check credential format matches expected pattern
- **Solution**: Verify service principal has correct permissions

**Issue**: Application can't connect after rotation
- **Solution**: Check environment variables are properly updated
- **Solution**: Verify pods/containers restarted to pick up new values
- **Solution**: Check for cached credentials in application

**Issue**: Users complaining about being logged out
- **Solution**: This is expected for NextAuth/JWT/CSRF rotation
- **Solution**: Send advance notification before rotating these secrets
- **Solution**: Schedule rotation during low-traffic periods

**Issue**: Old credential still working after revocation
- **Solution**: Wait for TTL/cache expiration (usually 5-15 minutes)
- **Solution**: Clear CDN/proxy caches if applicable
- **Solution**: Verify revocation succeeded in service UI

---

## Compliance and Audit

### Audit Trail Requirements

For each rotation, document:
1. Date and time of rotation
2. Person who performed rotation
3. Reason for rotation (scheduled, emergency, compliance)
4. Systems affected
5. Verification results
6. Any issues encountered
7. User impact (if any)

### Compliance Checklist

- [ ] Rotation schedule maintained and followed
- [ ] All rotations documented in audit log
- [ ] Emergency contact procedures tested
- [ ] Rollback procedures validated
- [ ] Team trained on rotation procedures
- [ ] Automation implemented where possible
- [ ] Quarterly review of rotation policy completed

---

## Additional Resources

### Internal Documentation
- [GitHub Actions Security Checklist](./GITHUB_ACTIONS_SECURITY_CHECKLIST.md) - CI/CD credential rotation
- [API Security Guide](./api-security.md) - API authentication best practices
- [CSRF Protection](./csrf-protection.md) - CSRF implementation details

### External References
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [NIST SP 800-57: Key Management](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
- [CIS Controls: Credential Management](https://www.cisecurity.org/controls/)

### Service-Specific Documentation
- [OpenAI API Key Management](https://platform.openai.com/docs/api-reference/authentication)
- [Datadog API Keys](https://docs.datadoghq.com/account_management/api-app-keys/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/client-authentication.html)
- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)

---

## Questions or Issues?

- **Security Team**: security@vibecode.dev
- **Emergency**: Create incident in `#security-warroom` Slack channel
- **Questions**: Open GitHub discussion in Security category

---

**Last Updated**: 2025-11-18  
**Document Version**: 1.0  
**Next Review**: 2026-02-18
