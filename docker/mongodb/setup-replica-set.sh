#!/bin/bash
# MongoDB replica set setup script for VibeCode Chat-UI

set -e

echo "Setting up MongoDB replica set for VibeCode..."

# Wait for MongoDB to be ready
until mongosh --eval "print('MongoDB is ready')" > /dev/null 2>&1; do
    echo "Waiting for MongoDB to start..."
    sleep 2
done

# Initialize replica set if not already initialized
REPLICA_SET_STATUS=$(mongosh --eval "rs.status()" --quiet 2>/dev/null || echo "not_initialized")

if [[ "$REPLICA_SET_STATUS" == *"not_initialized"* ]] || [[ "$REPLICA_SET_STATUS" == *"no replset config"* ]]; then
    echo "Initializing replica set..."
    
    mongosh --eval "
    rs.initiate({
        _id: 'vibecode-chat-rs',
        members: [
            { _id: 0, host: 'localhost:27017' }
        ]
    })
    "
    
    echo "Waiting for replica set to be ready..."
    until mongosh --eval "rs.isMaster().ismaster" --quiet | grep -q "true"; do
        echo "Waiting for replica set primary..."
        sleep 2
    done
    
    echo "✅ Replica set initialized successfully"
else
    echo "✅ Replica set already initialized"
fi

echo "MongoDB replica set setup completed!"