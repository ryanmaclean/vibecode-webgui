---
title: Api
description: Auto-generated API reference generated from Next.js routes.
---

# API Documentation

*Generated on 2025-09-30T01:43:50.248Z*

This documentation is automatically generated from the codebase.

## Table of Contents

- [/api/vector-store](#-api-vector-store)
- [/api/test-db](#-api-test-db)
- [/api/templates](#-api-templates)
- [/api/readyz](#-api-readyz)
- [/api/mongodb-test](#-api-mongodb-test)
- [/api/healthz](#-api-healthz)
- [/api/health](#-api-health)
- [/api/workspaces](#-api-workspaces)
- [/api/files](#-api-files)
- [/api/experiments](#-api-experiments)
- [/api/code-completion](#-api-code-completion)
- [/api/workspace/auto-scaling](#-api-workspace-auto-scaling)
- [/api/uploads/pdf](#-api-uploads-pdf)
- [/api/terminal/ws](#-api-terminal-ws)
- [/api/projects/template](#-api-projects-template)
- [/api/terminal/session](#-api-terminal-session)
- [/api/ollama/models](#-api-ollama-models)
- [/api/monitoring/overview/security](#-api-monitoring-security)
- [/api/monitoring/overview/traces](#-api-monitoring-traces)
- [/api/monitoring/overview/pool-alerts](#-api-monitoring-pool-alerts)
- [/api/monitoring/overview/pool](#-api-monitoring-pool)
- [/api/monitoring/overview/rum](#-api-monitoring-rum)
- [/api/monitoring/overview/performance](#-api-monitoring-performance)
- [/api/monitoring/overview/metrics](#-api-monitoring-metrics)
- [/api/monitoring/overview/otel-config](#-api-monitoring-otel-config)
- [/api/monitoring/overview/embeddings](#-api-monitoring-embeddings)
- [/api/monitoring/overview/dashboard](#-api-monitoring-dashboard)
- [/api/monitoring/overview/cache](#-api-monitoring-cache)
- [/api/monitoring/overview/azure-embedding](#-api-monitoring-azure-embedding)
- [/api/health/vector-metrics](#-api-health-vector-metrics)
- [/api/health/vector-db](#-api-health-vector-db)
- [/api/health/simple](#-api-health-simple)
- [/api/health/db](#-api-health-db)
- [/api/health/database](#-api-health-database)
- [/api/health/connection-pool](#-api-health-connection-pool)
- [/api/workspaces/:id](#-api-workspaces--id)
- [/api/files/sync](#-api-files-sync)
- [/api/docs/search](#-api-docs-search)
- [/api/claude/session](#-api-claude-session)
- [/api/claude/generate](#-api-claude-generate)
- [/api/claude/chat](#-api-claude-chat)
- [/api/claude/analyze](#-api-claude-analyze)
- [/api/chat/stream](#-api-chat-stream)
- [/api/chat/mongodb-simple](#-api-chat-mongodb-simple)
- [/api/chat/mongodb](#-api-chat-mongodb)
- [/api/auth/login-tracking](#-api-auth-login-tracking)
- [/api/code-server/session](#-api-code-server-session)
- [/api/ai/web-search](#-api-ai-web-search)
- [/api/ai/upload](#-api-ai-upload)
- [/api/ai/search](#-api-ai-search)
- [/api/ai/provider-health](#-api-ai-provider-health)
- [/api/ai/model-selection](#-api-ai-model-selection)
- [/api/ai/management](#-api-ai-management)
- [/api/ai/huggingface-init](#-api-ai-huggingface-init)
- [/api/ai/huggingface-chat](#-api-ai-huggingface-chat)
- [/api/ai/litellm](#-api-ai-litellm)
- [/api/ai/generate-project](#-api-ai-generate-project)
- [/api/ai/function-call](#-api-ai-function-call)
- [/api/ai/chat](#-api-ai-chat)
- [/api/gradio/run](#-api-gradio-run)
- [/api/workspace/:id/init-goose](#-api-workspace--id-init-goose)
- [/api/health/database/metrics](#-api-health-database-metrics)
- [/api/auth/saml/sso](#-api-auth-saml-sso)
- [/api/auth/saml/metadata](#-api-auth-saml-metadata)
- [/api/auth/mfa/verify](#-api-auth-mfa-verify)
- [/api/auth/mfa/setup](#-api-auth-mfa-setup)
- [/api/code-server/session/:sessionId](#-api-code-server-session--sessionid)
- [/api/ai/conversations/:workspaceId](#-api-ai-conversations--workspaceid)
- [/api/ai/chat/unified](#-api-ai-chat-unified)
- [/api/ai/chat/stream](#-api-ai-chat-stream)
- [/api/ai/chat/enhanced](#-api-ai-chat-enhanced)
- [/api/monitoring/overview/connection-pool/dashboard](#-api-monitoring-connection-pool-dashboard)

## /api/vector-store

### GET /api/vector-store

Enhanced Vector Store API Unified API for multiple vector database providers Supports PostgreSQL pgvector, Weaviate, and intelligent routing

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

*Source: [src/app/api/vector-store/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/vector-store/route.ts)*

---

### POST /api/vector-store

Enhanced Vector Store API Unified API for multiple vector database providers Supports PostgreSQL pgvector, Weaviate, and intelligent routing

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

*Source: [src/app/api/vector-store/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/vector-store/route.ts)*

---

### PUT /api/vector-store

Enhanced Vector Store API Unified API for multiple vector database providers Supports PostgreSQL pgvector, Weaviate, and intelligent routing

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

*Source: [src/app/api/vector-store/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/vector-store/route.ts)*

---

### DELETE /api/vector-store

Enhanced Vector Store API Unified API for multiple vector database providers Supports PostgreSQL pgvector, Weaviate, and intelligent routing

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

*Source: [src/app/api/vector-store/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/vector-store/route.ts)*

---

## /api/test-db

### GET /api/test-db

GET endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/test-db/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/test-db/route.ts)*

---

## /api/templates

### GET /api/templates

Templates API - Real template management Provides actual project templates for quick project creation

#### Responses

**500** - Internal Server Error

**501** - Response

*Source: [src/app/api/templates/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/templates/route.ts)*

---

### POST /api/templates

Templates API - Real template management Provides actual project templates for quick project creation

#### Responses

**500** - Internal Server Error

**501** - Response

*Source: [src/app/api/templates/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/templates/route.ts)*

---

## /api/readyz

### GET /api/readyz

GET endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/readyz/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/readyz/route.ts)*

---

## /api/mongodb-test

### GET /api/mongodb-test

GET endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/mongodb-test/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/mongodb-test/route.ts)*

---

## /api/healthz

### GET /api/healthz

GET endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/healthz/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/healthz/route.ts)*

---

## /api/health

### GET /api/health

GET endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/health/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/health/route.ts)*

---

## /api/workspaces

### GET /api/workspaces

Workspace Management API Handles workspace creation, listing, and management

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | No | id query parameter |

#### Responses

**403** - Forbidden

**408** - Response

**507** - Response

**404** - Not Found

*Source: [src/app/api/workspaces/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/workspaces/route.ts)*

---

### POST /api/workspaces

Workspace Management API Handles workspace creation, listing, and management

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | No | id query parameter |

#### Responses

**403** - Forbidden

**408** - Response

**507** - Response

**404** - Not Found

*Source: [src/app/api/workspaces/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/workspaces/route.ts)*

---

## /api/files

### GET /api/files

Secure File Operations API Routes Production-ready file CRUD operations with security, real-time sync, and conflict resolution Implements secure file management for the VibeCode platform Staff Engineer Implementation - Enterprise-grade file API

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| path | string | No | path query parameter |
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

**400** - Bad Request

**400** - Bad Request

**404** - Not Found

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

**400** - Bad Request

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

*Source: [src/app/api/files/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/files/route.ts)*

---

### POST /api/files

Secure File Operations API Routes Production-ready file CRUD operations with security, real-time sync, and conflict resolution Implements secure file management for the VibeCode platform Staff Engineer Implementation - Enterprise-grade file API

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| path | string | No | path query parameter |
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

**400** - Bad Request

**400** - Bad Request

**404** - Not Found

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

**400** - Bad Request

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

*Source: [src/app/api/files/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/files/route.ts)*

---

### PUT /api/files

Secure File Operations API Routes Production-ready file CRUD operations with security, real-time sync, and conflict resolution Implements secure file management for the VibeCode platform Staff Engineer Implementation - Enterprise-grade file API

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| path | string | No | path query parameter |
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

**400** - Bad Request

**400** - Bad Request

**404** - Not Found

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

**400** - Bad Request

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

*Source: [src/app/api/files/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/files/route.ts)*

---

### DELETE /api/files

Secure File Operations API Routes Production-ready file CRUD operations with security, real-time sync, and conflict resolution Implements secure file management for the VibeCode platform Staff Engineer Implementation - Enterprise-grade file API

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| path | string | No | path query parameter |
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

**400** - Bad Request

**400** - Bad Request

**404** - Not Found

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

**400** - Bad Request

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

*Source: [src/app/api/files/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/files/route.ts)*

---

## /api/experiments

### GET /api/experiments

Experiments API endpoint Provides feature flag evaluation and experiment tracking Inspired by Datadog's Eppo acquisition capabilities

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| flagKey | string | No | flagKey query parameter |
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**403** - Forbidden

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/experiments/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/experiments/route.ts)*

---

### POST /api/experiments

Experiments API endpoint Provides feature flag evaluation and experiment tracking Inspired by Datadog's Eppo acquisition capabilities

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| flagKey | string | No | flagKey query parameter |
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**403** - Forbidden

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/experiments/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/experiments/route.ts)*

---

## /api/code-completion

### GET /api/code-completion

Code Completion API Route Handles AI-powered code completion requests from Monacopilot. Supports multiple AI providers: OpenAI, Mistral, Anthropic, Groq, etc.

**Authentication:** API key required

#### Responses

**400** - Bad Request

*Source: [src/app/api/code-completion/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/code-completion/route.ts)*

---

### POST /api/code-completion

Code Completion API Route Handles AI-powered code completion requests from Monacopilot. Supports multiple AI providers: OpenAI, Mistral, Anthropic, Groq, etc.

**Authentication:** API key required

#### Responses

**400** - Bad Request

*Source: [src/app/api/code-completion/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/code-completion/route.ts)*

---

## /api/workspace/auto-scaling

### GET /api/workspace/auto-scaling

Workspace Auto-Scaling API Manages dynamic resource scaling for workspace instances

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

*Source: [src/app/api/workspace/auto-scaling/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/workspace/auto-scaling/route.ts)*

---

### POST /api/workspace/auto-scaling

Workspace Auto-Scaling API Manages dynamic resource scaling for workspace instances

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

*Source: [src/app/api/workspace/auto-scaling/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/workspace/auto-scaling/route.ts)*

---

### PUT /api/workspace/auto-scaling

Workspace Auto-Scaling API Manages dynamic resource scaling for workspace instances

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

*Source: [src/app/api/workspace/auto-scaling/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/workspace/auto-scaling/route.ts)*

---

### DELETE /api/workspace/auto-scaling

Workspace Auto-Scaling API Manages dynamic resource scaling for workspace instances

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

*Source: [src/app/api/workspace/auto-scaling/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/workspace/auto-scaling/route.ts)*

---

### PATCH /api/workspace/auto-scaling

Workspace Auto-Scaling API Manages dynamic resource scaling for workspace instances

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

**403** - Forbidden

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

*Source: [src/app/api/workspace/auto-scaling/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/workspace/auto-scaling/route.ts)*

---

## /api/uploads/pdf

### POST /api/uploads/pdf

POST endpoint

#### Responses

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**415** - Response

**400** - Bad Request

**404** - Not Found

**400** - Bad Request

**404** - Not Found

**500** - Internal Server Error

**500** - Internal Server Error

**500** - Internal Server Error

**500** - Internal Server Error

*Source: [src/app/api/uploads/pdf/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/uploads/pdf/route.ts)*

---

## /api/terminal/ws

### GET /api/terminal/ws

WebSocket endpoint for terminal sessions Handles real-time terminal communication

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| userId | string | No | userId query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/terminal/ws/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/terminal/ws/route.ts)*

---

## /api/projects/template

### GET /api/projects/template

Template-based project generation API endpoint Creates projects from pre-defined templates with customizations

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| category | string | No | category query parameter |
| complexity | string | No | complexity query parameter |
| language | string | No | language query parameter |
| framework | string | No | framework query parameter |
| search | string | No | search query parameter |

#### Responses

**401** - Unauthorized

**404** - Not Found

**500** - Internal Server Error

**500** - Internal Server Error

*Source: [src/app/api/projects/template/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/projects/template/route.ts)*

---

### POST /api/projects/template

Template-based project generation API endpoint Creates projects from pre-defined templates with customizations

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| category | string | No | category query parameter |
| complexity | string | No | complexity query parameter |
| language | string | No | language query parameter |
| framework | string | No | framework query parameter |
| search | string | No | search query parameter |

#### Responses

**401** - Unauthorized

**404** - Not Found

**500** - Internal Server Error

**500** - Internal Server Error

*Source: [src/app/api/projects/template/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/projects/template/route.ts)*

---

## /api/terminal/session

### GET /api/terminal/session

GET endpoint

**Authentication:** JWT Bearer token required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/terminal/session/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/terminal/session/route.ts)*

---

## /api/ollama/models

### GET /api/ollama/models

GET endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**503** - Response

**500** - Internal Server Error

**400** - Bad Request

**500** - Internal Server Error

**400** - Bad Request

*Source: [src/app/api/ollama/models/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ollama/models/route.ts)*

---

### POST /api/ollama/models

POST endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**503** - Response

**500** - Internal Server Error

**400** - Bad Request

**500** - Internal Server Error

**400** - Bad Request

*Source: [src/app/api/ollama/models/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ollama/models/route.ts)*

---

## /api/monitoring/overview/security

### GET /api/monitoring/overview/security

Security Monitoring API Endpoint Provides real-time security status and metrics

**Authentication:** JWT Bearer token required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| timestamp | string | Yes | timestamp field in request body |
| status | 'healthy' | 'warning' | 'critical' | Yes | status field in request body |
| checks | {
    authentication: boolean | Yes | checks field in request body |
| rateLimit | boolean | Yes | rateLimit field in request body |
| inputValidation | boolean | Yes | inputValidation field in request body |
| cors | boolean | Yes | cors field in request body |
| headers | boolean | Yes | headers field in request body |

#### Responses

**403** - Forbidden

**500** - Internal Server Error

**403** - Forbidden

**400** - Bad Request

**400** - Bad Request

**500** - Internal Server Error

*Source: [src/app/api/monitoring/overview/security/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/security/route.ts)*

---

### POST /api/monitoring/overview/security

Security Monitoring API Endpoint Provides real-time security status and metrics

**Authentication:** JWT Bearer token required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| timestamp | string | Yes | timestamp field in request body |
| status | 'healthy' | 'warning' | 'critical' | Yes | status field in request body |
| checks | {
    authentication: boolean | Yes | checks field in request body |
| rateLimit | boolean | Yes | rateLimit field in request body |
| inputValidation | boolean | Yes | inputValidation field in request body |
| cors | boolean | Yes | cors field in request body |
| headers | boolean | Yes | headers field in request body |

#### Responses

**403** - Forbidden

**500** - Internal Server Error

**403** - Forbidden

**400** - Bad Request

**400** - Bad Request

**500** - Internal Server Error

*Source: [src/app/api/monitoring/overview/security/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/security/route.ts)*

---

## /api/monitoring/overview/traces

### GET /api/monitoring/overview/traces

OpenTelemetry Traces API Endpoint Receives traces from client-side and forwards to monitoring systems

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/traces/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/traces/route.ts)*

---

### POST /api/monitoring/overview/traces

OpenTelemetry Traces API Endpoint Receives traces from client-side and forwards to monitoring systems

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/traces/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/traces/route.ts)*

---

## /api/monitoring/overview/pool-alerts

### GET /api/monitoring/overview/pool-alerts

Check pool status and generate alerts if thresholds are exceeded

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| warningThreshold | number | Yes | warningThreshold field in request body |
| criticalThreshold | number | Yes | criticalThreshold field in request body |
| minAvailableConnections | number | Yes | minAvailableConnections field in request body |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/monitoring/overview/pool-alerts/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/pool-alerts/route.ts)*

---

### POST /api/monitoring/overview/pool-alerts

Check pool status and generate alerts if thresholds are exceeded

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| warningThreshold | number | Yes | warningThreshold field in request body |
| criticalThreshold | number | Yes | criticalThreshold field in request body |
| minAvailableConnections | number | Yes | minAvailableConnections field in request body |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/monitoring/overview/pool-alerts/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/pool-alerts/route.ts)*

---

## /api/monitoring/overview/pool

### GET /api/monitoring/overview/pool

GET /api/monitoring/overview/pool Returns connection pool monitoring data including: - Metrics for all pools - Alerts (active or all based on query param) - Recommendations - Pool status

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| format | string | No | format query parameter |
| all_alerts | string | No | all_alerts query parameter |
| action | string | No | action query parameter |
| id | string | No | id query parameter |
| user | string | No | user query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/pool/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/pool/route.ts)*

---

### POST /api/monitoring/overview/pool

GET /api/monitoring/overview/pool Returns connection pool monitoring data including: - Metrics for all pools - Alerts (active or all based on query param) - Recommendations - Pool status

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| format | string | No | format query parameter |
| all_alerts | string | No | all_alerts query parameter |
| action | string | No | action query parameter |
| id | string | No | id query parameter |
| user | string | No | user query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/pool/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/pool/route.ts)*

---

## /api/monitoring/overview/rum

### GET /api/monitoring/overview/rum

Real User Monitoring (RUM) API Endpoint Provides RUM data collection and analysis

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/rum/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/rum/route.ts)*

---

### POST /api/monitoring/overview/rum

Real User Monitoring (RUM) API Endpoint Provides RUM data collection and analysis

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/rum/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/rum/route.ts)*

---

## /api/monitoring/overview/performance

### GET /api/monitoring/overview/performance

Performance Monitoring API Endpoint Provides performance metrics and optimization insights

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |
| timeframe | string | No | timeframe query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/performance/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/performance/route.ts)*

---

### POST /api/monitoring/overview/performance

Performance Monitoring API Endpoint Provides performance metrics and optimization insights

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |
| timeframe | string | No | timeframe query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/performance/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/performance/route.ts)*

---

## /api/monitoring/overview/metrics

### GET /api/monitoring/overview/metrics

Monitoring Metrics API Endpoint Provides detailed metrics and performance data

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/metrics/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/metrics/route.ts)*

---

### POST /api/monitoring/overview/metrics

Monitoring Metrics API Endpoint Provides detailed metrics and performance data

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/metrics/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/metrics/route.ts)*

---

## /api/monitoring/overview/otel-config

### GET /api/monitoring/overview/otel-config

OpenTelemetry Configuration API Endpoint Provides configuration information and health status for OpenTelemetry integration

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/otel-config/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/otel-config/route.ts)*

---

### POST /api/monitoring/overview/otel-config

OpenTelemetry Configuration API Endpoint Provides configuration information and health status for OpenTelemetry integration

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/otel-config/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/otel-config/route.ts)*

---

## /api/monitoring/overview/embeddings

### GET /api/monitoring/overview/embeddings

GET /api/monitoring/overview/embeddings Returns comprehensive embedding service metrics and usage data

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| format | string | No | format query parameter |
| detailed | string | No | detailed query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/monitoring/overview/embeddings/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/embeddings/route.ts)*

---

### POST /api/monitoring/overview/embeddings

GET /api/monitoring/overview/embeddings Returns comprehensive embedding service metrics and usage data

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| format | string | No | format query parameter |
| detailed | string | No | detailed query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/monitoring/overview/embeddings/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/embeddings/route.ts)*

---

### DELETE /api/monitoring/overview/embeddings

GET /api/monitoring/overview/embeddings Returns comprehensive embedding service metrics and usage data

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| format | string | No | format query parameter |
| detailed | string | No | detailed query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/monitoring/overview/embeddings/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/embeddings/route.ts)*

---

## /api/monitoring/overview/dashboard

### GET /api/monitoring/overview/dashboard

Monitoring Dashboard API Endpoint Provides comprehensive monitoring data and health status

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| timeframe | string | No | timeframe query parameter |
| logs | string | No | logs query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/overview/dashboard/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/dashboard/route.ts)*

---

## /api/monitoring/overview/cache

### GET /api/monitoring/overview/cache

Cache Monitoring and Management API Provides cache statistics, management operations, and health monitoring

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| operation | string | No | operation query parameter |
| tag | string | No | tag query parameter |

#### Responses

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/monitoring/overview/cache/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/cache/route.ts)*

---

### POST /api/monitoring/overview/cache

Cache Monitoring and Management API Provides cache statistics, management operations, and health monitoring

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| operation | string | No | operation query parameter |
| tag | string | No | tag query parameter |

#### Responses

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/monitoring/overview/cache/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/cache/route.ts)*

---

## /api/monitoring/overview/azure-embedding

### GET /api/monitoring/overview/azure-embedding

Azure Embedding Service Monitoring API Provides monitoring endpoints for Azure OpenAI embedding service and connection pool metrics

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| format | string | No | format query parameter |
| include | string | No | include query parameter |

#### Responses

**401** - Unauthorized

**403** - Forbidden

*Source: [src/app/api/monitoring/overview/azure-embedding/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/azure-embedding/route.ts)*

---

## /api/health/vector-metrics

### GET /api/health/vector-metrics

GET endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/health/vector-metrics/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/health/vector-metrics/route.ts)*

---

## /api/health/vector-db

### GET /api/health/vector-db

GET endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| format | string | No | format query parameter |

#### Responses

**500** - Internal Server Error

*Source: [src/app/api/health/vector-db/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/health/vector-db/route.ts)*

---

## /api/health/simple

### GET /api/health/simple

Simple health check endpoint for E2E testing Returns basic status without external dependencies

#### Responses

**200** - Successful response

*Source: [src/app/api/health/simple/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/health/simple/route.ts)*

---

## /api/health/db

### GET /api/health/db

Database health check endpoint Returns: - status: "ok" | "error" - message: String message about database status - details: Object with connection details - poolStatus: Connection pool information - latency: Connection latency in ms

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| format | string | No | format query parameter |
| verbose | string | No | verbose query parameter |
| metrics | string | No | metrics query parameter |

#### Responses

**500** - Internal Server Error

*Source: [src/app/api/health/db/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/health/db/route.ts)*

---

## /api/health/database

### GET /api/health/database

GET endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| detailed | string | No | detailed query parameter |
| quick | string | No | quick query parameter |
| timeout | string | No | timeout query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/health/database/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/health/database/route.ts)*

---

## /api/health/connection-pool

### GET /api/health/connection-pool

GET endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/health/connection-pool/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/health/connection-pool/route.ts)*

---

### POST /api/health/connection-pool

POST endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/health/connection-pool/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/health/connection-pool/route.ts)*

---

## /api/workspaces/:id

### GET /api/workspaces/:id

Individual Workspace Management API Handles specific workspace operations (get, delete, update)

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | id parameter |

#### Responses

**503** - Response

**404** - Not Found

**503** - Response

**404** - Not Found

*Source: [src/app/api/workspaces/[id]/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/workspaces/[id]/route.ts)*

---

### DELETE /api/workspaces/:id

Individual Workspace Management API Handles specific workspace operations (get, delete, update)

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | id parameter |

#### Responses

**503** - Response

**404** - Not Found

**503** - Response

**404** - Not Found

*Source: [src/app/api/workspaces/[id]/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/workspaces/[id]/route.ts)*

---

### PATCH /api/workspaces/:id

Individual Workspace Management API Handles specific workspace operations (get, delete, update)

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | id parameter |

#### Responses

**503** - Response

**404** - Not Found

**503** - Response

**404** - Not Found

*Source: [src/app/api/workspaces/[id]/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/workspaces/[id]/route.ts)*

---

## /api/files/sync

### GET /api/files/sync

Real-time File Synchronization API WebSocket-based real-time file synchronization for collaborative editing Implements secure file sync with conflict resolution Staff Engineer Implementation - Enterprise-grade real-time sync

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| userId | string | No | userId query parameter |
| type | string | Yes | type field in request body |
| payload | any | No | payload field in request body |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

**500** - Internal Server Error

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

**500** - Internal Server Error

**500** - Internal Server Error

*Source: [src/app/api/files/sync/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/files/sync/route.ts)*

---

### POST /api/files/sync

Real-time File Synchronization API WebSocket-based real-time file synchronization for collaborative editing Implements secure file sync with conflict resolution Staff Engineer Implementation - Enterprise-grade real-time sync

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| userId | string | No | userId query parameter |
| type | string | Yes | type field in request body |
| payload | any | No | payload field in request body |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

**500** - Internal Server Error

**401** - Unauthorized

**400** - Bad Request

**403** - Forbidden

**500** - Internal Server Error

**500** - Internal Server Error

*Source: [src/app/api/files/sync/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/files/sync/route.ts)*

---

## /api/docs/search

### GET /api/docs/search

GET endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| q | string | No | q query parameter |
| category | string | No | category query parameter |
| limit | string | No | limit query parameter |
| id | string | Yes | id field in request body |
| title | string | Yes | title field in request body |
| description | string | Yes | description field in request body |
| category | string | Yes | category field in request body |
| url | string | Yes | url field in request body |
| content | string | Yes | content field in request body |
| score | number | Yes | score field in request body |
| headings | Array<{
    level: number | Yes | headings field in request body |
| text | string | Yes | text field in request body |
| id | string | Yes | id field in request body |

#### Responses

**400** - Bad Request

**500** - Internal Server Error

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/docs/search/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/docs/search/route.ts)*

---

### POST /api/docs/search

POST endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| q | string | No | q query parameter |
| category | string | No | category query parameter |
| limit | string | No | limit query parameter |
| id | string | Yes | id field in request body |
| title | string | Yes | title field in request body |
| description | string | Yes | description field in request body |
| category | string | Yes | category field in request body |
| url | string | Yes | url field in request body |
| content | string | Yes | content field in request body |
| score | number | Yes | score field in request body |
| headings | Array<{
    level: number | Yes | headings field in request body |
| text | string | Yes | text field in request body |
| id | string | Yes | id field in request body |

#### Responses

**400** - Bad Request

**500** - Internal Server Error

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/docs/search/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/docs/search/route.ts)*

---

## /api/claude/session

### GET /api/claude/session

Claude Code Session API Route API endpoint for managing Claude Code CLI interactive sessions Handles terminal-based Claude Code session management Staff Engineer Implementation - Production-ready Claude CLI API

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/claude/session/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/claude/session/route.ts)*

---

### POST /api/claude/session

Claude Code Session API Route API endpoint for managing Claude Code CLI interactive sessions Handles terminal-based Claude Code session management Staff Engineer Implementation - Production-ready Claude CLI API

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/claude/session/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/claude/session/route.ts)*

---

## /api/claude/generate

### POST /api/claude/generate

Claude Code Generate API Route API endpoint for Claude Code CLI code generation Handles terminal-based Claude Code generation commands Staff Engineer Implementation - Production-ready Claude CLI API

**Authentication:** API key required

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/claude/generate/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/claude/generate/route.ts)*

---

## /api/claude/chat

### POST /api/claude/chat

Claude Code Chat API Route API endpoint for Claude Code CLI chat integration Handles terminal-based Claude Code commands through web interface Staff Engineer Implementation - Production-ready Claude CLI API

**Authentication:** API key required

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/claude/chat/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/claude/chat/route.ts)*

---

## /api/claude/analyze

### POST /api/claude/analyze

Claude Code Analyze API Route API endpoint for Claude Code CLI code analysis Handles terminal-based Claude Code analysis commands Staff Engineer Implementation - Production-ready Claude CLI API

**Authentication:** API key required

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/claude/analyze/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/claude/analyze/route.ts)*

---

## /api/chat/stream

### POST /api/chat/stream

POST endpoint

**Authentication:** JWT Bearer token required

#### Responses

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/chat/stream/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/chat/stream/route.ts)*

---

## /api/chat/mongodb-simple

### GET /api/chat/mongodb-simple

GET endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**404** - Not Found

**400** - Bad Request

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/chat/mongodb-simple/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/chat/mongodb-simple/route.ts)*

---

### POST /api/chat/mongodb-simple

POST endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**404** - Not Found

**400** - Bad Request

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/chat/mongodb-simple/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/chat/mongodb-simple/route.ts)*

---

## /api/chat/mongodb

### GET /api/chat/mongodb

GET endpoint

**Authentication:** JWT Bearer token required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**404** - Not Found

**400** - Bad Request

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/chat/mongodb/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/chat/mongodb/route.ts)*

---

### POST /api/chat/mongodb

POST endpoint

**Authentication:** JWT Bearer token required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**404** - Not Found

**400** - Bad Request

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/chat/mongodb/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/chat/mongodb/route.ts)*

---

## /api/auth/login-tracking

### GET /api/auth/login-tracking

GET endpoint

#### Responses

**400** - Bad Request

**500** - Internal Server Error

*Source: [src/app/api/auth/login-tracking/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/login-tracking/route.ts)*

---

### POST /api/auth/login-tracking

POST endpoint

#### Responses

**400** - Bad Request

**500** - Internal Server Error

*Source: [src/app/api/auth/login-tracking/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/login-tracking/route.ts)*

---

## /api/code-server/session

### GET /api/code-server/session

Code-server session management API Handles creation and management of code-server instances

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| id | string
  url: string
  status: 'starting' | 'ready' | 'error' | 'stopped'
  workspaceId: string
  userId: string
  containerId?: string
  createdAt: Date
  lastActivity: Date | Yes | id field in request body |

#### Responses

**401** - Unauthorized

**403** - Forbidden

**500** - Internal Server Error

**401** - Unauthorized

**500** - Internal Server Error

*Source: [src/app/api/code-server/session/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/code-server/session/route.ts)*

---

### POST /api/code-server/session

Code-server session management API Handles creation and management of code-server instances

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| id | string
  url: string
  status: 'starting' | 'ready' | 'error' | 'stopped'
  workspaceId: string
  userId: string
  containerId?: string
  createdAt: Date
  lastActivity: Date | Yes | id field in request body |

#### Responses

**401** - Unauthorized

**403** - Forbidden

**500** - Internal Server Error

**401** - Unauthorized

**500** - Internal Server Error

*Source: [src/app/api/code-server/session/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/code-server/session/route.ts)*

---

## /api/ai/web-search

### GET /api/ai/web-search

GET endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| q | string | No | q query parameter |
| query | string | No | query query parameter |
| maxResults | string | No | maxResults query parameter |
| includeContent | string | No | includeContent query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/web-search/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/web-search/route.ts)*

---

### POST /api/ai/web-search

POST endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| q | string | No | q query parameter |
| query | string | No | query query parameter |
| maxResults | string | No | maxResults query parameter |
| includeContent | string | No | includeContent query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/web-search/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/web-search/route.ts)*

---

## /api/ai/upload

### GET /api/ai/upload

GET endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |

#### Responses

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/ai/upload/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/upload/route.ts)*

---

### POST /api/ai/upload

POST endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |

#### Responses

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/ai/upload/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/upload/route.ts)*

---

## /api/ai/search

### GET /api/ai/search

Vector Search API for RAG functionality Provides semantic search across uploaded files

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |

#### Responses

**401** - Unauthorized

**404** - Not Found

**401** - Unauthorized

*Source: [src/app/api/ai/search/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/search/route.ts)*

---

### POST /api/ai/search

Vector Search API for RAG functionality Provides semantic search across uploaded files

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |

#### Responses

**401** - Unauthorized

**404** - Not Found

**401** - Unauthorized

*Source: [src/app/api/ai/search/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/search/route.ts)*

---

## /api/ai/provider-health

### GET /api/ai/provider-health

AI Provider Health Check API Endpoint Tests availability and latency of different AI providers

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**401** - Unauthorized

*Source: [src/app/api/ai/provider-health/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/provider-health/route.ts)*

---

### POST /api/ai/provider-health

AI Provider Health Check API Endpoint Tests availability and latency of different AI providers

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**401** - Unauthorized

*Source: [src/app/api/ai/provider-health/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/provider-health/route.ts)*

---

## /api/ai/model-selection

### GET /api/ai/model-selection

GET endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| provider | string | No | provider query parameter |
| details | string | No | details query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

*Source: [src/app/api/ai/model-selection/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/model-selection/route.ts)*

---

### POST /api/ai/model-selection

POST endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| provider | string | No | provider query parameter |
| details | string | No | details query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

*Source: [src/app/api/ai/model-selection/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/model-selection/route.ts)*

---

## /api/ai/management

### GET /api/ai/management

AI Model Management and Monitoring API Provides comprehensive AI model usage, cost tracking, and performance monitoring

**Authentication:** JWT Bearer token required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |
| timeframe | string | No | timeframe query parameter |

#### Responses

**401** - Unauthorized

**403** - Forbidden

**400** - Bad Request

**500** - Internal Server Error

**501** - Response

*Source: [src/app/api/ai/management/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/management/route.ts)*

---

### POST /api/ai/management

AI Model Management and Monitoring API Provides comprehensive AI model usage, cost tracking, and performance monitoring

**Authentication:** JWT Bearer token required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |
| timeframe | string | No | timeframe query parameter |

#### Responses

**401** - Unauthorized

**403** - Forbidden

**400** - Bad Request

**500** - Internal Server Error

**501** - Response

*Source: [src/app/api/ai/management/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/management/route.ts)*

---

## /api/ai/huggingface-init

### GET /api/ai/huggingface-init

GET endpoint

**Authentication:** API key required

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/huggingface-init/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/huggingface-init/route.ts)*

---

### POST /api/ai/huggingface-init

POST endpoint

**Authentication:** API key required

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/huggingface-init/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/huggingface-init/route.ts)*

---

## /api/ai/huggingface-chat

### GET /api/ai/huggingface-chat

GET endpoint

**Authentication:** API key required

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/huggingface-chat/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/huggingface-chat/route.ts)*

---

### POST /api/ai/huggingface-chat

POST endpoint

**Authentication:** API key required

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/huggingface-chat/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/huggingface-chat/route.ts)*

---

## /api/ai/litellm

### GET /api/ai/litellm

Health check and system status

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/ai/litellm/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/litellm/route.ts)*

---

### POST /api/ai/litellm

Chat completions and embeddings

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/ai/litellm/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/litellm/route.ts)*

---

### PUT /api/ai/litellm

Update configuration

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**401** - Unauthorized

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/ai/litellm/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/litellm/route.ts)*

---

## /api/ai/generate-project

### GET /api/ai/generate-project

AI Project Generation API Route Core API endpoint for Lovable.ai clone functionality

**Authentication:** API key required

#### Responses

**500** - Internal Server Error

**401** - Unauthorized

**429** - Response

**408** - Response

*Source: [src/app/api/ai/generate-project/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/generate-project/route.ts)*

---

### POST /api/ai/generate-project

AI Project Generation API Route Core API endpoint for Lovable.ai clone functionality

**Authentication:** API key required

#### Responses

**500** - Internal Server Error

**401** - Unauthorized

**429** - Response

**408** - Response

*Source: [src/app/api/ai/generate-project/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/generate-project/route.ts)*

---

## /api/ai/function-call

### GET /api/ai/function-call

GET endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/function-call/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/function-call/route.ts)*

---

### POST /api/ai/function-call

POST endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/function-call/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/function-call/route.ts)*

---

## /api/ai/chat

### POST /api/ai/chat

AI Chat API endpoint for VibeCode WebGUI Handles AI-powered assistance with optional RAG context and Datadog observability

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/chat/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/chat/route.ts)*

---

## /api/gradio/run

### POST /api/gradio/run

POST endpoint

#### Responses

**400** - Bad Request

*Source: [src/app/api/gradio/run/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/gradio/run/route.ts)*

---

## /api/workspace/:id/init-goose

### POST /api/workspace/:id/init-goose

POST endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | id parameter |

#### Responses

**500** - Internal Server Error

*Source: [src/app/api/workspace/[id]/init-goose/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/workspace/[id]/init-goose/route.ts)*

---

## /api/health/database/metrics

### GET /api/health/database/metrics

GET endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/health/database/metrics/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/health/database/metrics/route.ts)*

---

## /api/auth/saml/sso

### GET /api/auth/saml/sso

SAML SSO Authentication API Handles SAML authentication requests and responses

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| provider | string | No | provider query parameter |

#### Responses

**404** - Not Found

**404** - Not Found

*Source: [src/app/api/auth/saml/sso/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/saml/sso/route.ts)*

---

### POST /api/auth/saml/sso

SAML SSO Authentication API Handles SAML authentication requests and responses

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| provider | string | No | provider query parameter |

#### Responses

**404** - Not Found

**404** - Not Found

*Source: [src/app/api/auth/saml/sso/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/saml/sso/route.ts)*

---

### PUT /api/auth/saml/sso

SAML SSO Authentication API Handles SAML authentication requests and responses

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| provider | string | No | provider query parameter |

#### Responses

**404** - Not Found

**404** - Not Found

*Source: [src/app/api/auth/saml/sso/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/saml/sso/route.ts)*

---

## /api/auth/saml/metadata

### GET /api/auth/saml/metadata

SAML Metadata API Provides SAML service provider metadata for identity provider configuration

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| provider | string | No | provider query parameter |

#### Responses

**404** - Not Found

*Source: [src/app/api/auth/saml/metadata/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/saml/metadata/route.ts)*

---

## /api/auth/mfa/verify

### GET /api/auth/mfa/verify

MFA Verification API Handles multi-factor authentication challenges and verification

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| deviceId | string | No | deviceId query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**404** - Not Found

*Source: [src/app/api/auth/mfa/verify/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/mfa/verify/route.ts)*

---

### POST /api/auth/mfa/verify

MFA Verification API Handles multi-factor authentication challenges and verification

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| deviceId | string | No | deviceId query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**404** - Not Found

*Source: [src/app/api/auth/mfa/verify/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/mfa/verify/route.ts)*

---

### PUT /api/auth/mfa/verify

MFA Verification API Handles multi-factor authentication challenges and verification

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| deviceId | string | No | deviceId query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**404** - Not Found

*Source: [src/app/api/auth/mfa/verify/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/mfa/verify/route.ts)*

---

### DELETE /api/auth/mfa/verify

MFA Verification API Handles multi-factor authentication challenges and verification

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| deviceId | string | No | deviceId query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**401** - Unauthorized

**401** - Unauthorized

**400** - Bad Request

**404** - Not Found

*Source: [src/app/api/auth/mfa/verify/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/mfa/verify/route.ts)*

---

## /api/auth/mfa/setup

### POST /api/auth/mfa/setup

MFA Setup API Handles multi-factor authentication device setup

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/auth/mfa/setup/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/mfa/setup/route.ts)*

---

### PUT /api/auth/mfa/setup

MFA Setup API Handles multi-factor authentication device setup

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/auth/mfa/setup/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/mfa/setup/route.ts)*

---

## /api/code-server/session/:sessionId

### GET /api/code-server/session/:sessionId

Individual code-server session management API Handles session status, updates, and cleanup

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | Yes | sessionId parameter |
| id | string
  url: string
  status: 'starting' | 'ready' | 'error' | 'stopped'
  workspaceId: string
  userId: string
  containerId?: string
  createdAt: Date
  lastActivity: Date | Yes | id field in request body |

#### Responses

**401** - Unauthorized

**404** - Not Found

**403** - Forbidden

**500** - Internal Server Error

**401** - Unauthorized

**404** - Not Found

**403** - Forbidden

**500** - Internal Server Error

**401** - Unauthorized

**404** - Not Found

**403** - Forbidden

**500** - Internal Server Error

*Source: [src/app/api/code-server/session/[sessionId]/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/code-server/session/[sessionId]/route.ts)*

---

### DELETE /api/code-server/session/:sessionId

Individual code-server session management API Handles session status, updates, and cleanup

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | Yes | sessionId parameter |
| id | string
  url: string
  status: 'starting' | 'ready' | 'error' | 'stopped'
  workspaceId: string
  userId: string
  containerId?: string
  createdAt: Date
  lastActivity: Date | Yes | id field in request body |

#### Responses

**401** - Unauthorized

**404** - Not Found

**403** - Forbidden

**500** - Internal Server Error

**401** - Unauthorized

**404** - Not Found

**403** - Forbidden

**500** - Internal Server Error

**401** - Unauthorized

**404** - Not Found

**403** - Forbidden

**500** - Internal Server Error

*Source: [src/app/api/code-server/session/[sessionId]/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/code-server/session/[sessionId]/route.ts)*

---

### PATCH /api/code-server/session/:sessionId

Individual code-server session management API Handles session status, updates, and cleanup

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | Yes | sessionId parameter |
| id | string
  url: string
  status: 'starting' | 'ready' | 'error' | 'stopped'
  workspaceId: string
  userId: string
  containerId?: string
  createdAt: Date
  lastActivity: Date | Yes | id field in request body |

#### Responses

**401** - Unauthorized

**404** - Not Found

**403** - Forbidden

**500** - Internal Server Error

**401** - Unauthorized

**404** - Not Found

**403** - Forbidden

**500** - Internal Server Error

**401** - Unauthorized

**404** - Not Found

**403** - Forbidden

**500** - Internal Server Error

*Source: [src/app/api/code-server/session/[sessionId]/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/code-server/session/[sessionId]/route.ts)*

---

## /api/ai/conversations/:workspaceId

### GET /api/ai/conversations/:workspaceId

GET endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | Yes | workspaceId parameter |
| id | string
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: {
    model?: string
    context?: string[]
    tokens?: number
    responseTime?: number | Yes | id field in request body |

#### Responses

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/ai/conversations/[workspaceId]/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/conversations/[workspaceId]/route.ts)*

---

### POST /api/ai/conversations/:workspaceId

POST endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | Yes | workspaceId parameter |
| id | string
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: {
    model?: string
    context?: string[]
    tokens?: number
    responseTime?: number | Yes | id field in request body |

#### Responses

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/ai/conversations/[workspaceId]/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/conversations/[workspaceId]/route.ts)*

---

### DELETE /api/ai/conversations/:workspaceId

DELETE endpoint

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | Yes | workspaceId parameter |
| id | string
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: {
    model?: string
    context?: string[]
    tokens?: number
    responseTime?: number | Yes | id field in request body |

#### Responses

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/ai/conversations/[workspaceId]/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/conversations/[workspaceId]/route.ts)*

---

## /api/ai/chat/unified

### POST /api/ai/chat/unified

POST endpoint

#### Responses

**401** - Unauthorized

*Source: [src/app/api/ai/chat/unified/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/chat/unified/route.ts)*

---

## /api/ai/chat/stream

### POST /api/ai/chat/stream

POST endpoint

**Authentication:** API key required

#### Responses

**401** - Unauthorized

*Source: [src/app/api/ai/chat/stream/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/chat/stream/route.ts)*

---

## /api/ai/chat/enhanced

### POST /api/ai/chat/enhanced

POST endpoint

**Authentication:** API key required

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/chat/enhanced/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/chat/enhanced/route.ts)*

---

## /api/monitoring/overview/connection-pool/dashboard

### GET /api/monitoring/overview/connection-pool/dashboard

Connection Pool Monitoring Dashboard API Provides real-time connection pool metrics, alerts, and capacity planning

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| pool | string | No | pool query parameter |
| history | string | No | history query parameter |
| limit | string | No | limit query parameter |

#### Responses

**404** - Not Found

**400** - Bad Request

*Source: [src/app/api/monitoring/overview/connection-pool/dashboard/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/connection-pool/dashboard/route.ts)*

---

### POST /api/monitoring/overview/connection-pool/dashboard

Connection Pool Monitoring Dashboard API Provides real-time connection pool metrics, alerts, and capacity planning

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| pool | string | No | pool query parameter |
| history | string | No | history query parameter |
| limit | string | No | limit query parameter |

#### Responses

**404** - Not Found

**400** - Bad Request

*Source: [src/app/api/monitoring/overview/connection-pool/dashboard/route.ts](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/connection-pool/dashboard/route.ts)*

---

