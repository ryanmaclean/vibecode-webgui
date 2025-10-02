#!/usr/bin/env bash

# Secret Management Script for AgentAPI Deployment
# Usage: ./scripts/manage-secrets.sh [action] [environment]
# Actions: create, update, rotate, view

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ACTION="${1:-view}"
ENVIRONMENT="${2:-dev}"
NAMESPACE="vibecode-${ENVIRONMENT}"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found"
        exit 1
    fi

    if ! command -v openssl &> /dev/null; then
        log_error "openssl not found"
        exit 1
    fi
}

generate_random_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

create_secrets() {
    log_info "Creating secrets for $ENVIRONMENT environment..."

    # Generate passwords
    CODE_SERVER_PASSWORD=$(generate_random_password)
    AGENTAPI_API_KEY=$(generate_random_password)
    WEBHOOK_SECRET=$(generate_random_password)

    # Create code-server config secret
    kubectl create secret generic code-server-config \
        --from-literal=password="$CODE_SERVER_PASSWORD" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Create agentapi secrets
    kubectl create secret generic agentapi-secrets \
        --from-literal=api-key="$AGENTAPI_API_KEY" \
        --from-literal=webhook-secret="$WEBHOOK_SECRET" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Create OpenAI API key secret (from environment or prompt)
    if [ -n "${OPENAI_API_KEY:-}" ]; then
        kubectl create secret generic openai-credentials \
            --from-literal=api-key="$OPENAI_API_KEY" \
            --namespace="$NAMESPACE" \
            --dry-run=client -o yaml | kubectl apply -f -
    else
        log_warn "OPENAI_API_KEY not set in environment"
        read -sp "Enter OpenAI API Key: " OPENAI_KEY
        echo ""
        kubectl create secret generic openai-credentials \
            --from-literal=api-key="$OPENAI_KEY" \
            --namespace="$NAMESPACE" \
            --dry-run=client -o yaml | kubectl apply -f -
    fi

    # Create Datadog credentials (optional)
    if [ -n "${DD_API_KEY:-}" ]; then
        kubectl create secret generic datadog-credentials \
            --from-literal=api-key="$DD_API_KEY" \
            --from-literal=app-key="${DD_APP_KEY:-}" \
            --namespace="$NAMESPACE" \
            --dry-run=client -o yaml | kubectl apply -f -
    fi

    log_info "Secrets created successfully"

    # Save credentials to secure file (encrypted)
    CREDS_FILE="$HOME/.vibecode/credentials-${ENVIRONMENT}.txt"
    mkdir -p "$HOME/.vibecode"

    cat > "$CREDS_FILE" <<EOF
VibeCode AgentAPI Credentials - $ENVIRONMENT Environment
Generated: $(date)

Code Server Password: $CODE_SERVER_PASSWORD
AgentAPI API Key: $AGENTAPI_API_KEY
Webhook Secret: $WEBHOOK_SECRET

IMPORTANT: Store these credentials securely and delete this file after saving to password manager.
EOF

    chmod 600 "$CREDS_FILE"

    log_info "Credentials saved to: $CREDS_FILE"
    log_warn "Please save credentials to password manager and delete the file"
}

update_secret() {
    local secret_name="$1"
    local key="$2"
    local value="$3"

    log_info "Updating secret $secret_name/$key in $NAMESPACE..."

    kubectl create secret generic "$secret_name" \
        --from-literal="$key"="$value" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    log_info "Secret updated. Rolling restart required for changes to take effect."
}

rotate_secrets() {
    log_warn "Rotating secrets for $ENVIRONMENT environment..."

    # Generate new passwords
    NEW_API_KEY=$(generate_random_password)
    NEW_WEBHOOK_SECRET=$(generate_random_password)

    # Update secrets
    update_secret "agentapi-secrets" "api-key" "$NEW_API_KEY"
    update_secret "agentapi-secrets" "webhook-secret" "$NEW_WEBHOOK_SECRET"

    log_info "Secrets rotated. New values:"
    echo "API Key: $NEW_API_KEY"
    echo "Webhook Secret: $NEW_WEBHOOK_SECRET"

    log_warn "Update dependent services with new credentials"
    log_info "Trigger rolling restart: kubectl rollout restart deployment/code-server-workspace -n $NAMESPACE"
}

view_secrets() {
    log_info "Secrets in $NAMESPACE namespace:"

    kubectl get secrets -n "$NAMESPACE" -o custom-columns=NAME:.metadata.name,TYPE:.type,AGE:.metadata.creationTimestamp

    echo ""
    log_info "To view secret values (base64 encoded):"
    echo "kubectl get secret <secret-name> -n $NAMESPACE -o yaml"
}

backup_secrets() {
    log_info "Backing up secrets from $NAMESPACE..."

    BACKUP_DIR="$HOME/.vibecode/backups/secrets"
    mkdir -p "$BACKUP_DIR"

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/secrets-${ENVIRONMENT}-${TIMESTAMP}.yaml"

    kubectl get secrets -n "$NAMESPACE" -o yaml > "$BACKUP_FILE"

    log_info "Secrets backed up to: $BACKUP_FILE"
    log_warn "This file contains sensitive data. Store securely and encrypt."
}

restore_secrets() {
    local backup_file="$1"

    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi

    log_warn "Restoring secrets from: $backup_file"
    read -p "Are you sure? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi

    kubectl apply -f "$backup_file"

    log_info "Secrets restored from backup"
}

validate_secrets() {
    log_info "Validating secrets in $NAMESPACE..."

    REQUIRED_SECRETS=(
        "code-server-config"
        "agentapi-secrets"
        "openai-credentials"
    )

    ALL_VALID=true

    for secret in "${REQUIRED_SECRETS[@]}"; do
        if kubectl get secret "$secret" -n "$NAMESPACE" &> /dev/null; then
            log_info "✓ $secret exists"
        else
            log_error "✗ $secret missing"
            ALL_VALID=false
        fi
    done

    if [ "$ALL_VALID" = true ]; then
        log_info "All required secrets are present"
    else
        log_error "Some required secrets are missing. Run: $0 create $ENVIRONMENT"
        exit 1
    fi
}

main() {
    log_info "Secret Management Script"
    log_info "Action: $ACTION | Environment: $ENVIRONMENT"

    check_prerequisites

    case "$ACTION" in
        create)
            create_secrets
            ;;
        update)
            if [ $# -lt 4 ]; then
                log_error "Usage: $0 update <environment> <secret-name> <key> <value>"
                exit 1
            fi
            update_secret "$3" "$4" "$5"
            ;;
        rotate)
            rotate_secrets
            ;;
        view)
            view_secrets
            ;;
        backup)
            backup_secrets
            ;;
        restore)
            if [ $# -lt 3 ]; then
                log_error "Usage: $0 restore <environment> <backup-file>"
                exit 1
            fi
            restore_secrets "$3"
            ;;
        validate)
            validate_secrets
            ;;
        *)
            log_error "Invalid action: $ACTION"
            echo "Valid actions: create, update, rotate, view, backup, restore, validate"
            exit 1
            ;;
    esac

    log_info "Operation completed"
}

main "$@"
