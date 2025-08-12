# API Documentation

*Generated on 2025-08-12T16:10:07.211Z*

This documentation is automatically generated from the codebase.

## Table of Contents

- [/api/templates](#-api-templates)
- [/api/mongodb-test](#-api-mongodb-test)
- [/api/health](#-api-health)
- [/api/files](#-api-files)
- [/api/experiments](#-api-experiments)
- [/api/terminal/ws](#-api-terminal-ws)
- [/api/terminal/session](#-api-terminal-session)
- [/api/projects/template](#-api-projects-template)
- [/api/ollama/models](#-api-ollama-models)
- [/api/monitoring/traces](#-api-monitoring-traces)
- [/api/monitoring/security](#-api-monitoring-security)
- [/api/monitoring/performance](#-api-monitoring-performance)
- [/api/monitoring/rum](#-api-monitoring-rum)
- [/api/monitoring/otel-config](#-api-monitoring-otel-config)
- [/api/monitoring/metrics](#-api-monitoring-metrics)
- [/api/monitoring/dashboard](#-api-monitoring-dashboard)
- [/api/health/simple](#-api-health-simple)
- [/api/gradio/run](#-api-gradio-run)
- [/api/files/sync](#-api-files-sync)
- [/api/chat/stream](#-api-chat-stream)
- [/api/chat/mongodb-simple](#-api-chat-mongodb-simple)
- [/api/chat/mongodb](#-api-chat-mongodb)
- [/api/auth/login-tracking](#-api-auth-login-tracking)
- [/api/code-server/session](#-api-code-server-session)
- [/api/claude/session](#-api-claude-session)
- [/api/claude/generate](#-api-claude-generate)
- [/api/claude/chat](#-api-claude-chat)
- [/api/claude/analyze](#-api-claude-analyze)
- [/api/ai-cli-tools/install](#-api-ai-cli-tools-install)
- [/api/ai/web-search](#-api-ai-web-search)
- [/api/ai/upload](#-api-ai-upload)
- [/api/ai/search](#-api-ai-search)
- [/api/ai/provider-health](#-api-ai-provider-health)
- [/api/ai/management](#-api-ai-management)
- [/api/ai/huggingface-init](#-api-ai-huggingface-init)
- [/api/ai/model-selection](#-api-ai-model-selection)
- [/api/ai/litellm](#-api-ai-litellm)
- [/api/ai/huggingface-chat](#-api-ai-huggingface-chat)
- [/api/ai/generate-project](#-api-ai-generate-project)
- [/api/ai/function-call](#-api-ai-function-call)
- [/api/ai/chat](#-api-ai-chat)
- [/api/workspace/:id/init-goose](#-api-workspace--id-init-goose)
- [/api/code-server/session/:sessionId](#-api-code-server-session--sessionid)
- [/api/ai/conversations/:workspaceId](#-api-ai-conversations--workspaceid)
- [/api/ai/chat/unified](#-api-ai-chat-unified)
- [/api/ai/chat/stream](#-api-ai-chat-stream)
- [/api/ai/chat/enhanced](#-api-ai-chat-enhanced)

## /api/templates

### GET /api/templates

Templates API - Real template management Provides actual project templates for quick project creation

#### Responses

**500** - Internal Server Error

**501** - Response

*Source: [src/app/api/templates/route.ts](../src/app/api/templates/route.ts)*

---

### POST /api/templates

Templates API - Real template management Provides actual project templates for quick project creation

#### Responses

**500** - Internal Server Error

**501** - Response

*Source: [src/app/api/templates/route.ts](../src/app/api/templates/route.ts)*

---

## /api/mongodb-test

### GET /api/mongodb-test

GET endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/mongodb-test/route.ts](../src/app/api/mongodb-test/route.ts)*

---

## /api/health

### GET /api/health

Health Check API Endpoint Provides application health status for monitoring and deployment

#### Responses

**503** - Response

**200** - Success

*Source: [src/app/api/health/route.ts](../src/app/api/health/route.ts)*

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

*Source: [src/app/api/files/route.ts](../src/app/api/files/route.ts)*

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

*Source: [src/app/api/files/route.ts](../src/app/api/files/route.ts)*

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

*Source: [src/app/api/files/route.ts](../src/app/api/files/route.ts)*

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

*Source: [src/app/api/files/route.ts](../src/app/api/files/route.ts)*

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

*Source: [src/app/api/experiments/route.ts](../src/app/api/experiments/route.ts)*

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

*Source: [src/app/api/experiments/route.ts](../src/app/api/experiments/route.ts)*

---

## /api/terminal/ws

### GET /api/terminal/ws

Enhanced Terminal WebSocket API Handles terminal sessions with AI integration and Claude Code CLI support Replaces simple terminal backend with AI-powered terminal

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| workspaceId | string | No | workspaceId query parameter |
| userId | string | No | userId query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/terminal/ws/route.ts](../src/app/api/terminal/ws/route.ts)*

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

*Source: [src/app/api/terminal/session/route.ts](../src/app/api/terminal/session/route.ts)*

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

*Source: [src/app/api/projects/template/route.ts](../src/app/api/projects/template/route.ts)*

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

*Source: [src/app/api/projects/template/route.ts](../src/app/api/projects/template/route.ts)*

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

*Source: [src/app/api/ollama/models/route.ts](../src/app/api/ollama/models/route.ts)*

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

*Source: [src/app/api/ollama/models/route.ts](../src/app/api/ollama/models/route.ts)*

---

## /api/monitoring/traces

### GET /api/monitoring/traces

OpenTelemetry Traces API Endpoint Receives traces from client-side and forwards to monitoring systems

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/traces/route.ts](../src/app/api/monitoring/traces/route.ts)*

---

### POST /api/monitoring/traces

OpenTelemetry Traces API Endpoint Receives traces from client-side and forwards to monitoring systems

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/traces/route.ts](../src/app/api/monitoring/traces/route.ts)*

---

## /api/monitoring/security

### GET /api/monitoring/security

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

*Source: [src/app/api/monitoring/security/route.ts](../src/app/api/monitoring/security/route.ts)*

---

### POST /api/monitoring/security

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

*Source: [src/app/api/monitoring/security/route.ts](../src/app/api/monitoring/security/route.ts)*

---

## /api/monitoring/performance

### GET /api/monitoring/performance

Performance Monitoring API Endpoint Provides performance metrics, reports, and test result submission

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |
| timeframe | string | No | timeframe query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/performance/route.ts](../src/app/api/monitoring/performance/route.ts)*

---

### POST /api/monitoring/performance

Performance Monitoring API Endpoint Provides performance metrics, reports, and test result submission

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |
| timeframe | string | No | timeframe query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/performance/route.ts](../src/app/api/monitoring/performance/route.ts)*

---

## /api/monitoring/rum

### GET /api/monitoring/rum

RUM Monitoring API Endpoint Provides RUM configuration, health status, and session management

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/rum/route.ts](../src/app/api/monitoring/rum/route.ts)*

---

### POST /api/monitoring/rum

RUM Monitoring API Endpoint Provides RUM configuration, health status, and session management

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/rum/route.ts](../src/app/api/monitoring/rum/route.ts)*

---

## /api/monitoring/otel-config

### GET /api/monitoring/otel-config

OpenTelemetry Configuration API Endpoint Provides configuration information and health status for OpenTelemetry integration

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/otel-config/route.ts](../src/app/api/monitoring/otel-config/route.ts)*

---

### POST /api/monitoring/otel-config

OpenTelemetry Configuration API Endpoint Provides configuration information and health status for OpenTelemetry integration

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | No | action query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/otel-config/route.ts](../src/app/api/monitoring/otel-config/route.ts)*

---

## /api/monitoring/metrics

### GET /api/monitoring/metrics

API endpoint for submitting custom metrics Allows frontend and other services to submit metrics to Datadog

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| config | string | No | config query parameter |
| type | 'counter' | 'gauge' | 'histogram' | 'event'
  name: string
  value?: number
  tags?: string[]
  metadata?: Record<string, any> | Yes | type field in request body |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/metrics/route.ts](../src/app/api/monitoring/metrics/route.ts)*

---

### POST /api/monitoring/metrics

API endpoint for submitting custom metrics Allows frontend and other services to submit metrics to Datadog

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| config | string | No | config query parameter |
| type | 'counter' | 'gauge' | 'histogram' | 'event'
  name: string
  value?: number
  tags?: string[]
  metadata?: Record<string, any> | Yes | type field in request body |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/metrics/route.ts](../src/app/api/monitoring/metrics/route.ts)*

---

## /api/monitoring/dashboard

### GET /api/monitoring/dashboard

API endpoint for monitoring dashboard data Provides real-time metrics and health information

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| timeframe | string | No | timeframe query parameter |
| logs | string | No | logs query parameter |

#### Responses

**200** - Successful response

*Source: [src/app/api/monitoring/dashboard/route.ts](../src/app/api/monitoring/dashboard/route.ts)*

---

## /api/health/simple

### GET /api/health/simple

GET endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/health/simple/route.ts](../src/app/api/health/simple/route.ts)*

---

## /api/gradio/run

### POST /api/gradio/run

POST endpoint

#### Responses

**400** - Bad Request

*Source: [src/app/api/gradio/run/route.ts](../src/app/api/gradio/run/route.ts)*

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

*Source: [src/app/api/files/sync/route.ts](../src/app/api/files/sync/route.ts)*

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

*Source: [src/app/api/files/sync/route.ts](../src/app/api/files/sync/route.ts)*

---

## /api/chat/stream

### POST /api/chat/stream

POST endpoint

**Authentication:** JWT Bearer token required

#### Responses

**401** - Unauthorized

**400** - Bad Request

*Source: [src/app/api/chat/stream/route.ts](../src/app/api/chat/stream/route.ts)*

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

*Source: [src/app/api/chat/mongodb-simple/route.ts](../src/app/api/chat/mongodb-simple/route.ts)*

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

*Source: [src/app/api/chat/mongodb-simple/route.ts](../src/app/api/chat/mongodb-simple/route.ts)*

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

*Source: [src/app/api/chat/mongodb/route.ts](../src/app/api/chat/mongodb/route.ts)*

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

*Source: [src/app/api/chat/mongodb/route.ts](../src/app/api/chat/mongodb/route.ts)*

---

## /api/auth/login-tracking

### GET /api/auth/login-tracking

GET endpoint

#### Responses

**400** - Bad Request

**500** - Internal Server Error

*Source: [src/app/api/auth/login-tracking/route.ts](../src/app/api/auth/login-tracking/route.ts)*

---

### POST /api/auth/login-tracking

POST endpoint

#### Responses

**400** - Bad Request

**500** - Internal Server Error

*Source: [src/app/api/auth/login-tracking/route.ts](../src/app/api/auth/login-tracking/route.ts)*

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

*Source: [src/app/api/code-server/session/route.ts](../src/app/api/code-server/session/route.ts)*

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

*Source: [src/app/api/code-server/session/route.ts](../src/app/api/code-server/session/route.ts)*

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

*Source: [src/app/api/claude/session/route.ts](../src/app/api/claude/session/route.ts)*

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

*Source: [src/app/api/claude/session/route.ts](../src/app/api/claude/session/route.ts)*

---

## /api/claude/generate

### POST /api/claude/generate

Claude Code Generate API Route API endpoint for Claude Code CLI code generation Handles terminal-based Claude Code generation commands Staff Engineer Implementation - Production-ready Claude CLI API

**Authentication:** API key required

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/claude/generate/route.ts](../src/app/api/claude/generate/route.ts)*

---

## /api/claude/chat

### POST /api/claude/chat

Claude Code Chat API Route API endpoint for Claude Code CLI chat integration Handles terminal-based Claude Code commands through web interface Staff Engineer Implementation - Production-ready Claude CLI API

**Authentication:** API key required

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/claude/chat/route.ts](../src/app/api/claude/chat/route.ts)*

---

## /api/claude/analyze

### POST /api/claude/analyze

Claude Code Analyze API Route API endpoint for Claude Code CLI code analysis Handles terminal-based Claude Code analysis commands Staff Engineer Implementation - Production-ready Claude CLI API

**Authentication:** API key required

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

*Source: [src/app/api/claude/analyze/route.ts](../src/app/api/claude/analyze/route.ts)*

---

## /api/ai-cli-tools/install

### GET /api/ai-cli-tools/install

AI CLI Tools Installation API Handles installation of various AI coding CLI tools

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| toolId | string | No | toolId query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**409** - Response

**401** - Unauthorized

**404** - Not Found

**500** - Internal Server Error

*Source: [src/app/api/ai-cli-tools/install/route.ts](../src/app/api/ai-cli-tools/install/route.ts)*

---

### POST /api/ai-cli-tools/install

AI CLI Tools Installation API Handles installation of various AI coding CLI tools

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| toolId | string | No | toolId query parameter |

#### Responses

**401** - Unauthorized

**400** - Bad Request

**409** - Response

**401** - Unauthorized

**404** - Not Found

**500** - Internal Server Error

*Source: [src/app/api/ai-cli-tools/install/route.ts](../src/app/api/ai-cli-tools/install/route.ts)*

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

*Source: [src/app/api/ai/web-search/route.ts](../src/app/api/ai/web-search/route.ts)*

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

*Source: [src/app/api/ai/web-search/route.ts](../src/app/api/ai/web-search/route.ts)*

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

*Source: [src/app/api/ai/upload/route.ts](../src/app/api/ai/upload/route.ts)*

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

*Source: [src/app/api/ai/upload/route.ts](../src/app/api/ai/upload/route.ts)*

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

*Source: [src/app/api/ai/search/route.ts](../src/app/api/ai/search/route.ts)*

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

*Source: [src/app/api/ai/search/route.ts](../src/app/api/ai/search/route.ts)*

---

## /api/ai/provider-health

### GET /api/ai/provider-health

AI Provider Health Check API Endpoint Tests availability and latency of different AI providers

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**401** - Unauthorized

*Source: [src/app/api/ai/provider-health/route.ts](../src/app/api/ai/provider-health/route.ts)*

---

### POST /api/ai/provider-health

AI Provider Health Check API Endpoint Tests availability and latency of different AI providers

#### Responses

**401** - Unauthorized

**400** - Bad Request

**400** - Bad Request

**401** - Unauthorized

*Source: [src/app/api/ai/provider-health/route.ts](../src/app/api/ai/provider-health/route.ts)*

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

*Source: [src/app/api/ai/management/route.ts](../src/app/api/ai/management/route.ts)*

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

*Source: [src/app/api/ai/management/route.ts](../src/app/api/ai/management/route.ts)*

---

## /api/ai/huggingface-init

### GET /api/ai/huggingface-init

GET endpoint

**Authentication:** API key required

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/huggingface-init/route.ts](../src/app/api/ai/huggingface-init/route.ts)*

---

### POST /api/ai/huggingface-init

POST endpoint

**Authentication:** API key required

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/huggingface-init/route.ts](../src/app/api/ai/huggingface-init/route.ts)*

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

*Source: [src/app/api/ai/model-selection/route.ts](../src/app/api/ai/model-selection/route.ts)*

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

*Source: [src/app/api/ai/model-selection/route.ts](../src/app/api/ai/model-selection/route.ts)*

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

*Source: [src/app/api/ai/litellm/route.ts](../src/app/api/ai/litellm/route.ts)*

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

*Source: [src/app/api/ai/litellm/route.ts](../src/app/api/ai/litellm/route.ts)*

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

*Source: [src/app/api/ai/litellm/route.ts](../src/app/api/ai/litellm/route.ts)*

---

## /api/ai/huggingface-chat

### GET /api/ai/huggingface-chat

GET endpoint

**Authentication:** API key required

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/huggingface-chat/route.ts](../src/app/api/ai/huggingface-chat/route.ts)*

---

### POST /api/ai/huggingface-chat

POST endpoint

**Authentication:** API key required

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/huggingface-chat/route.ts](../src/app/api/ai/huggingface-chat/route.ts)*

---

## /api/ai/generate-project

### POST /api/ai/generate-project

AI Project Generation API Generates complete projects from AI prompts and creates live workspaces This is the core integration that makes VibeCode function like Lovable/Replit/Bolt.diy

**Authentication:** API key required

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| path | string
  content: string
  type: 'file' | 'directory' | Yes | path field in request body |

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/generate-project/route.ts](../src/app/api/ai/generate-project/route.ts)*

---

## /api/ai/function-call

### GET /api/ai/function-call

GET endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/function-call/route.ts](../src/app/api/ai/function-call/route.ts)*

---

### POST /api/ai/function-call

POST endpoint

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/function-call/route.ts](../src/app/api/ai/function-call/route.ts)*

---

## /api/ai/chat

### GET /api/ai/chat

AI Chat API endpoint for VibeCode WebGUI Handles AI-powered code assistance using Vercel AI SDK

#### Responses

**400** - Bad Request

*Source: [src/app/api/ai/chat/route.ts](../src/app/api/ai/chat/route.ts)*

---

### POST /api/ai/chat

AI Chat API endpoint for VibeCode WebGUI Handles AI-powered code assistance using Vercel AI SDK

#### Responses

**400** - Bad Request

*Source: [src/app/api/ai/chat/route.ts](../src/app/api/ai/chat/route.ts)*

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

*Source: [src/app/api/workspace/[id]/init-goose/route.ts](../src/app/api/workspace/[id]/init-goose/route.ts)*

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

*Source: [src/app/api/code-server/session/[sessionId]/route.ts](../src/app/api/code-server/session/[sessionId]/route.ts)*

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

*Source: [src/app/api/code-server/session/[sessionId]/route.ts](../src/app/api/code-server/session/[sessionId]/route.ts)*

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

*Source: [src/app/api/code-server/session/[sessionId]/route.ts](../src/app/api/code-server/session/[sessionId]/route.ts)*

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

*Source: [src/app/api/ai/conversations/[workspaceId]/route.ts](../src/app/api/ai/conversations/[workspaceId]/route.ts)*

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

*Source: [src/app/api/ai/conversations/[workspaceId]/route.ts](../src/app/api/ai/conversations/[workspaceId]/route.ts)*

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

*Source: [src/app/api/ai/conversations/[workspaceId]/route.ts](../src/app/api/ai/conversations/[workspaceId]/route.ts)*

---

## /api/ai/chat/unified

### POST /api/ai/chat/unified

POST endpoint

#### Responses

**401** - Unauthorized

*Source: [src/app/api/ai/chat/unified/route.ts](../src/app/api/ai/chat/unified/route.ts)*

---

## /api/ai/chat/stream

### POST /api/ai/chat/stream

POST endpoint

**Authentication:** API key required

#### Responses

**401** - Unauthorized

*Source: [src/app/api/ai/chat/stream/route.ts](../src/app/api/ai/chat/stream/route.ts)*

---

## /api/ai/chat/enhanced

### POST /api/ai/chat/enhanced

POST endpoint

**Authentication:** API key required

#### Responses

**200** - Successful response

*Source: [src/app/api/ai/chat/enhanced/route.ts](../src/app/api/ai/chat/enhanced/route.ts)*

---

