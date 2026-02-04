#!/bin/bash
# Generate random password on first run

PASSWORD_FILE=/run/secrets/db_password

# Generate password if it doesn't exist
if [ ! -f "$PASSWORD_FILE" ]; then
    echo "Generating random database password..."
    openssl rand -base64 32 > "$PASSWORD_FILE"
    chmod 600 "$PASSWORD_FILE"
    echo "Password generated and saved to $PASSWORD_FILE"
else
    echo "Using existing password from $PASSWORD_FILE"
fi

# Export for use by PostgreSQL
export POSTGRES_PASSWORD=$(cat "$PASSWORD_FILE")
echo "Database password configured"
