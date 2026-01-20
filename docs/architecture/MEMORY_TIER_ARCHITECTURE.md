# Agent Memory Tier Architecture

**Issue:** #897
**Epic:** #884 (Multi-Agent Memory Infrastructure)
**Date:** 2026-01-20
**Status:** Design Complete

## Executive Summary

This document defines the memory tier architecture for multi-agent state management. The design addresses the critical gap identified in #884: agents that *plan, execute, update beliefs, and come back tomorrow* need durable state infrastructure, not just "more context."

**Key Design Decisions:**
- Three-tier memory system: Ephemeral, Working, Long-term
- Leverage existing Gas Town bead system as state backbone
- Integrate with existing pgvector infrastructure for semantic retrieval
- Use Valkey for TTL-based working memory
- Memory validation to prevent error amplification (target: <5x vs current 17x)

## Memory Tiers

### Tier 1: Ephemeral Memory (Session-Scoped)

**Purpose:** Current conversation context and temporary work state.

| Property | Value |
|----------|-------|
| Lifetime | Session duration |
| Storage | tmux session / process memory |
| Latency | <1ms |
| Persistence | None (lost on session end) |
| Capacity | 128KB per agent |

**Contents:**
- Current conversation messages
- Active tool call context
- Temporary file buffers
- In-flight request state

**Implementation:**
```typescript
interface EphemeralMemory {
  sessionId: string;
  agentId: string;
  context: Map<string, any>;
  messages: Message[];
  toolState: Map<string, ToolCallState>;
  createdAt: Date;
}
```

### Tier 2: Working Memory (Days-Scoped)

**Purpose:** Active task context and recent learnings that should persist across sessions but expire after inactivity.

| Property | Value |
|----------|-------|
| Lifetime | 7 days default (configurable) |
| Storage | Valkey with TTL |
| Latency | <10ms |
| Persistence | TTL-based expiration |
| Capacity | 1MB per agent per task |

**Contents:**
- Active bead/task context
- Recent code patterns learned
- Session handoff state
- Temporary beliefs (pending validation)
- Cross-session conversation continuity

**Implementation:**
```typescript
interface WorkingMemory {
  id: string;
  agentId: string;
  beadId?: string;           // Gas Town bead reference
  tier: 'working';
  content: string;
  contentType: WorkingMemoryType;
  metadata: {
    source: string;
    confidence: number;      // 0-1, for belief validation
    validated: boolean;
    lastAccessedAt: Date;
    accessCount: number;
  };
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

type WorkingMemoryType =
  | 'task_context'
  | 'learned_pattern'
  | 'session_handoff'
  | 'pending_belief'
  | 'conversation_summary';
```

### Tier 3: Long-term Memory (Persistent)

**Purpose:** Durable knowledge that should survive indefinitely: validated patterns, user preferences, project knowledge.

| Property | Value |
|----------|-------|
| Lifetime | Permanent (with explicit deletion) |
| Storage | PostgreSQL + pgvector |
| Latency | <100ms for semantic search |
| Persistence | Durable with backups |
| Capacity | Unbounded (with quotas) |

**Contents:**
- Validated code patterns
- User preferences and working style
- Project architecture knowledge
- Codebase conventions
- Successful task completions (for learning)

**Implementation:**
```typescript
interface LongTermMemory {
  id: string;
  agentId: string;
  projectId?: string;
  workspaceId?: string;
  tier: 'long_term';
  content: string;
  contentType: LongTermMemoryType;
  embedding?: number[];      // vector(1536) for semantic search
  metadata: {
    source: string;
    confidence: number;
    validatedAt: Date;
    validatedBy?: string;    // Agent or human
    usageCount: number;
    lastUsedAt: Date;
    tags: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

type LongTermMemoryType =
  | 'code_pattern'
  | 'user_preference'
  | 'project_knowledge'
  | 'codebase_convention'
  | 'task_completion';
```

## Storage Backend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Process                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐                                           │
│  │ Ephemeral Memory │  In-process Map<string, any>              │
│  │ (Session-scoped) │  Lost on process exit                     │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           │ Session handoff (on checkpoint/exit)                │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │  Working Memory  │  Valkey (Redis-compatible)                │
│  │   (Days-scoped)  │  TTL: 7 days default                      │
│  │                  │  Keys: agent:{agentId}:working:{id}       │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           │ Promotion (after validation)                        │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Long-term Memory │  PostgreSQL + pgvector                    │
│  │   (Persistent)   │  Table: agent_memory                      │
│  │                  │  HNSW index for semantic search           │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Schema Definitions

### PostgreSQL Schema (Long-term Memory)

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Core agent memory table
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    project_id TEXT,
    workspace_id TEXT,
    bead_id TEXT,                    -- Gas Town bead reference

    -- Content
    tier TEXT NOT NULL DEFAULT 'long_term',
    content TEXT NOT NULL,
    content_type TEXT NOT NULL,
    embedding vector(1536),

    -- Metadata
    source TEXT,
    confidence FLOAT DEFAULT 1.0,
    validated_at TIMESTAMPTZ,
    validated_by TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,          -- NULL = permanent
    accessed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_tier CHECK (tier IN ('working', 'long_term')),
    CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

-- Indexes for common query patterns
CREATE INDEX idx_agent_memory_agent_id ON agent_memory(agent_id);
CREATE INDEX idx_agent_memory_project_id ON agent_memory(project_id);
CREATE INDEX idx_agent_memory_workspace_id ON agent_memory(workspace_id);
CREATE INDEX idx_agent_memory_bead_id ON agent_memory(bead_id);
CREATE INDEX idx_agent_memory_content_type ON agent_memory(content_type);
CREATE INDEX idx_agent_memory_tier ON agent_memory(tier);
CREATE INDEX idx_agent_memory_tags ON agent_memory USING GIN(tags);
CREATE INDEX idx_agent_memory_metadata ON agent_memory USING GIN(metadata);
CREATE INDEX idx_agent_memory_expires_at ON agent_memory(expires_at)
    WHERE expires_at IS NOT NULL;

-- HNSW index for semantic search (cosine similarity)
CREATE INDEX idx_agent_memory_embedding ON agent_memory
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Agent beliefs table (for belief management system)
CREATE TABLE agent_beliefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    memory_id UUID REFERENCES agent_memory(id) ON DELETE CASCADE,

    -- Belief content
    statement TEXT NOT NULL,
    evidence TEXT[],

    -- Confidence tracking
    confidence FLOAT NOT NULL DEFAULT 0.5,
    confidence_history JSONB DEFAULT '[]',

    -- Validation
    status TEXT DEFAULT 'pending',
    validated_at TIMESTAMPTZ,
    validated_by TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_belief_status CHECK (
        status IN ('pending', 'validated', 'rejected', 'outdated')
    ),
    CONSTRAINT valid_belief_confidence CHECK (
        confidence >= 0 AND confidence <= 1
    )
);

CREATE INDEX idx_agent_beliefs_agent_id ON agent_beliefs(agent_id);
CREATE INDEX idx_agent_beliefs_status ON agent_beliefs(status);
CREATE INDEX idx_agent_beliefs_memory_id ON agent_beliefs(memory_id);

-- Memory access log for analytics and decay
CREATE TABLE agent_memory_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID REFERENCES agent_memory(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    access_type TEXT NOT NULL,  -- 'read', 'write', 'search'
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memory_access_log_memory_id ON agent_memory_access_log(memory_id);
CREATE INDEX idx_memory_access_log_agent_id ON agent_memory_access_log(agent_id);
CREATE INDEX idx_memory_access_log_created_at ON agent_memory_access_log(created_at);

-- Function to update access metadata
CREATE OR REPLACE FUNCTION update_memory_access()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE agent_memory
    SET
        accessed_at = NOW(),
        usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = NEW.memory_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_memory_access
    AFTER INSERT ON agent_memory_access_log
    FOR EACH ROW
    EXECUTE FUNCTION update_memory_access();
```

### Valkey Schema (Working Memory)

```
Key Pattern: agent:{agentId}:working:{memoryId}
Value: JSON-encoded WorkingMemory object
TTL: Configurable (default 7 days = 604800 seconds)

Secondary Indexes (using Valkey sorted sets):
- agent:{agentId}:working:by_type:{contentType} -> ZSET(memoryId, timestamp)
- agent:{agentId}:working:by_bead:{beadId} -> ZSET(memoryId, timestamp)
- agent:{agentId}:working:recent -> ZSET(memoryId, timestamp) [limited to 100]

Hash for agent metadata:
- agent:{agentId}:meta -> HASH(lastActive, totalMemories, workingCount)
```

### Prisma Schema Addition

```prisma
// Add to prisma/schema.prisma

model AgentMemory {
  id          String   @id @default(uuid()) @db.Uuid
  agentId     String   @map("agent_id")
  projectId   String?  @map("project_id")
  workspaceId String?  @map("workspace_id")
  beadId      String?  @map("bead_id")

  tier        String   @default("long_term")
  content     String
  contentType String   @map("content_type")
  embedding   Unsupported("vector(1536)")?

  source      String?
  confidence  Float    @default(1.0)
  validatedAt DateTime? @map("validated_at")
  validatedBy String?  @map("validated_by")
  usageCount  Int      @default(0) @map("usage_count")
  lastUsedAt  DateTime? @map("last_used_at")
  tags        String[] @default([])
  metadata    Json     @default("{}")

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  expiresAt   DateTime? @map("expires_at")
  accessedAt  DateTime @default(now()) @map("accessed_at")

  beliefs     AgentBelief[]
  accessLogs  AgentMemoryAccessLog[]

  @@index([agentId])
  @@index([projectId])
  @@index([workspaceId])
  @@index([beadId])
  @@index([contentType])
  @@index([tier])
  @@index([tags], type: Gin)
  @@index([expiresAt])
  @@map("agent_memory")
}

model AgentBelief {
  id                String   @id @default(uuid()) @db.Uuid
  agentId           String   @map("agent_id")
  memoryId          String?  @map("memory_id") @db.Uuid
  memory            AgentMemory? @relation(fields: [memoryId], references: [id], onDelete: Cascade)

  statement         String
  evidence          String[]

  confidence        Float    @default(0.5)
  confidenceHistory Json     @default("[]") @map("confidence_history")

  status            String   @default("pending")
  validatedAt       DateTime? @map("validated_at")
  validatedBy       String?  @map("validated_by")

  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@index([agentId])
  @@index([status])
  @@index([memoryId])
  @@map("agent_beliefs")
}

model AgentMemoryAccessLog {
  id         String   @id @default(uuid()) @db.Uuid
  memoryId   String   @map("memory_id") @db.Uuid
  memory     AgentMemory @relation(fields: [memoryId], references: [id], onDelete: Cascade)
  agentId    String   @map("agent_id")
  accessType String   @map("access_type")
  context    Json?
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([memoryId])
  @@index([agentId])
  @@index([createdAt])
  @@map("agent_memory_access_log")
}
```

## API Design

### Memory Service Interface

```typescript
// src/lib/memory/interfaces.ts

export interface IMemoryService {
  // Ephemeral operations (in-process)
  getEphemeral(sessionId: string, key: string): Promise<any>;
  setEphemeral(sessionId: string, key: string, value: any): Promise<void>;
  clearEphemeral(sessionId: string): Promise<void>;

  // Working memory operations (Valkey)
  getWorking(agentId: string, memoryId: string): Promise<WorkingMemory | null>;
  setWorking(memory: CreateWorkingMemory): Promise<WorkingMemory>;
  searchWorking(agentId: string, query: WorkingMemoryQuery): Promise<WorkingMemory[]>;
  promoteToLongTerm(memoryId: string): Promise<LongTermMemory>;

  // Long-term memory operations (PostgreSQL)
  getLongTerm(memoryId: string): Promise<LongTermMemory | null>;
  setLongTerm(memory: CreateLongTermMemory): Promise<LongTermMemory>;
  searchLongTerm(query: LongTermMemoryQuery): Promise<LongTermMemory[]>;
  semanticSearch(
    agentId: string,
    queryText: string,
    options?: SemanticSearchOptions
  ): Promise<LongTermMemory[]>;

  // Belief management
  createBelief(belief: CreateBelief): Promise<AgentBelief>;
  validateBelief(beliefId: string, validated: boolean, validatedBy: string): Promise<AgentBelief>;
  getBeliefs(agentId: string, status?: BeliefStatus): Promise<AgentBelief[]>;

  // Cross-session handoff
  createHandoff(agentId: string, sessionId: string): Promise<SessionHandoff>;
  resumeFromHandoff(agentId: string, handoffId: string): Promise<SessionState>;

  // Maintenance
  pruneExpired(): Promise<number>;
  computeDecay(): Promise<void>;
}

export interface SemanticSearchOptions {
  projectId?: string;
  workspaceId?: string;
  contentTypes?: LongTermMemoryType[];
  minConfidence?: number;
  limit?: number;
  threshold?: number;  // Similarity threshold (0-1)
}

export interface WorkingMemoryQuery {
  contentType?: WorkingMemoryType;
  beadId?: string;
  minConfidence?: number;
  limit?: number;
}

export interface LongTermMemoryQuery {
  projectId?: string;
  workspaceId?: string;
  contentType?: LongTermMemoryType;
  tags?: string[];
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface SessionHandoff {
  id: string;
  agentId: string;
  sessionId: string;
  workingMemorySnapshot: string[];  // Memory IDs
  ephemeralSummary: string;
  activeBeadId?: string;
  createdAt: Date;
}

export type BeliefStatus = 'pending' | 'validated' | 'rejected' | 'outdated';
```

### REST API Endpoints

```
POST   /api/v1/memory/ephemeral/:sessionId
GET    /api/v1/memory/ephemeral/:sessionId/:key
DELETE /api/v1/memory/ephemeral/:sessionId

POST   /api/v1/memory/working
GET    /api/v1/memory/working/:memoryId
GET    /api/v1/memory/working/agent/:agentId
POST   /api/v1/memory/working/:memoryId/promote

POST   /api/v1/memory/long-term
GET    /api/v1/memory/long-term/:memoryId
GET    /api/v1/memory/long-term/agent/:agentId
POST   /api/v1/memory/long-term/search
POST   /api/v1/memory/long-term/semantic-search

POST   /api/v1/memory/beliefs
GET    /api/v1/memory/beliefs/:beliefId
GET    /api/v1/memory/beliefs/agent/:agentId
POST   /api/v1/memory/beliefs/:beliefId/validate

POST   /api/v1/memory/handoff
GET    /api/v1/memory/handoff/:handoffId
POST   /api/v1/memory/handoff/:handoffId/resume
```

### TypeScript Service Implementation

```typescript
// src/lib/memory/memory-service.ts

import { PrismaClient } from '@prisma/client';
import { createClient, RedisClientType } from 'redis';
import { OpenAI } from 'openai';
import {
  IMemoryService,
  WorkingMemory,
  LongTermMemory,
  SemanticSearchOptions,
  // ... other types
} from './interfaces';

export class MemoryService implements IMemoryService {
  private prisma: PrismaClient;
  private valkey: RedisClientType;
  private openai: OpenAI;
  private ephemeralStore: Map<string, Map<string, any>> = new Map();

  private readonly WORKING_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(
    prisma: PrismaClient,
    valkey: RedisClientType,
    openai: OpenAI
  ) {
    this.prisma = prisma;
    this.valkey = valkey;
    this.openai = openai;
  }

  // === Ephemeral Memory ===

  async getEphemeral(sessionId: string, key: string): Promise<any> {
    const session = this.ephemeralStore.get(sessionId);
    return session?.get(key) ?? null;
  }

  async setEphemeral(sessionId: string, key: string, value: any): Promise<void> {
    if (!this.ephemeralStore.has(sessionId)) {
      this.ephemeralStore.set(sessionId, new Map());
    }
    this.ephemeralStore.get(sessionId)!.set(key, value);
  }

  async clearEphemeral(sessionId: string): Promise<void> {
    this.ephemeralStore.delete(sessionId);
  }

  // === Working Memory (Valkey) ===

  async getWorking(agentId: string, memoryId: string): Promise<WorkingMemory | null> {
    const key = `agent:${agentId}:working:${memoryId}`;
    const data = await this.valkey.get(key);
    if (!data) return null;

    const memory = JSON.parse(data) as WorkingMemory;

    // Update access tracking
    await this.valkey.zAdd(`agent:${agentId}:working:recent`, {
      score: Date.now(),
      value: memoryId
    });

    return memory;
  }

  async setWorking(input: CreateWorkingMemory): Promise<WorkingMemory> {
    const memoryId = crypto.randomUUID();
    const now = new Date();

    const memory: WorkingMemory = {
      id: memoryId,
      agentId: input.agentId,
      beadId: input.beadId,
      tier: 'working',
      content: input.content,
      contentType: input.contentType,
      metadata: {
        source: input.source ?? 'agent',
        confidence: input.confidence ?? 0.5,
        validated: false,
        lastAccessedAt: now,
        accessCount: 0
      },
      expiresAt: new Date(now.getTime() + this.WORKING_TTL * 1000),
      createdAt: now,
      updatedAt: now
    };

    const key = `agent:${input.agentId}:working:${memoryId}`;
    await this.valkey.setEx(key, this.WORKING_TTL, JSON.stringify(memory));

    // Update indexes
    await Promise.all([
      this.valkey.zAdd(`agent:${input.agentId}:working:by_type:${input.contentType}`, {
        score: now.getTime(),
        value: memoryId
      }),
      this.valkey.zAdd(`agent:${input.agentId}:working:recent`, {
        score: now.getTime(),
        value: memoryId
      })
    ]);

    if (input.beadId) {
      await this.valkey.zAdd(`agent:${input.agentId}:working:by_bead:${input.beadId}`, {
        score: now.getTime(),
        value: memoryId
      });
    }

    return memory;
  }

  async promoteToLongTerm(memoryId: string, agentId: string): Promise<LongTermMemory> {
    // Get working memory
    const working = await this.getWorking(agentId, memoryId);
    if (!working) {
      throw new Error(`Working memory ${memoryId} not found`);
    }

    // Generate embedding
    const embedding = await this.generateEmbedding(working.content);

    // Create long-term memory
    const longTerm = await this.prisma.$queryRaw<LongTermMemory[]>`
      INSERT INTO agent_memory (
        agent_id, bead_id, tier, content, content_type, embedding,
        source, confidence, validated_at, tags, metadata
      ) VALUES (
        ${working.agentId},
        ${working.beadId},
        'long_term',
        ${working.content},
        ${working.contentType},
        ${embedding}::vector,
        ${working.metadata.source},
        ${working.metadata.confidence},
        NOW(),
        ${[]},
        ${JSON.stringify(working.metadata)}
      )
      RETURNING *
    `;

    // Delete working memory
    const key = `agent:${agentId}:working:${memoryId}`;
    await this.valkey.del(key);

    return longTerm[0];
  }

  // === Long-term Memory (PostgreSQL) ===

  async semanticSearch(
    agentId: string,
    queryText: string,
    options: SemanticSearchOptions = {}
  ): Promise<LongTermMemory[]> {
    const embedding = await this.generateEmbedding(queryText);
    const limit = options.limit ?? 10;
    const threshold = options.threshold ?? 0.7;

    let sql = `
      SELECT
        *,
        1 - (embedding <=> $1::vector) as similarity
      FROM agent_memory
      WHERE
        agent_id = $2
        AND tier = 'long_term'
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) > $3
    `;

    const params: any[] = [embedding, agentId, threshold];
    let paramIndex = 4;

    if (options.projectId) {
      sql += ` AND project_id = $${paramIndex++}`;
      params.push(options.projectId);
    }

    if (options.workspaceId) {
      sql += ` AND workspace_id = $${paramIndex++}`;
      params.push(options.workspaceId);
    }

    if (options.contentTypes?.length) {
      sql += ` AND content_type = ANY($${paramIndex++})`;
      params.push(options.contentTypes);
    }

    if (options.minConfidence) {
      sql += ` AND confidence >= $${paramIndex++}`;
      params.push(options.minConfidence);
    }

    sql += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const results = await this.prisma.$queryRawUnsafe<LongTermMemory[]>(sql, ...params);

    // Log access for each result
    for (const result of results) {
      await this.prisma.agentMemoryAccessLog.create({
        data: {
          memoryId: result.id,
          agentId,
          accessType: 'search',
          context: { query: queryText, similarity: (result as any).similarity }
        }
      });
    }

    return results;
  }

  // === Belief Management ===

  async createBelief(input: CreateBelief): Promise<AgentBelief> {
    return this.prisma.agentBelief.create({
      data: {
        agentId: input.agentId,
        memoryId: input.memoryId,
        statement: input.statement,
        evidence: input.evidence ?? [],
        confidence: input.confidence ?? 0.5,
        status: 'pending'
      }
    });
  }

  async validateBelief(
    beliefId: string,
    validated: boolean,
    validatedBy: string
  ): Promise<AgentBelief> {
    const belief = await this.prisma.agentBelief.findUnique({
      where: { id: beliefId }
    });

    if (!belief) {
      throw new Error(`Belief ${beliefId} not found`);
    }

    const newConfidence = validated
      ? Math.min(belief.confidence + 0.2, 1.0)
      : Math.max(belief.confidence - 0.3, 0.0);

    const confidenceHistory = [
      ...(belief.confidenceHistory as any[]),
      {
        confidence: newConfidence,
        validated,
        validatedBy,
        timestamp: new Date().toISOString()
      }
    ];

    return this.prisma.agentBelief.update({
      where: { id: beliefId },
      data: {
        status: validated ? 'validated' : 'rejected',
        confidence: newConfidence,
        confidenceHistory,
        validatedAt: new Date(),
        validatedBy
      }
    });
  }

  // === Session Handoff ===

  async createHandoff(agentId: string, sessionId: string): Promise<SessionHandoff> {
    // Get current working memories
    const recentKeys = await this.valkey.zRange(
      `agent:${agentId}:working:recent`,
      0,
      49,
      { REV: true }
    );

    // Summarize ephemeral memory
    const ephemeral = this.ephemeralStore.get(sessionId);
    const ephemeralSummary = ephemeral
      ? await this.summarizeEphemeral(ephemeral)
      : '';

    // Get active bead
    const activeBeadKey = await this.valkey.get(`agent:${agentId}:active_bead`);

    const handoff: SessionHandoff = {
      id: crypto.randomUUID(),
      agentId,
      sessionId,
      workingMemorySnapshot: recentKeys,
      ephemeralSummary,
      activeBeadId: activeBeadKey ?? undefined,
      createdAt: new Date()
    };

    // Store handoff for 30 days
    await this.valkey.setEx(
      `agent:${agentId}:handoff:${handoff.id}`,
      30 * 24 * 60 * 60,
      JSON.stringify(handoff)
    );

    return handoff;
  }

  // === Helpers ===

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536
    });
    return response.data[0].embedding;
  }

  private async summarizeEphemeral(ephemeral: Map<string, any>): Promise<string> {
    const entries = Array.from(ephemeral.entries())
      .map(([k, v]) => `${k}: ${JSON.stringify(v).slice(0, 200)}`)
      .join('\n');

    // Use LLM to summarize if large
    if (entries.length > 2000) {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'Summarize this session state concisely for handoff to next session.'
        }, {
          role: 'user',
          content: entries
        }],
        max_tokens: 500
      });
      return response.choices[0].message.content ?? entries.slice(0, 1000);
    }

    return entries;
  }
}
```

## Memory Lifecycle

### Memory Flow Diagram

```
User Request
    │
    ▼
┌─────────────────┐
│   Ephemeral     │  Check: Is this in current context?
│   Memory        │  If yes → use immediately
└────────┬────────┘
         │ miss
         ▼
┌─────────────────┐
│    Working      │  Check: Is this recent knowledge?
│    Memory       │  If yes → use, refresh TTL
└────────┬────────┘
         │ miss
         ▼
┌─────────────────┐
│   Long-term     │  Check: Semantic search for relevant knowledge
│    Memory       │  If found → use, log access
└────────┬────────┘
         │
         ▼
    Agent Response
         │
         ▼
┌─────────────────┐
│  Store Result   │  New learning → Working memory
│  (if valuable)  │  Validated → Promote to Long-term
└─────────────────┘
```

### Promotion Criteria

Working memory is promoted to long-term when:
1. **Access frequency**: Accessed >5 times
2. **Confidence threshold**: Confidence >0.8
3. **Explicit validation**: Human or senior agent validates
4. **Time threshold**: Survives >3 days with continued use

### Decay and Cleanup

- **Working memory**: TTL-based expiration (default 7 days)
- **Long-term memory**: Confidence decay for unused memories
  - Unused for 30 days: confidence -= 0.1
  - Unused for 90 days: confidence -= 0.2
  - Confidence <0.3: candidate for archival
- **Ephemeral memory**: Cleared on session end

## Integration with Gas Town

### Bead-Memory Relationship

```
┌──────────────────────────────────────────────────────┐
│                    Gas Town Bead                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Bead ID: mm-7716                              │  │
│  │  Title: Design Agent Memory Architecture       │  │
│  │  Status: HOOKED                                │  │
│  └────────────────────────────────────────────────┘  │
│                         │                            │
│                         │ references                 │
│                         ▼                            │
│  ┌────────────────────────────────────────────────┐  │
│  │             Agent Memory Entries               │  │
│  │                                                │  │
│  │  Working Memory:                               │  │
│  │  - Task context: "Designing 3-tier memory..."  │  │
│  │  - Pattern learned: "Use pgvector for..."     │  │
│  │                                                │  │
│  │  Long-term Memory:                            │  │
│  │  - Project knowledge: "Database consolidation" │  │
│  │  - Code pattern: "Prisma schema conventions"  │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Session Handoff Protocol

When an agent session ends:
1. Create handoff record with working memory snapshot
2. Summarize ephemeral context using LLM
3. Store active bead reference
4. Clear ephemeral memory

When a new session starts with same bead:
1. Load handoff record
2. Restore working memory context
3. Prime ephemeral memory with summary
4. Resume from last known state

## Error Amplification Prevention

### Belief Validation System

To prevent "stray sentence becomes durable trait" (from #884):

1. **New information starts as pending belief** with low confidence (0.5)
2. **Beliefs require validation** before promotion to long-term
3. **Confidence tracking** with history for audit
4. **Automatic decay** for beliefs that aren't reinforced
5. **Source tracking** to identify error propagation chains

### Validation Rules

```typescript
const VALIDATION_RULES = {
  // Auto-validate if multiple sources agree
  MULTI_SOURCE_AGREEMENT: {
    minSources: 3,
    confidenceBoost: 0.3
  },

  // Require human validation for high-impact beliefs
  HIGH_IMPACT_THRESHOLD: {
    topics: ['security', 'authentication', 'payment'],
    requireHumanValidation: true
  },

  // Decay unvalidated beliefs
  BELIEF_DECAY: {
    intervalDays: 7,
    decayRate: 0.1,
    minConfidence: 0.2
  }
};
```

## Migration Plan

### Phase 1: Schema Setup (Day 1-2)

1. Create migration file for `agent_memory` tables
2. Deploy to staging environment
3. Verify pgvector indexes work correctly
4. Run performance benchmarks

### Phase 2: Valkey Integration (Day 3-4)

1. Configure Valkey connection in existing infrastructure
2. Implement working memory service
3. Test TTL expiration behavior
4. Integrate with existing monitoring

### Phase 3: Service Implementation (Day 5-7)

1. Implement `MemoryService` class
2. Create API endpoints
3. Write unit and integration tests
4. Performance testing under load

### Phase 4: Agent Integration (Day 8-10)

1. Integrate with existing agent infrastructure
2. Implement session handoff
3. Connect to Gas Town bead system
4. Test cross-session memory retention

### Phase 5: Belief System (Day 11-14)

1. Implement belief tracking
2. Create validation workflows
3. Add confidence decay jobs
4. Test error amplification scenarios

### Rollback Strategy

1. **Feature flag**: `ENABLE_AGENT_MEMORY` controls all new code paths
2. **Schema rollback**: Down migration drops new tables
3. **Valkey isolation**: Separate key prefix allows clean removal
4. **No breaking changes**: Existing agent behavior unchanged when disabled

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Context retention across sessions | >90% | % of relevant context restored |
| Error propagation | <5x | Compared to baseline 17x |
| Working memory retrieval | <10ms p95 | Valkey latency |
| Semantic search | <100ms p95 | PostgreSQL latency |
| Memory promotion accuracy | >85% | Validated memories that remain useful |

## References

- Issue #897: Design Agent Memory Architecture
- Epic #884: Multi-Agent Memory Infrastructure
- [Database Consolidation Plan](./DATABASE_CONSOLIDATION_PLAN.md)
- [2026 will be the year of on-device agents](https://news.ycombinator.com/item?id=46471524)
- [Agentic Frameworks in 2026](https://news.ycombinator.com/item?id=46509130)
