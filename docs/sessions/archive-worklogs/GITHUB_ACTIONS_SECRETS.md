# GitHub Actions Secrets Configuration

This document lists all the secrets required for the GitHub Actions workflows in this repository.

## Container Registry Credentials
- `ACR_USERNAME`: Azure Container Registry username
- `ACR_PASSWORD`: Azure Container Registry password
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password (if needed)

## Kubernetes Configuration
- `KUBECONFIG_BASE64`: Base64-encoded Kubernetes configuration file
- `KUBECONFIG_STAGING`: Base64-encoded Kubernetes configuration for staging
- `KUBECONFIG_PRODUCTION`: Base64-encoded Kubernetes configuration for production
- `KUBE_CONFIG_STAGING`: Alternate format for staging Kubernetes config
- `KUBE_CONFIG_PRODUCTION`: Alternate format for production Kubernetes config

## Monitoring and Observability
- `DD_API_KEY`: Datadog API key
- `DD_APP_KEY`: Datadog application key
- `DATADOG_API_KEY`: Alternative name for Datadog API key

## Security Scanning
- `SNYK_TOKEN`: Snyk security scanning token
- `LHCI_GITHUB_APP_TOKEN`: Lighthouse CI GitHub app token

## Application Secrets
- `DATABASE_PASSWORD`: Database password for default environment
- `DATABASE_PASSWORD_STAGING`: Database password for staging
- `DATABASE_PASSWORD_PRODUCTION`: Database password for production
- `NEXTAUTH_SECRET`: NextAuth secret for default environment
- `NEXTAUTH_SECRET_STAGING`: NextAuth secret for staging
- `NEXTAUTH_SECRET_PRODUCTION`: NextAuth secret for production
- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key

## Setting Up Secrets

To set up these secrets:
1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add each secret with its corresponding value

## Secret Rotation Procedures

Secrets should be rotated regularly to maintain security. Follow these procedures:

### Datadog API Keys
1. Log in to Datadog dashboard
2. Navigate to Organization Settings > API Keys
3. Create a new API key
4. Update the GitHub secret
5. Verify workflows succeed with the new key
6. Disable the old API key

### Kubernetes Configurations
1. Generate new Kubernetes service account with appropriate permissions
2. Get the kubeconfig file
3. Base64 encode: `cat kubeconfig | base64 -w 0`
4. Update the GitHub secret
5. Verify workflows succeed with the new config
6. Remove the old service account

### Database Passwords
1. Update the database with a new password
2. Update the corresponding GitHub secret
3. Run a test workflow to verify connectivity
4. Monitor application logs for any database connection issues

### API Keys (OpenAI, Anthropic)
1. Generate new API keys from the respective service dashboards
2. Update the GitHub secrets
3. Run tests to verify functionality
4. Revoke old API keys

## Development Fallbacks

For development and testing workflows without access to production secrets, we've implemented fallbacks:

1. Mock Kubernetes configurations for local testing
2. Dummy API keys for development (with rate limits)
3. Local database connections instead of production

## Security Considerations

- Never commit secrets directly to the repository
- Use GitHub's secret scanning to detect accidental secret exposure
- Implement least privilege access for all service accounts
- Review GitHub Actions logs regularly for any exposed secrets
- Use OIDC federation where possible instead of long-lived secrets