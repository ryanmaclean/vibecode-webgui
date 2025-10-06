#!/bin/bash
set -e

echo "Initializing VibeCode database..."

# Wait for postgres to be ready
until pg_isready -h localhost -p 5432 -U postgres; do
  echo "Waiting for postgres..."
  sleep 2
done

echo "Creating vibecode user and database..."

# Create user and database
psql -U postgres -c "CREATE USER vibecode WITH PASSWORD 'vibecode123';"
psql -U postgres -c "CREATE DATABASE vibecode OWNER vibecode;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE vibecode TO vibecode;"

echo "Database initialized successfully!"
