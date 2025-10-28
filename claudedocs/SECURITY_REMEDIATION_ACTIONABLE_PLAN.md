# VibeCode Security Remediation - Actionable Implementation Plan
## Critical Path to Production Readiness

**Date:** 2025-10-12
**Status:** READY TO EXECUTE
**Timeline:** 6 weeks (accelerated: 4 weeks with 3 engineers)
**Budget:** $85,600 (standard) | $100K-120K (accelerated)

---

## IMMEDIATE ACTIONS (Next 24-48 Hours)

### 1. Execute Keychain Migration (Issue #530)
**Owner:** Security Engineer
**Effort:** 2 hours
**Risk:** VERY LOW (implementation ready)

```bash
# Step 1: Navigate to project
cd /Users/ryan.maclean/vibecode-webgui

# Step 2: Verify script exists
ls -la scripts/security/migrate-secrets-to-keychain.sh

# Step 3: Execute migration
./scripts/security/migrate-secrets-to-keychain.sh

# Step 4: Verify secrets in Keychain
security find-generic-password -s "com.vibecode.secrets" -a "OPENAI_API_KEY" -w

# Step 5: Update first critical route
# Edit: src/app/api/ai/chat/route.ts
# BEFORE:
# const apiKey = process.env.OPENAI_API_KEY
# AFTER:
import { loadSecret } from '@/lib/security/macos-keychain'
const apiKey = await loadSecret('OPENAI_API_KEY')

# Step 6: Test the change
npm run dev
curl http://localhost:3000/api/ai/chat -X POST -d '{"message": "test"}'

# Step 7: Commit the change
git add src/app/api/ai/chat/route.ts
git commit -m "security: migrate OPENAI_API_KEY to Keychain

- Replace process.env with loadSecret()
- Eliminates plaintext secret exposure
- Part of Issue #530 remediation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Success Criteria:**
- ✅ Keychain contains all secrets
- ✅ No plaintext secrets in .env files
- ✅ Application runs without errors
- ✅ API responses identical to before

---

### 2. Enable Production Console Removal
**Owner:** DevOps Engineer
**Effort:** 30 minutes
**Risk:** NONE

```javascript
// File: next.config.mjs
import TerserPlugin from 'terser-webpack-plugin'

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, dev }) => {
    if (!dev && !isServer) {
      config.optimization.minimizer.push(
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true, // Remove console.log in production
              drop_debugger: true,
            },
          },
        })
      )
    }
    return config
  },
}

export default nextConfig
```

**Test:**
```bash
npm run build
# Verify no console.log in production bundle
grep -r "console.log" .next/static/chunks/*.js
# Should return 0 results
```

---

### 3. Add SECURITY.md
**Owner:** Security Engineer
**Effort:** 1 hour
**Risk:** NONE

```markdown
<!-- File: SECURITY.md -->
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, please email: security@vibecode.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if known)

**Response Time:**
- Initial acknowledgment: 24 hours
- Status update: 72 hours
- Fix timeline: Within 30 days (critical issues within 7 days)

**Bug Bounty Program:**
Coming Q1 2026. Stay tuned!

## Security Contact
- Email: security@vibecode.com
- PGP Key: [Link to public key]
- Secure Contact: [HackerOne/Bugcrowd profile]

## Past Vulnerabilities
No disclosed vulnerabilities yet.

Thank you for helping keep VibeCode secure!
```

---

### 4. Configure Dependabot
**Owner:** DevOps Engineer
**Effort:** 15 minutes
**Risk:** NONE

```yaml
# File: .github/dependabot.yml
version: 2
updates:
  # Enable npm dependency updates
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "dependencies"
      - "security"
    # Auto-merge minor and patch updates
    assignees:
      - "devops-team"

  # Enable GitHub Actions updates
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  # Enable Docker updates (if using)
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

**Enable Auto-Merge:**
```yaml
# File: .github/workflows/dependabot-auto-merge.yml
name: Dependabot Auto-Merge
on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v1
        with:
          github-token: "${{ secrets.GITHUB_TOKEN }}"

      - name: Auto-merge minor/patch
        if: steps.metadata.outputs.update-type == 'version-update:semver-minor' || steps.metadata.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## WEEK 1: Critical Blocker Resolution

### Task 1.1: Complete Keychain Migration (Issue #530)
**Owner:** Security Engineer
**Duration:** 3 days
**Effort:** 20 hours

**Deliverables:**
1. All 221 `process.env` usages migrated to `loadSecret()`
2. Updated routes:
   - `/api/ai/*` (20 routes)
   - `/api/claude/*` (5 routes)
   - `/api/auth/*` (6 routes)
   - `/api/monitoring/*` (10 routes)
   - All other routes with secrets

**Implementation Pattern:**
```typescript
// Step 1: Identify routes with secrets
grep -r "process.env.OPENAI_API_KEY" src/app/api

// Step 2: Update each file
// BEFORE:
const apiKey = process.env.OPENAI_API_KEY

// AFTER:
import { loadSecret } from '@/lib/security/macos-keychain'
const apiKey = await loadSecret('OPENAI_API_KEY')

// Step 3: Update middleware/config files
// src/config/redis-agentapi.config.ts
// src/instrumentation.ts
// src/app/providers.tsx

// Step 4: Remove secrets from .env files
mv .env.local .env.local.backup-$(date +%Y%m%d)
cat > .env.local << 'EOF'
# VibeCode Environment Configuration
# Secrets loaded from macOS Keychain

NODE_ENV=development
BASE_URL=http://localhost:3000
PORT=3000
EOF

// Step 5: Verify no plaintext secrets
grep -r "process.env.*API_KEY\|SECRET\|PASSWORD" src/
# Should return 0 sensitive matches
```

**Testing:**
```bash
# Run all tests
npm run test

# Manual smoke test
npm run dev
# Test all API endpoints
curl http://localhost:3000/api/ai/chat
curl http://localhost:3000/api/claude/chat
curl http://localhost:3000/api/auth/session

# Verify Keychain access
security find-generic-password -s "com.vibecode.secrets" -a "OPENAI_API_KEY" -w
```

---

### Task 1.2: Top 20 Critical Route Validation (Issue #532)
**Owner:** Backend Engineer
**Duration:** 4 days
**Effort:** 28 hours

**Priority Routes (Ordered by Risk):**

1. **File Operations (Path Traversal Risk)**
   - `/api/files/route.ts`
   - `/api/files/sync/route.ts`
   - `/api/uploads/pdf/route.ts`

2. **Workspace Management (Authorization Bypass)**
   - `/api/workspaces/route.ts`
   - `/api/workspaces/[id]/route.ts`

3. **Container Operations (RCE Risk)**
   - `/api/containers/route.ts`
   - `/api/containers/[id]/route.ts`

4. **Agent Management (Privilege Escalation)**
   - `/api/agents/[...path]/route.ts`
   - `/api/agent-builder/session/route.ts`

5. **AI Operations (Prompt Injection)**
   - `/api/ai/chat/route.ts`
   - `/api/ai/chat/stream/route.ts`
   - `/api/ai/chat/enhanced/route.ts`
   - `/api/ai/upload/route.ts`
   - `/api/ai/web-search/route.ts`

6. **Authentication (Session Fixation)**
   - `/api/auth/login-tracking/route.ts`
   - `/api/auth/mfa/setup/route.ts`
   - `/api/auth/mfa/verify/route.ts`

7. **Search & Discovery (SQL Injection)**
   - `/api/ai/search/route.ts`
   - `/api/docs/search/route.ts`
   - `/api/vector-search/route.ts`

**Implementation Pattern:**

```typescript
// File: src/lib/validation/schemas.ts
import { z } from 'zod'

// Reusable validation schemas
export const WorkspaceIdSchema = z.string()
  .min(1, 'Workspace ID is required')
  .max(100, 'Workspace ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid workspace ID format')

export const FilePathSchema = z.string()
  .min(1, 'File path is required')
  .max(1000, 'File path too long')
  .refine(
    (path) => !path.includes('..'),
    'Path traversal detected'
  )
  .refine(
    (path) => !path.startsWith('/'),
    'Absolute paths not allowed'
  )

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).optional(),
})

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  filters: z.record(z.string()).optional(),
  sort: z.enum(['relevance', 'date', 'name']).default('relevance'),
}).merge(PaginationSchema)

// Container operation schemas
export const ContainerCreateSchema = z.object({
  name: z.string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid container name'),
  image: z.string()
    .min(1)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[a-zA-Z0-9_.-]+)?$/,
      'Invalid Docker image format'),
  workspaceId: WorkspaceIdSchema,
  profile: z.enum(['minimal', 'standard', 'performance']).default('standard'),
})

// File upload schemas
export const FileUploadSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, 'File too large (max 10MB)')
    .refine(
      (file) => ['application/pdf', 'text/plain', 'text/markdown'].includes(file.type),
      'Invalid file type'
    ),
  workspaceId: WorkspaceIdSchema,
})

// AI chat schemas
export const AIChatSchema = z.object({
  message: z.string().min(1).max(10000),
  workspaceId: WorkspaceIdSchema,
  model: z.enum(['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet']).optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(8000).default(2000),
  contextFiles: z.array(FilePathSchema).max(10).optional(),
})
```

**Route Implementation Example:**

```typescript
// File: src/app/api/files/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { WorkspaceIdSchema, FilePathSchema } from '@/lib/validation/schemas'

const FileRequestSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  path: FilePathSchema,
  content: z.string().optional(),
  encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
})

export async function GET(req: NextRequest) {
  try {
    // Parse query parameters
    const workspaceId = req.nextUrl.searchParams.get('workspaceId')
    const path = req.nextUrl.searchParams.get('path')

    // Validate input
    const result = FileRequestSchema.safeParse({
      workspaceId,
      path,
    })

    if (!result.success) {
      return NextResponse.json({
        error: 'Invalid request parameters',
        details: result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, { status: 400 })
    }

    const { workspaceId: validWorkspaceId, path: validPath } = result.data

    // ... continue with file operations using validated data
    // ... (workspace access check happens here)

  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = FileRequestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({
        error: 'Invalid request body',
        details: result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, { status: 400 })
    }

    const validated = result.data

    // ... continue with file write operations

  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
```

**Testing:**
```bash
# Test valid request
curl -X POST http://localhost:3000/api/files \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace-123",
    "path": "src/index.ts",
    "content": "console.log(\"test\")"
  }'
# Expected: 200 OK

# Test path traversal (should be blocked)
curl -X POST http://localhost:3000/api/files \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace-123",
    "path": "../../etc/passwd",
    "content": "malicious"
  }'
# Expected: 400 Bad Request with "Path traversal detected"

# Test oversized payload (should be blocked)
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"$(python3 -c 'print(\"x\" * 10001)')\"}"
# Expected: 400 Bad Request with "Message too long"
```

**Automated Testing:**
```typescript
// File: src/app/api/files/__tests__/route.test.ts
import { describe, it, expect } from 'vitest'
import { POST } from '../route'

describe('POST /api/files', () => {
  it('should accept valid file requests', async () => {
    const req = new Request('http://localhost:3000/api/files', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: 'workspace-123',
        path: 'src/index.ts',
        content: 'console.log("test")',
      }),
    })

    const res = await POST(req as any)
    expect(res.status).toBe(200)
  })

  it('should reject path traversal attempts', async () => {
    const req = new Request('http://localhost:3000/api/files', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: 'workspace-123',
        path: '../../etc/passwd',
        content: 'malicious',
      }),
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Path traversal')
  })

  it('should reject invalid workspace IDs', async () => {
    const req = new Request('http://localhost:3000/api/files', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: '../admin',
        path: 'src/index.ts',
        content: 'test',
      }),
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})
```

---

### Task 1.3: Workspace Access Control Database Setup (Issue #283)
**Owner:** Backend Engineer + DBA
**Duration:** 2 days
**Effort:** 16 hours

**Step 1: Update Prisma Schema**

```prisma
// File: prisma/schema.prisma

model User {
  id            String          @id @default(cuid())
  email         String          @unique
  name          String?
  password      String?
  emailVerified DateTime?
  image         String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  // Relations
  accounts      Account[]
  sessions      Session[]
  workspaces    UserWorkspace[]

  @@index([email])
}

model Workspace {
  id          String          @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  // Relations
  users       UserWorkspace[]
  files       File[]
  containers  Container[]

  @@index([name])
}

model UserWorkspace {
  userId      String
  workspaceId String
  role        WorkspaceRole   @default(MEMBER)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@id([userId, workspaceId])
  @@index([userId])
  @@index([workspaceId])
}

enum WorkspaceRole {
  OWNER   // Full control, can delete workspace
  ADMIN   // Can manage members, modify files
  MEMBER  // Can read/write files
  VIEWER  // Read-only access
}
```

**Step 2: Generate Migration**

```bash
# Generate migration
npx prisma migrate dev --name add_workspace_access_control

# Review migration SQL
cat prisma/migrations/YYYYMMDD_add_workspace_access_control/migration.sql

# Apply to development database
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

**Step 3: Seed Existing Workspaces**

```typescript
// File: prisma/seed-workspace-access.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find all existing workspaces without access control
  const workspaces = await prisma.workspace.findMany({
    include: {
      users: true,
    },
  })

  console.log(`Found ${workspaces.length} workspaces to migrate`)

  for (const workspace of workspaces) {
    if (workspace.users.length === 0) {
      // Find the creator (first user who created files in this workspace)
      const firstFile = await prisma.file.findFirst({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: 'asc' },
        include: { user: true },
      })

      if (firstFile?.user) {
        // Assign creator as OWNER
        await prisma.userWorkspace.create({
          data: {
            userId: firstFile.user.id,
            workspaceId: workspace.id,
            role: 'OWNER',
          },
        })
        console.log(`✅ Assigned ${firstFile.user.email} as OWNER of ${workspace.name}`)
      }
    }
  }

  console.log('✅ Workspace access control migration complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Run Seeding:**
```bash
npx ts-node prisma/seed-workspace-access.ts
```

---

## WEEK 2: Access Control Implementation

### Task 2.1: Authorization Library (Issue #283 continued)
**Owner:** Backend Engineer
**Duration:** 2 days
**Effort:** 16 hours

**Implementation:**

```typescript
// File: src/lib/auth/workspace-access.ts
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { WorkspaceRole } from '@prisma/client'

export interface AccessCheckResult {
  authorized: boolean
  role?: WorkspaceRole
  userId?: string
  reason?: string
}

/**
 * Check if current user has access to workspace with required role
 */
export async function checkWorkspaceAccess(
  workspaceId: string,
  requiredRole: WorkspaceRole = 'MEMBER'
): Promise<AccessCheckResult> {
  // Get current session
  const session = await getServerSession()

  if (!session?.user?.id) {
    return {
      authorized: false,
      reason: 'Not authenticated',
    }
  }

  // Query user-workspace relationship
  const userWorkspace = await prisma.userWorkspace.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.user.id,
        workspaceId,
      },
    },
  })

  if (!userWorkspace) {
    return {
      authorized: false,
      userId: session.user.id,
      reason: 'User is not a member of this workspace',
    }
  }

  // Check role hierarchy
  const roleHierarchy: Record<WorkspaceRole, number> = {
    OWNER: 4,
    ADMIN: 3,
    MEMBER: 2,
    VIEWER: 1,
  }

  const userRoleLevel = roleHierarchy[userWorkspace.role]
  const requiredRoleLevel = roleHierarchy[requiredRole]

  const hasRequiredRole = userRoleLevel >= requiredRoleLevel

  return {
    authorized: hasRequiredRole,
    role: userWorkspace.role,
    userId: session.user.id,
    reason: hasRequiredRole
      ? undefined
      : `Insufficient permissions (required: ${requiredRole}, actual: ${userWorkspace.role})`,
  }
}

/**
 * Middleware for protecting API routes with workspace access control
 */
export function withWorkspaceAuth(
  handler: (req: Request, workspaceId: string, userId: string) => Promise<Response>,
  requiredRole: WorkspaceRole = 'MEMBER'
) {
  return async (req: Request): Promise<Response> => {
    // Extract workspaceId from request (query param or body)
    const { searchParams } = new URL(req.url)
    let workspaceId = searchParams.get('workspaceId')

    if (!workspaceId && req.method === 'POST') {
      const body = await req.json()
      workspaceId = body.workspaceId
    }

    if (!workspaceId) {
      return new Response(
        JSON.stringify({
          error: 'Missing workspaceId',
          details: 'workspaceId is required in query params or request body',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Check access
    const accessCheck = await checkWorkspaceAccess(workspaceId, requiredRole)

    if (!accessCheck.authorized) {
      return new Response(
        JSON.stringify({
          error: 'Access denied',
          details: accessCheck.reason,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Call original handler with validated workspaceId and userId
    return handler(req, workspaceId, accessCheck.userId!)
  }
}

/**
 * List all workspaces accessible to current user
 */
export async function getUserWorkspaces(userId?: string): Promise<{
  workspaceId: string
  role: WorkspaceRole
  workspace: {
    id: string
    name: string
    description: string | null
    createdAt: Date
  }
}[]> {
  const session = await getServerSession()
  const targetUserId = userId || session?.user?.id

  if (!targetUserId) {
    return []
  }

  const workspaces = await prisma.userWorkspace.findMany({
    where: { userId: targetUserId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return workspaces
}
```

---

### Task 2.2: Update Critical Routes with Access Control
**Owner:** Backend Engineer
**Duration:** 3 days
**Effort:** 20 hours

**Priority Routes to Update:**

1. `/api/files/route.ts`
2. `/api/files/sync/route.ts`
3. `/api/claude/chat/secure-route.ts`
4. `/api/workspaces/[id]/route.ts`
5. `/api/containers/route.ts`

**Example Implementation:**

```typescript
// File: src/app/api/files/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { checkWorkspaceAccess } from '@/lib/auth/workspace-access'
import { FileRequestSchema } from '@/lib/validation/schemas'

export async function GET(req: NextRequest) {
  try {
    // 1. Validate input
    const workspaceId = req.nextUrl.searchParams.get('workspaceId')
    const path = req.nextUrl.searchParams.get('path')

    const validation = FileRequestSchema.safeParse({ workspaceId, path })
    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: validation.error.errors,
      }, { status: 400 })
    }

    // 2. Check workspace access (VIEWER role sufficient for read)
    const access = await checkWorkspaceAccess(validation.data.workspaceId, 'VIEWER')
    if (!access.authorized) {
      return NextResponse.json({
        error: 'Access denied',
        details: access.reason,
      }, { status: 403 })
    }

    // 3. Read file with validated workspaceId and path
    const fileContent = await readFile(validation.data.workspaceId, validation.data.path)

    return NextResponse.json({
      success: true,
      content: fileContent,
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Validate input
    const body = await req.json()
    const validation = FileRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: validation.error.errors,
      }, { status: 400 })
    }

    // 2. Check workspace access (MEMBER role required for write)
    const access = await checkWorkspaceAccess(validation.data.workspaceId, 'MEMBER')
    if (!access.authorized) {
      return NextResponse.json({
        error: 'Access denied',
        details: access.reason,
      }, { status: 403 })
    }

    // 3. Write file with validated data
    await writeFile(
      validation.data.workspaceId,
      validation.data.path,
      validation.data.content!
    )

    return NextResponse.json({
      success: true,
      message: 'File saved',
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
```

**WebSocket Integration:**

```typescript
// File: src/app/api/claude/chat/secure-route.ts
import { checkWorkspaceAccess } from '@/lib/auth/workspace-access'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')

  if (!workspaceId) {
    return new Response('Missing workspaceId', { status: 400 })
  }

  // Check access before WebSocket upgrade
  const access = await checkWorkspaceAccess(workspaceId, 'MEMBER')
  if (!access.authorized) {
    return new Response(JSON.stringify({
      error: 'Access denied',
      details: access.reason,
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Upgrade to WebSocket only after authorization
  const { socket, response } = Deno.upgradeWebSocket(req)

  socket.onopen = () => {
    console.log(`WebSocket opened for user ${access.userId} in workspace ${workspaceId}`)
  }

  socket.onmessage = async (event) => {
    // All messages are authorized for this workspace
    await handleClaudeMessage(event.data, workspaceId, access.userId!)
  }

  return response
}
```

---

## WEEK 3-4: Remaining Validation & Supply Chain Security

### Task 3.1: Complete API Route Validation (Remaining 47 routes)
**Owner:** Backend Engineer
**Duration:** 4 days
**Effort:** 28 hours

**Batch Processing Strategy:**

```bash
# Generate scaffolding for all remaining routes
for route in $(find src/app/api -name "route.ts" | grep -v "__tests__"); do
  echo "Processing $route..."

  # Check if already has Zod import
  if ! grep -q "from 'zod'" "$route"; then
    echo "TODO: Add Zod validation to $route"
  fi
done
```

**Automated Schema Generation:**
```typescript
// Tool: scripts/generate-validation-schema.ts
// Analyzes existing route and suggests Zod schema

import * as fs from 'fs'
import * as path from 'path'

function analyzeRoute(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8')

  // Extract request parameters
  const queryParams = content.match(/searchParams\.get\(['"](\w+)['"]\)/g) || []
  const bodyFields = content.match(/body\.(\w+)/g) || []

  // Generate Zod schema
  const schema = generateSchema(queryParams, bodyFields)

  console.log(`\n// Suggested schema for ${filePath}:`)
  console.log(schema)
}

function generateSchema(queryParams: string[], bodyFields: string[]): string {
  let schema = 'const RequestSchema = z.object({\n'

  // Add query params
  queryParams.forEach((param) => {
    const field = param.match(/['"](\w+)['"]/)?.[1]
    schema += `  ${field}: z.string().min(1),\n`
  })

  // Add body fields
  bodyFields.forEach((field) => {
    const fieldName = field.replace('body.', '')
    schema += `  ${fieldName}: z.string(),\n`
  })

  schema += '})'
  return schema
}

// Run on all routes
const apiDir = 'src/app/api'
const routes = findRoutes(apiDir)
routes.forEach(analyzeRoute)
```

---

### Task 3.2: Supply Chain Security (Issue #290)
**Owner:** DevOps Engineer
**Duration:** 5 days
**Effort:** 40 hours

**Step 1: SBOM Generation**

```bash
# File: scripts/generate-sbom.sh
#!/bin/bash
set -euo pipefail

echo "Generating SBOM for VibeCode..."

# Install Syft
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin

# Generate SBOM for Docker image
syft packages docker:vibecode/code-server:latest \
  -o cyclonedx-json \
  > sbom-cyclonedx.json

# Generate SBOM for npm dependencies
syft packages dir:. \
  -o cyclonedx-json \
  > sbom-npm-cyclonedx.json

# Generate SBOM for VS Code extensions
for ext in $(ls docker/code-server/extensions/*.vsix); do
  syft packages file:"$ext" \
    -o cyclonedx-json \
    > "sbom-$(basename "$ext" .vsix).json"
done

echo "✅ SBOM generation complete"
ls -lh sbom-*.json
```

**Step 2: Vulnerability Scanning**

```bash
# File: scripts/scan-vulnerabilities.sh
#!/bin/bash
set -euo pipefail

echo "Scanning for vulnerabilities..."

# Install Grype
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin

# Scan Docker image
grype docker:vibecode/code-server:latest \
  --fail-on critical \
  -o json \
  > vulnerabilities-image.json

# Scan npm dependencies
grype dir:. \
  --fail-on critical \
  -o json \
  > vulnerabilities-npm.json

# Generate human-readable report
grype docker:vibecode/code-server:latest \
  -o table \
  > vulnerabilities-report.txt

echo "✅ Vulnerability scanning complete"
cat vulnerabilities-report.txt
```

**Step 3: CI/CD Integration**

```yaml
# File: .github/workflows/security-scanning.yml
name: Security Scanning

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Mondays

jobs:
  sbom-generation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate SBOM
        run: |
          ./scripts/generate-sbom.sh

      - name: Upload SBOM artifacts
        uses: actions/upload-artifact@v4
        with:
          name: sbom-reports
          path: sbom-*.json

  vulnerability-scanning:
    runs-on: ubuntu-latest
    needs: sbom-generation
    steps:
      - uses: actions/checkout@v4

      - name: Download SBOM
        uses: actions/download-artifact@v4
        with:
          name: sbom-reports

      - name: Scan for vulnerabilities
        run: |
          ./scripts/scan-vulnerabilities.sh

      - name: Upload vulnerability report
        uses: actions/upload-artifact@v4
        with:
          name: vulnerability-reports
          path: vulnerabilities-*.json

      - name: Fail on critical vulnerabilities
        run: |
          if grep -q "CRITICAL" vulnerabilities-report.txt; then
            echo "❌ Critical vulnerabilities found!"
            cat vulnerabilities-report.txt
            exit 1
          fi

  extension-verification:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Verify extension checksums
        run: |
          # Generate checksums for all extensions
          cd docker/code-server/extensions
          sha256sum *.vsix > checksums.txt

          # Compare with stored checksums
          if ! sha256sum -c checksums.txt; then
            echo "❌ Extension checksum mismatch!"
            exit 1
          fi

      - name: Verify extension signatures
        run: |
          # Verify publisher signatures (if available)
          for ext in docker/code-server/extensions/*.vsix; do
            echo "Verifying $ext..."
            # TODO: Implement signature verification
          done
```

---

## WEEK 5-6: Defense-in-Depth & Monitoring

### Task 4.1: Structured Logging Migration (Issue #448)
**Owner:** Backend Engineer
**Duration:** 2 days
**Effort:** 16 hours

**Implementation:** See earlier section on console.log replacement

---

### Task 4.2: Cryptographic Random Number Generation
**Owner:** Backend Engineer
**Duration:** 1 day
**Effort:** 8 hours

**Automated Replacement:**
```typescript
// File: scripts/replace-math-random.ts
import * as fs from 'fs'
import * as path from 'path'

function replaceMathRandom(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8')
  let modified = false

  // Pattern 1: Math.random().toString(36).substr(2, 9)
  const pattern1 = /Math\.random\(\)\.toString\(36\)\.substr\(\d+,\s*\d+\)/g
  if (pattern1.test(content)) {
    content = content.replace(
      pattern1,
      'crypto.randomBytes(16).toString(\'hex\')'
    )
    modified = true
  }

  // Pattern 2: Math.random() for session IDs
  const pattern2 = /`session-\$\{Math\.random\(\)[^}]+\}`/g
  if (pattern2.test(content)) {
    content = content.replace(
      pattern2,
      '`session-${crypto.randomUUID()}`'
    )
    modified = true
  }

  // Add import if modified
  if (modified && !content.includes('import { randomBytes }') && !content.includes('import crypto')) {
    content = `import { randomBytes } from 'crypto'\n${content}`
  }

  if (modified) {
    fs.writeFileSync(filePath, content)
    console.log(`✅ Updated ${filePath}`)
  }
}

// Run on all TypeScript files
const files = [
  'src/hooks/useCollaboration.ts',
  'src/app/api/monitoring/metrics/route.ts',
  // ... (add all 25 files)
]

files.forEach(replaceMathRandom)
```

---

## TESTING STRATEGY

### Security Test Suite

```typescript
// File: tests/security/security-suite.test.ts
import { describe, it, expect, beforeAll } from 'vitest'

describe('Security Test Suite', () => {
  describe('Input Validation', () => {
    it('should block path traversal attempts', async () => {
      const res = await fetch('http://localhost:3000/api/files', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'test',
          path: '../../etc/passwd',
        }),
      })
      expect(res.status).toBe(400)
    })

    it('should block SQL injection attempts', async () => {
      const res = await fetch('http://localhost:3000/api/search?q=test\'; DROP TABLE users;--')
      expect(res.status).toBe(400)
    })

    it('should block oversized payloads', async () => {
      const largePayload = 'x'.repeat(1000000)
      const res = await fetch('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: largePayload }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('Access Control', () => {
    it('should deny unauthorized workspace access', async () => {
      // User A tries to access User B's workspace
      const res = await fetch('http://localhost:3000/api/files?workspaceId=user-b-workspace', {
        headers: { Authorization: 'Bearer user-a-token' },
      })
      expect(res.status).toBe(403)
    })

    it('should allow authorized workspace access', async () => {
      const res = await fetch('http://localhost:3000/api/files?workspaceId=user-a-workspace', {
        headers: { Authorization: 'Bearer user-a-token' },
      })
      expect(res.status).toBe(200)
    })
  })

  describe('Secret Management', () => {
    it('should not expose secrets in API responses', async () => {
      const res = await fetch('http://localhost:3000/api/monitoring/config')
      const body = await res.json()

      // Verify no secrets in response
      expect(JSON.stringify(body)).not.toContain('sk-')  // OpenAI key prefix
      expect(JSON.stringify(body)).not.toContain('anthropic_api_key')
    })
  })
})
```

---

## SUCCESS CRITERIA CHECKLIST

### Phase 1 Complete (Week 1-2)
- [ ] All 221 `process.env` usages migrated to Keychain
- [ ] Top 20 API routes have Zod validation
- [ ] Workspace access control database schema deployed
- [ ] Authorization library implemented
- [ ] Critical routes updated with access checks
- [ ] All Phase 1 tests passing

### Phase 2 Complete (Week 3-4)
- [ ] All 81 API routes have Zod validation (100% coverage)
- [ ] SBOM generation in CI/CD pipeline
- [ ] Vulnerability scanning enforced (fails on critical CVEs)
- [ ] Extension checksum verification
- [ ] Code signing configured (Apple Developer cert)
- [ ] All Phase 2 tests passing

### Phase 3 Complete (Week 5-6)
- [ ] Winston structured logging deployed
- [ ] All `console.log` removed from production builds
- [ ] Math.random() replaced with crypto APIs (25 files)
- [ ] Datadog cloud security monitoring live
- [ ] Secret scanning in CI/CD
- [ ] Security monitoring dashboards deployed

### Final Validation
- [ ] Zero CRITICAL vulnerabilities
- [ ] Zero HIGH vulnerabilities
- [ ] SOC 2 control gaps closed (6/6 controls passing)
- [ ] Penetration test completed (no critical findings)
- [ ] Security audit report approved
- [ ] Production deployment approved by security team

---

## EMERGENCY CONTACTS

**Security Incidents:**
- Email: security@vibecode.com
- Slack: #security-incidents
- On-call: PagerDuty rotation

**Technical Support:**
- Backend Team: #backend-eng
- DevOps Team: #devops
- Security Team: #security

**Escalation Path:**
1. Engineering Manager
2. Director of Engineering
3. VP of Engineering
4. CISO

---

**Document Version:** 1.0
**Last Updated:** 2025-10-12
**Next Review:** 2025-10-19 (weekly during remediation)
