#!/bin/bash
# MongoDB backup script for VibeCode Chat-UI

set -e

# Configuration
BACKUP_DIR="/opt/vibecode/backups"
DB_NAME="chatui"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="chatui_backup_${DATE}"
RETENTION_DAYS=7

# MongoDB connection details
MONGO_HOST="localhost"
MONGO_PORT="27017"
MONGO_USER="${MONGO_INITDB_ROOT_USERNAME:-admin}"
MONGO_PASS="${MONGO_INITDB_ROOT_PASSWORD:-vibecode_admin_2025}"

echo "🔄 Starting MongoDB backup for VibeCode Chat-UI..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup
echo "📦 Creating backup: $BACKUP_NAME"
mongodump \
    --host "$MONGO_HOST:$MONGO_PORT" \
    --username "$MONGO_USER" \
    --password "$MONGO_PASS" \
    --authenticationDatabase admin \
    --db "$DB_NAME" \
    --out "$BACKUP_DIR/$BACKUP_NAME"

# Compress backup
echo "🗜️ Compressing backup..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

# Calculate backup size
BACKUP_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
echo "✅ Backup completed: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"

# Clean up old backups
echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "chatui_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# List current backups
echo "📋 Current backups:"
ls -lh "$BACKUP_DIR"/chatui_backup_*.tar.gz 2>/dev/null || echo "No backups found"

# Optional: Upload to cloud storage (AWS S3)
if [ -n "$AWS_S3_BUCKET" ]; then
    echo "☁️ Uploading backup to S3..."
    aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" "s3://${AWS_S3_BUCKET}/mongodb-backups/"
    echo "✅ Backup uploaded to S3"
fi

echo "🎉 Backup process completed successfully!"

# Return backup info for monitoring
cat << EOF
{
  "backup_name": "$BACKUP_NAME",
  "backup_size": "$BACKUP_SIZE",
  "backup_date": "$DATE",
  "backup_path": "$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
}
EOF