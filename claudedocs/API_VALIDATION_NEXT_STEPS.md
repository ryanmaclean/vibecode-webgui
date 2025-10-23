# API Validation Implementation - Next Steps
**Issue**: #532 - Add Zod Validation to All 77 API Routes
**Current Status**: 5/64 unvalidated routes completed (8% progress)
**Remaining**: 59 routes

---

## Quick Summary

### Completed (5 Routes)
1. ✅ `/api/chat/stream` - Chat streaming with RAG
2. ✅ `/api/auth/login-tracking` - Authentication event logging
3. ✅ `/api/chat/mongodb-simple` - MongoDB chat operations
4. ✅ `/api/claude/chat` - Claude CLI chat integration
5. ✅ `/api/claude/session` - Claude CLI session management

### Files Modified
- `/src/lib/api/validation/schemas.ts` (+87 lines, 7 new schemas)
- 5 route files updated with validation

---

## Immediate Priority Routes (Week 1)

### Critical Security Risks

#### 1. `/api/workspace/[id]/init-goose/route.ts`
**Risk Level**: CRITICAL - Command Injection
**Current Code**:
```typescript
await execAsync('goose -dir migrations create init sql', { cwd: workspacePath })
```
**Issue**: Direct shell execution without input validation
**Required Schema**:
```typescript
export const initGooseSchema = z.object({
  id: workspaceIdSchema // Already exists, apply to params.id
})
```
**Action**: Add validation or DISABLE this endpoint if not actively used

#### 2. `/api/auth/saml/metadata/route.ts`
**Risk Level**: HIGH - SAML Security
**Missing**: Query parameter validation
**Required Schema**:
```typescript
export const samlMetadataSchema = z.object({
  entityId: z.string().url().optional(),
  format: z.enum(['xml', 'json']).optional().default('xml')
})
```

#### 3. `/api/files/sync/route.ts`
**Risk Level**: HIGH - WebSocket Message Validation
**Missing**: WebSocket message validation
**Required Schema**:
```typescript
export const fileSyncMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file_update'),
    workspaceId: workspaceIdSchema,
    path: filePathSchema,
    content: z.string().max(10_000_000)
  }),
  z.object({
    type: z.literal('file_lock'),
    workspaceId: workspaceIdSchema,
    path: filePathSchema
  }),
  // ... other message types
])
```

---

## AI Route Validation (Week 2-3)

### AI Chat Routes (17 routes)
All `/api/ai/*` routes need validation:

#### Template Schema
```typescript
export const aiChatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(100),
  model: z.string().min(1).max(100).optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().int().positive().max(32000).optional(),
  stream: z.boolean().optional().default(false),
  provider: z.enum(['openai', 'anthropic', 'huggingface', 'litellm']).optional(),
  workspaceId: workspaceIdSchema.optional()
})
```

#### Routes to Validate
1. `/api/ai/chat/route.ts`
2. `/api/ai/chat/unified/route.ts`
3. `/api/ai/function-call/route.ts`
4. `/api/ai/huggingface-chat/route.ts`
5. `/api/ai/litellm/route.ts`
6. `/api/ai/model-selection/route.ts`
7. `/api/ai/provider-health/route.ts`
8. `/api/ai/upload/route.ts` - **FILE UPLOAD CRITICAL**
9. `/api/ai/web-search/route.ts`
10. `/api/ai/generate-project/route.ts`
11-17. Other AI routes

---

## Terminal & Code Server Routes (Week 3)

### High Command Injection Risk

#### `/api/terminal/session/route.ts`
```typescript
export const terminalCommandSchema = z.object({
  command: z.string().min(1).max(1000)
    .refine(
      (cmd) => !cmd.includes('rm -rf /'),
      'Dangerous command detected'
    ),
  sessionId: z.string().uuid(),
  workspaceId: workspaceIdSchema
})
```

#### `/api/terminal/ws/route.ts`
WebSocket terminal commands - same validation as above

#### `/api/code-server/session/route.ts`
Code server session management - validate session IDs and workspace IDs

---

## Monitoring & Health Routes (Week 4)

Most monitoring routes are GET-only but need query parameter validation:

```typescript
export const monitoringQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  metric: z.enum(['response_time', 'error_rate', 'user_activity']).optional(),
  interval: z.enum(['1m', '5m', '15m', '1h', '24h']).optional().default('5m')
})
```

---

## Implementation Pattern

### Step-by-Step Process

#### 1. Add Schema to schemas.ts
```typescript
export const YOUR_ROUTE_Schema = z.object({
  // Define fields with validation rules
  field1: z.string().min(1).max(100),
  field2: z.number().positive(),
  // ...
})
```

#### 2. Import Schema in Route
```typescript
import { YOUR_ROUTE_Schema } from '@/lib/api/validation/schemas'
import { z } from '@/lib/zod-compat'
```

#### 3. Add Validation Logic
```typescript
export async function POST(request: NextRequest) {
  try {
    // Validate request body
    let validatedData
    try {
      const body = await request.json()
      validatedData = YOUR_ROUTE_Schema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid request parameters',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 400 }
        )
      }
      throw error
    }

    // Use validatedData instead of raw body
    const { field1, field2 } = validatedData
    // ... rest of route logic
  } catch (error) {
    // ... error handling
  }
}
```

---

## Testing Checklist

For each validated route, test:

### Valid Inputs
- [ ] Minimal valid request
- [ ] Maximal valid request
- [ ] Optional fields omitted
- [ ] Optional fields included

### Invalid Inputs
- [ ] Missing required fields
- [ ] Invalid field types
- [ ] Out of range values
- [ ] Malformed data (injection attempts)
- [ ] Oversized payloads

### Edge Cases
- [ ] Empty strings
- [ ] Max length strings
- [ ] Special characters
- [ ] Unicode characters
- [ ] Null vs undefined

---

## Automated Validation Audit

### Create CI/CD Check
```typescript
// scripts/audit-api-validation.ts
import { glob } from 'glob'
import * as fs from 'fs'

const routeFiles = glob.sync('src/app/api/**/route.ts')
const unvalidated = []

for (const file of routeFiles) {
  const content = fs.readFileSync(file, 'utf-8')
  const hasZod = /import.*zod/.test(content)
  const hasValidation = /\.parse\(|\.safeParse\(|validateRequestBody/.test(content)

  if (!hasZod || !hasValidation) {
    unvalidated.push(file)
  }
}

if (unvalidated.length > 0) {
  console.error(`❌ ${unvalidated.length} routes missing validation:`)
  unvalidated.forEach(f => console.error(`  - ${f}`))
  process.exit(1)
}

console.log(`✅ All ${routeFiles.length} routes have validation`)
```

Add to package.json:
```json
{
  "scripts": {
    "audit:validation": "tsx scripts/audit-api-validation.ts"
  }
}
```

---

## Security Hardening Additions

### Rate Limiting Schema
```typescript
export const rateLimitSchema = z.object({
  maxRequests: z.number().int().positive().max(1000).default(100),
  windowMs: z.number().int().positive().max(3600000).default(60000) // 1 min default
})
```

### IP Validation
```typescript
export const ipAddressSchema = z.string()
  .regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/)
```

### JWT Token Schema
```typescript
export const jwtTokenSchema = z.string()
  .regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)
```

---

## Documentation Requirements

### For Each Validated Route
1. Document schema in JSDoc comments
2. Add example valid requests
3. Document error responses
4. Update API documentation

### Example
```typescript
/**
 * Chat Streaming API
 *
 * @route POST /api/chat/stream
 * @auth Required (JWT or test header)
 *
 * @body chatStreamSchema
 * - conversationId: string (1-100 chars)
 * - message: string (1-100KB)
 * - model: string (optional, default: anthropic/claude-3.5-sonnet)
 * - workspaceId: string (optional, default: 'default')
 * - files: string[] (optional)
 * - enableWebSearch: boolean (optional, default: false)
 * - enableRAG: boolean (optional, default: true)
 *
 * @returns {Stream} Server-Sent Events stream
 *
 * @throws {400} Invalid request parameters
 * @throws {401} Unauthorized
 * @throws {500} Internal server error
 *
 * @example
 * POST /api/chat/stream
 * {
 *   "conversationId": "conv-123",
 *   "message": "Hello, how are you?",
 *   "model": "anthropic/claude-3.5-sonnet"
 * }
 */
```

---

## Rollout Strategy

### Week 1 (5 days)
- Day 1-2: Validate 3 command injection routes (goose, terminal)
- Day 3-4: Validate 7 high-risk AI routes
- Day 5: Add tests for Week 1 routes

### Week 2 (5 days)
- Day 1-3: Validate remaining 10 AI routes
- Day 4: Validate code-server routes
- Day 5: Add tests for Week 2 routes

### Week 3 (5 days)
- Day 1-2: Validate monitoring/health routes (21 routes)
- Day 3-4: Validate miscellaneous routes
- Day 5: Comprehensive testing

### Week 4 (Completion)
- Day 1-2: Integration testing
- Day 3: Security audit
- Day 4: Documentation
- Day 5: CI/CD integration & deployment

---

## Success Metrics

### Coverage Goals
- Week 1: 35% coverage (30 routes)
- Week 2: 60% coverage (50 routes)
- Week 3: 90% coverage (76 routes)
- Week 4: 100% coverage (84 routes)

### Quality Gates
- [ ] Zero unhandled validation errors in production
- [ ] 100% test coverage on validation logic
- [ ] Documentation complete for all schemas
- [ ] CI/CD checks passing
- [ ] Security team approval

---

## Risk Mitigation

### High-Risk Changes
Routes with existing traffic or critical functionality:
1. Add validation but keep old logic as fallback
2. Log validation failures without blocking
3. Monitor error rates for 24 hours
4. Gradually enforce validation

### Example Gradual Rollout
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json()

  // Validate but don't block yet
  try {
    const validated = schema.parse(body)
    // Use validated data
  } catch (error) {
    // Log validation failure
    logger.warn('Validation failed but allowing request', { error, body })
    // Continue with old unvalidated logic
  }
}
```

After 24-48 hours of monitoring, switch to strict validation.

---

## Support & Resources

### Key Files
- Validation schemas: `/src/lib/api/validation/schemas.ts`
- Middleware: `/src/lib/api/validation/middleware.ts`
- Zod compat: `/src/lib/zod-compat.ts`

### Documentation
- Zod Documentation: https://zod.dev/
- Next.js API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- OWASP Input Validation: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html

### Team Contacts
- Security Review: Security Team
- API Design: Backend Team
- Testing: QA Team

---

## Appendix: Common Validation Patterns

### Pattern 1: Simple POST with Body
```typescript
const body = await request.json()
const validated = schema.parse(body)
```

### Pattern 2: GET with Query Params
```typescript
const { searchParams } = new URL(request.url)
const validated = schema.parse({
  param1: searchParams.get('param1'),
  param2: searchParams.get('param2')
})
```

### Pattern 3: Dynamic Path Params
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const validated = paramSchema.parse(params)
}
```

### Pattern 4: Discriminated Union (Action-based)
```typescript
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), data: z.string() }),
  z.object({ action: z.literal('update'), id: z.string(), data: z.string() }),
  z.object({ action: z.literal('delete'), id: z.string() })
])
```

---

**Last Updated**: 2025-10-22
**Next Review**: After Week 1 completion
**Status**: Ready for implementation
