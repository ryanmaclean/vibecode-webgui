// MongoDB initialization script for Chat-UI database
// Creates necessary users, collections, and indexes

// Switch to the chatui database
db = db.getSiblingDB('chatui');

// Create the chatui user with appropriate permissions
db.createUser({
  user: 'chatui_user',
  pwd: 'chatui_password_2025',
  roles: [
    {
      role: 'readWrite',
      db: 'chatui'
    },
    {
      role: 'dbAdmin',
      db: 'chatui'
    }
  ]
});

// Create collections with appropriate settings
db.createCollection('conversations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'title', 'createdAt', 'updatedAt'],
      properties: {
        _id: {
          bsonType: 'objectId'
        },
        title: {
          bsonType: 'string',
          maxLength: 500
        },
        sessionId: {
          bsonType: 'string'
        },
        model: {
          bsonType: 'string'
        },
        userId: {
          bsonType: 'string'
        },
        workspaceId: {
          bsonType: 'string'
        },
        createdAt: {
          bsonType: 'date'
        },
        updatedAt: {
          bsonType: 'date'
        },
        messages: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['id', 'from', 'content', 'createdAt'],
            properties: {
              id: {
                bsonType: 'string'
              },
              from: {
                bsonType: 'string',
                enum: ['user', 'assistant']
              },
              content: {
                bsonType: 'string'
              },
              files: {
                bsonType: 'array'
              },
              createdAt: {
                bsonType: 'date'
              },
              updatedAt: {
                bsonType: 'date'
              }
            }
          }
        }
      }
    }
  }
});

db.createCollection('sessions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'sessionId', 'createdAt'],
      properties: {
        _id: {
          bsonType: 'objectId'
        },
        sessionId: {
          bsonType: 'string'
        },
        userId: {
          bsonType: 'string'
        },
        userAgent: {
          bsonType: 'string'
        },
        ip: {
          bsonType: 'string'
        },
        createdAt: {
          bsonType: 'date'
        },
        expiresAt: {
          bsonType: 'date'
        }
      }
    }
  }
});

db.createCollection('sharedConversations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'conversationId', 'createdAt'],
      properties: {
        _id: {
          bsonType: 'objectId'
        },
        conversationId: {
          bsonType: 'objectId'
        },
        title: {
          bsonType: 'string'
        },
        model: {
          bsonType: 'string'
        },
        messages: {
          bsonType: 'array'
        },
        createdAt: {
          bsonType: 'date'
        },
        updatedAt: {
          bsonType: 'date'
        }
      }
    }
  }
});

db.createCollection('assistants', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'name', 'createdAt'],
      properties: {
        _id: {
          bsonType: 'objectId'
        },
        name: {
          bsonType: 'string',
          maxLength: 100
        },
        description: {
          bsonType: 'string',
          maxLength: 1000
        },
        instructions: {
          bsonType: 'string'
        },
        model: {
          bsonType: 'string'
        },
        tools: {
          bsonType: 'array'
        },
        files: {
          bsonType: 'array'
        },
        createdBy: {
          bsonType: 'string'
        },
        createdAt: {
          bsonType: 'date'
        },
        updatedAt: {
          bsonType: 'date'
        }
      }
    }
  }
});

db.createCollection('reports', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'type', 'createdAt'],
      properties: {
        _id: {
          bsonType: 'objectId'
        },
        type: {
          bsonType: 'string',
          enum: ['conversation', 'message', 'assistant']
        },
        conversationId: {
          bsonType: 'objectId'
        },
        messageId: {
          bsonType: 'string'
        },
        reason: {
          bsonType: 'string'
        },
        details: {
          bsonType: 'string'
        },
        reportedBy: {
          bsonType: 'string'
        },
        createdAt: {
          bsonType: 'date'
        }
      }
    }
  }
});

// Create indexes for optimal performance
print('Creating indexes for conversations collection...');
db.conversations.createIndex({ 'sessionId': 1 });
db.conversations.createIndex({ 'userId': 1 });
db.conversations.createIndex({ 'workspaceId': 1 });
db.conversations.createIndex({ 'createdAt': -1 });
db.conversations.createIndex({ 'updatedAt': -1 });
db.conversations.createIndex({ 'sessionId': 1, 'createdAt': -1 });

print('Creating indexes for sessions collection...');
db.sessions.createIndex({ 'sessionId': 1 }, { unique: true });
db.sessions.createIndex({ 'userId': 1 });
db.sessions.createIndex({ 'expiresAt': 1 }, { expireAfterSeconds: 0 });

print('Creating indexes for sharedConversations collection...');
db.sharedConversations.createIndex({ 'conversationId': 1 });
db.sharedConversations.createIndex({ 'createdAt': -1 });

print('Creating indexes for assistants collection...');
db.assistants.createIndex({ 'name': 1 });
db.assistants.createIndex({ 'createdBy': 1 });
db.assistants.createIndex({ 'createdAt': -1 });

print('Creating indexes for reports collection...');
db.reports.createIndex({ 'type': 1 });
db.reports.createIndex({ 'conversationId': 1 });
db.reports.createIndex({ 'createdAt': -1 });

// Create text indexes for search functionality
print('Creating text indexes for search...');
db.conversations.createIndex({
  'title': 'text',
  'messages.content': 'text'
}, {
  name: 'conversation_search',
  weights: {
    'title': 10,
    'messages.content': 1
  }
});

db.assistants.createIndex({
  'name': 'text',
  'description': 'text',
  'instructions': 'text'
}, {
  name: 'assistant_search',
  weights: {
    'name': 10,
    'description': 5,
    'instructions': 1
  }
});

// Insert sample data for testing
print('Inserting sample data...');

// Sample conversation
db.conversations.insertOne({
  title: 'Welcome to VibeCode Chat',
  sessionId: 'sample-session-001',
  model: 'anthropic/claude-3.5-sonnet',
  userId: 'sample-user',
  workspaceId: 'sample-workspace',
  createdAt: new Date(),
  updatedAt: new Date(),
  messages: [
    {
      id: 'msg-001',
      from: 'assistant',
      content: 'Welcome to VibeCode! I\'m your AI assistant. How can I help you with your development project today?',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
});

// Sample assistant
db.assistants.insertOne({
  name: 'Code Assistant',
  description: 'A helpful AI assistant specialized in software development and coding tasks.',
  instructions: 'You are a helpful coding assistant. Provide clear, concise code examples and explanations. Always consider best practices and security.',
  model: 'anthropic/claude-3.5-sonnet',
  tools: ['web_search', 'code_interpreter'],
  files: [],
  createdBy: 'system',
  createdAt: new Date(),
  updatedAt: new Date()
});

print('Chat-UI database initialization completed successfully!');
print('Created collections: conversations, sessions, sharedConversations, assistants, reports');
print('Created indexes for optimal query performance');
print('Created text search indexes for conversation and assistant search');
print('User "chatui_user" created with readWrite and dbAdmin permissions');