# Workflow API Routes

API endpoints for workflow management and execution.

## Endpoints

### List Workflows
```bash
GET /api/workflows
```

Query parameters:
- `type` - Filter by type: 'definitions' or 'executions'
- `workflowId` - Filter by workflow ID
- `status` - Filter by status
- `limit` - Pagination limit (default: 50)
- `offset` - Pagination offset (default: 0)

### Create/Execute Workflow
```bash
POST /api/workflows?action=create
POST /api/workflows?action=execute
```

Create workflow:
```json
{
  "name": "my-workflow",
  "version": "1.0.0",
  "description": "My workflow description",
  "nodes": [...],
  "edges": [...]
}
```

Execute workflow:
```json
{
  "workflowYAML": "...",
  "inputs": {
    "key": "value"
  }
}
```

### Get Workflow
```bash
GET /api/workflows/:id?type=execution
GET /api/workflows/:id?type=definition
```

Query parameters:
- `type` - Resource type: 'definition' or 'execution' (default: 'execution')
- `includeAudit` - Include audit trail (boolean)
- `includeCheckpoints` - Include checkpoints (boolean)

### Control Execution
```bash
POST /api/workflows/:id?type=execution
```

Actions:
```json
{
  "action": "cancel"
}
```

```json
{
  "action": "resume",
  "checkpointId": "checkpoint-123"
}
```

```json
{
  "action": "rollback",
  "checkpointId": "checkpoint-123"
}
```

### Delete Workflow
```bash
DELETE /api/workflows/:id
```

## Testing

Start the dev server:
```bash
npm run dev
```

Test endpoints:
```bash
# List workflows
curl -X GET http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# Execute a simple workflow
curl -X POST "http://localhost:3000/api/workflows?action=execute" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "definition": {
      "name": "test-workflow",
      "version": "1.0.0",
      "nodes": [],
      "edges": []
    },
    "inputs": {}
  }'

# Get execution details
curl -X GET "http://localhost:3000/api/workflows/EXECUTION_ID?type=execution" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

## Authentication

All endpoints require authentication via NextAuth session.

## Rate Limiting

All endpoints are rate-limited to 30 requests per minute per IP address.
