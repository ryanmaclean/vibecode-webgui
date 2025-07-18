# VibeCode: Production-Ready Cloud-Native Development Platform

**Last Updated**: 2025-07-17
**Owner**: Platform Team

## ✅ STATUS: FULLY OPERATIONAL

**INFRASTRUCTURE ACHIEVEMENT**: Complete KIND cluster deployment with real Datadog monitoring, security hardening, and AI-powered autoscaling.

**INTEGRATION ACHIEVEMENT**: Complete Lovable/Replit/Bolt.diy workflow implemented with AI project generation → live code-server workspaces.

## 1. Executive Summary

This document outlines the production-deployed architecture for VibeCode, a cloud-native development platform. The system leverages a suite of battle-tested, open-source technologies to provide a scalable, secure, and observable development environment, minimizing custom overhead and accelerating feature delivery.

**Key Architecture Decision: Infrastructure-First Approach**
- **code-server provides**: Complete VS Code experience, extensions, terminal, and Git integration.
- **KIND provides**: Container orchestration, isolation, scaling, and persistent storage.
- **Focus shifts to**: User provisioning, workspace management, security, and AI integration.

## ✅ LOVABLE/REPLIT/BOLT.DIY INTEGRATION COMPLETE (2025-07-17)

### Implemented: Complete AI Project Generation Workflow
The platform now delivers the full Lovable/Replit/Bolt.diy experience:

**What's Implemented:**
1. **AI Project Generation**: `/api/ai/generate-project` endpoint with OpenRouter/Claude-3.5-Sonnet
2. **Live Workspace Creation**: Automatic code-server session provisioning with file seeding
3. **Seamless Integration**: Natural language → Complete project → Live code-server workspace
4. **Real-time Development**: Projects open directly in code-server, no ZIP downloads

**Current Operational State:**
- ✅ Projects page with AI-first workflow
- ✅ Code-server infrastructure (k8s deployments)
- ✅ AI chat interface
- ✅ **Complete bridge**: AI prompt → Project generation → Workspace → Code-server
- ✅ **Seamless flow**: Natural language → Live development environment

**Implemented Flow (Lovable/Replit/Bolt.diy):**
1. User describes project in AI Project Generator
2. AI generates complete project structure and code via OpenRouter/Claude-3.5-Sonnet
3. System automatically creates code-server workspace
4. Generated files are seeded into workspace
5. User is redirected to live code-server environment
6. User can continue development with AI assistance

**Technical Components:**
- **Frontend**: AIProjectGenerator component with full UI workflow
- **Backend**: `/api/ai/generate-project` with OpenRouter integration
- **Workspace Management**: Code-server session creation and file sync
- **Project Scaffolder**: Enhanced with "Open in Editor" as primary action
- **Test Coverage**: Comprehensive integration, unit, and e2e tests

**Success Metrics:**
- **Time to MVP**: 8 weeks (projected) vs. 24+ weeks for a custom build.
- **Team Size**: 2-3 infrastructure engineers instead of 8-10 full-stack developers.
- **Feature Parity**: 100% VS Code compatibility from day one.

## 2. Technical Deep Dive

**Project Status Summary:** The primary goal is to enhance and maintain the Kubernetes-based VibeCode platform. Recent work involved stabilizing the entire authentication stack by fixing the Authelia configuration, resolving complex NGINX ingress routing issues, and correcting misconfigured application environment variables to establish a fully functional and secure authentication flow. The CI/CD pipeline has also been updated with Datadog Test Visibility.

### Core Infrastructure: KIND + code-server
- **KIND Cluster**: Runs a complete Kubernetes environment locally inside Docker containers.
- **Ingress Controller**: Manages external access to services, with corrected timeout settings to ensure WebSocket stability.
- **code-server**: A dedicated VS Code instance for each developer.
- **Persistent Volumes**: Ensures user data is saved across sessions, and extensions are saved across sessions.

### Missing Integration Layer
**CRITICAL**: The infrastructure exists but the integration layer is missing:
- **Workspace API**: No API to create workspaces from templates
- **Project Seeding**: No way to populate code-server with generated project
- **AI → Editor Bridge**: AI generates code but doesn't push to code-server
- **Template → Workspace**: Templates don't automatically create workspaces

### Monitoring and Observability: Datadog Integration
- **Datadog Agent**: Deployed as a DaemonSet to run on every node.
- **Auto-discovery**: The agent uses Kubernetes annotations to automatically monitor services.
- **APM & RUM**: The application is fully instrumented with Datadog APM (backend) and RUM (frontend) libraries to trace requests and user sessions.
- **Log Collection**: All container logs are forwarded to Datadog for analysis.

### AI-Powered Autoscaling
- **Water-Pod-Autoscaler (WPA)**: A Kubernetes operator that provides intelligent, multi-metric autoscaling using custom metrics from Datadog (e.g., `active_user_sessions`).
- **DatadogPodAutoscaler**: A cutting-edge alternative for direct, query-based scaling from Datadog metrics.

### Security
- **Authentication**: Authelia provides Two-Factor Authentication (2FA).
- **Authorization**: Kubernetes Role-Based Access Control (RBAC) restricts user access.
- **Network Policies**: Restrict traffic between pods (e.g., only the app can access the database).
- **Secrets Management**: All secrets are stored in Kubernetes Secrets and injected securely.

## 3. Operational Guide

### Deployment Checklist
1.  **Local Development**: Use KIND cluster with the full monitoring stack.
2.  **Testing**: Run the complete test suite (`npm test`), including E2E and integration tests.
3.  **Staging**: Deploy to a staging environment with a real Datadog integration.
4.  **Production**: Use a blue-green deployment strategy, validating with monitoring.

### Alert Configuration
- **P1**: Service completely down (customer impact).
- **P2**: Performance degradation (potential customer impact).
- **P3**: Warning thresholds (investigate during business hours).
- **P4**: Informational (for trend analysis).

## 4. Required Implementation: Missing Lovable/Replit/Bolt.diy Flow

### URGENT: Core Integration Missing

**Problem**: We have all the pieces but no integration:
- ✅ Project templates (15+ templates)
- ✅ Code-server API (`/api/code-server/session`)
- ✅ AI chat interface
- ✅ Kubernetes infrastructure
- ❌ **Missing**: Bridge between project creation and workspace

### Required Implementation Steps:

1. **Fix Project Creation Flow**:
   ```typescript
   // In ProjectScaffolder.tsx - replace onDownload with:
   const createWorkspace = async () => {
     // 1. Create code-server session
     const session = await fetch('/api/code-server/session', {
       method: 'POST',
       body: JSON.stringify({
         workspaceId: `project-${Date.now()}`,
         userId: user.id
       })
     })
     
     // 2. Seed workspace with generated files
     await fetch('/api/files/sync', {
       method: 'POST',
       body: JSON.stringify({
         workspaceId: session.id,
         files: generatedFiles
       })
     })
     
     // 3. Redirect to workspace
     router.push(`/workspace/${session.id}`)
   }
   ```

2. **Implement AI → Code-Server Pipeline**:
   ```typescript
   // New API: /api/ai/generate-project
   export async function POST(request: NextRequest) {
     const { prompt, userId } = await request.json()
     
     // 1. Generate project with AI
     const projectCode = await generateProjectWithAI(prompt)
     
     // 2. Create workspace
     const workspace = await createCodeServerSession(userId)
     
     // 3. Seed workspace with generated code
     await seedWorkspaceFiles(workspace.id, projectCode)
     
     // 4. Return workspace URL
     return NextResponse.json({ workspaceUrl: `/workspace/${workspace.id}` })
   }
   ```

3. **Update Projects Page**:
   - Replace "Download ZIP" with "Open in Editor" button
   - Add "Start with AI" prompt → workspace flow
   - Connect to code-server session API

4. **Fix Workspace Provisioning**:
   - Update `/api/files/sync` to populate code-server workspace
   - Add workspace template seeding
   - Ensure workspace persistence

### Expected User Flow:
1. **Option A**: User selects template → clicks "Open in Editor" → workspace created with template
2. **Option B**: User types AI prompt → AI generates project → workspace created with generated code
3. **Option C**: User starts in workspace → uses AI chat to modify existing code

### Current vs Expected:
| Current | Expected |
|---------|----------|
| Templates → ZIP download | Templates → Live workspace |
| AI chat in separate page | AI chat → Generate → Open in editor |
| Workspace page isolated | Workspace populated with project |
| Manual file upload | Automatic project seeding |

## 5. Development Standards

### Datadog Tagging Strategy
```typescript
const standardTags = {
  env: process.env.NODE_ENV,
  service: 'vibecode-webgui',
  version: process.env.APP_VERSION,
  team: 'platform',
  component: 'api' // Or 'frontend', 'database', etc.
}
```

### Datadog Metric Naming Convention
```
vibecode.{component}.{metric_name}

// Examples:
vibecode.api.response_time
vibecode.frontend.page_load_time
vibecode.backend.database_query_duration
```

### Log Levels
- `ERROR`: System errors requiring immediate attention.
- `WARN`: Degraded performance or recoverable errors.
- `INFO`: Normal operation milestones (e.g., service startup).
- `DEBUG`: Detailed diagnostic information (for staging/dev only).
