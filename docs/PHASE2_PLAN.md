# Phase 2 Integration Plan: ChatInterface and FileUploadInterface

**Version:** 1.0
**Created:** 2026-01-12
**Author:** AGENT 110 (Phase2Architect)
**Status:** Planning

---

## Executive Summary

Phase 2 represents the integration of two production-ready AI components (ChatInterface and FileUploadInterface) into the main VibeCode application. Both components have been built with comprehensive test coverage (45 and 39 tests respectively) and are ready for deployment on PR #774 and PR #775. This phase will transform these standalone components into fully integrated features with persistence, user flows, enhanced capabilities, and seamless navigation.

**Key Goals:**
- Integrate ChatInterface and FileUploadInterface into main application routing
- Implement database persistence for conversations and upload history
- Build enhanced features (export, branching, batch operations)
- Create cohesive user experience with navigation and state management
- Maintain security, performance, and accessibility standards

**Timeline Estimate:** 8 weeks (divided into 4 sub-phases)

**Key Milestones:**
1. Week 2: Basic integration complete with /chat and /upload routes
2. Week 4: Persistence layer operational with conversation and upload history
3. Week 6: Enhanced features (export, branching, batch upload) implemented
4. Week 8: Full E2E testing, performance optimization, production deployment

**Success Criteria:**
- All routes accessible and functional
- Database schema deployed and operational
- Test coverage maintained ≥25%
- Performance targets met (see Performance Targets section)
- Zero P0/P1 security vulnerabilities
- User can complete full workflows without errors

---

## Current State Analysis

### What Exists Now

#### Components (Production-Ready)
1. **ChatInterface** (PR #774)
   - Location: `src/components/ai/ChatInterface.tsx` (311 lines)
   - Features: Message display, streaming, 8 model options, error handling
   - Tests: 45 comprehensive tests, 100% pass rate
   - Grade: A (97/100)

2. **FileUploadInterface** (PR #775)
   - Location: `src/components/ai/FileUploadInterface.tsx` (431 lines)
   - Features: Drag-drop, validation, progress tracking, AI analysis display
   - Tests: 39 comprehensive tests, 100% pass rate
   - Grade: A (96/100)

3. **API Client Libraries**
   - `src/lib/ai-client.ts` (176 lines): Chat API integration with streaming
   - `src/lib/upload-client.ts` (321 lines): Upload validation and FormData handling

#### APIs (Tested and Operational)
- `/api/ai/chat` - Chat endpoint with streaming support (AGENT 90)
- `/api/ai/upload` - File upload with security validation (AGENT 98, 36 security tests)
- `/api/ai/provider-health` - Model availability checking
- `/api/ai/model-selection` - Dynamic model listing

#### Database (PostgreSQL with Prisma)
- **Existing models:** User, Session, Workspace, Project, File, Upload, AIRequest
- **Infrastructure:** Prisma Client, PostgreSQL connection
- **Missing:** Conversation and Message models for chat persistence

#### Application Structure
- Next.js 15 with App Router
- React 19 with hooks
- TypeScript strict mode
- Tailwind CSS + ShadcN UI components
- Main page: `src/app/page.tsx` (PromptInterface integration)

### What's Missing

#### Integration Points
1. **Routes**: No dedicated `/chat` or `/upload` pages yet
2. **Navigation**: No links or navigation system to access features
3. **Layout**: No shared application layout wrapper
4. **State Management**: No global state for conversations or uploads

#### Persistence Layer
1. **Database Schema**: Missing Conversation and Message models
2. **CRUD APIs**: No endpoints for managing conversation history
3. **Upload History**: Upload model exists but no history retrieval APIs
4. **User Association**: Need to link conversations/uploads to authenticated users

#### Enhanced Features
1. **Chat**: No conversation branching, export, or code highlighting
2. **Upload**: No batch upload, processing queue, or result export
3. **History**: No UI for viewing past conversations or uploads
4. **Search**: No ability to search through conversation history

#### User Experience
1. **Onboarding**: No guidance for first-time users
2. **Dashboard**: No widgets to access chat/upload from main page
3. **Settings**: No model preferences or configuration options
4. **Notifications**: No feedback for background operations

### Technical Debt or Blockers

1. **Authentication**: Need to verify auth integration for route protection
2. **Rate Limiting**: Need to implement to prevent abuse
3. **File Storage**: Current uploads use local storage; may need cloud storage (Vercel Blob/S3)
4. **WebSocket**: Streaming currently uses SSE; may need WebSocket for advanced features
5. **Database Migrations**: Need migration strategy for schema changes

### Dependencies and Prerequisites

**Required Before Phase 2:**
- PR #774 merged (ChatInterface)
- PR #775 merged (FileUploadInterface)
- Authentication system functional
- Database connection stable
- Next.js 15 upgrade complete (done)

**Optional Enhancements:**
- Cloud storage setup (Vercel Blob or AWS S3)
- Redis for session management (already available)
- OpenTelemetry instrumentation (already configured)

---

## Phase 2 Objectives

### Primary Objectives (Must-Have)

1. **Route Integration**
   - Create `/chat` page with ChatInterface
   - Create `/upload` page with FileUploadInterface
   - Add navigation links in main layout
   - Implement route-level authentication guards

2. **Persistence Layer**
   - Design and deploy Conversation/Message database schema
   - Build CRUD APIs for conversation management
   - Build history retrieval APIs for uploads
   - Implement automatic saving on user interactions

3. **User Flows**
   - Complete chat workflow: select model → send message → view response → save
   - Complete upload workflow: select file → validate → upload → view results → save
   - Implement error recovery and retry mechanisms

4. **Navigation & Layout**
   - Create shared AppLayout component
   - Add navigation sidebar or header
   - Implement breadcrumb navigation
   - Add mobile-responsive navigation

### Secondary Objectives (Should-Have)

1. **Enhanced Chat Features**
   - Export conversations (Markdown, JSON, PDF)
   - Conversation branching (fork at any message)
   - Code syntax highlighting in responses
   - Model switching mid-conversation

2. **Enhanced Upload Features**
   - Batch file upload (up to 10 files)
   - Upload queue with status tracking
   - Result export (JSON, CSV)
   - File type icons and previews

3. **History Management**
   - Conversation list with search and filtering
   - Upload history with sorting
   - Bulk delete operations
   - Archive/unarchive conversations

4. **Settings & Preferences**
   - Default model selection
   - Theme preferences (dark/light)
   - Notification settings
   - API usage dashboard

### Stretch Objectives (Nice-to-Have)

1. **Collaboration Features**
   - Share conversation links
   - Collaborative chat rooms
   - Upload result sharing

2. **Advanced Search**
   - Full-text search across all conversations
   - Semantic search using embeddings
   - Filter by model, date, or tags

3. **Analytics & Insights**
   - Token usage tracking
   - Cost estimation per conversation
   - Model performance comparison
   - Usage patterns visualization

4. **Integrations**
   - Export to GitHub Gist
   - Slack/Discord notifications
   - Webhook support for uploads
   - API access for third-party integrations

---

## Architecture Design

### Application Structure

```
src/
├── app/
│   ├── layout.tsx (enhanced - Add AppLayout wrapper)
│   ├── page.tsx (enhanced - Add quick access widgets)
│   │
│   ├── chat/
│   │   ├── page.tsx (NEW - Main chat interface)
│   │   ├── [conversationId]/
│   │   │   └── page.tsx (NEW - Load specific conversation)
│   │   └── history/
│   │       └── page.tsx (NEW - Conversation history list)
│   │
│   ├── upload/
│   │   ├── page.tsx (NEW - Main upload interface)
│   │   └── history/
│   │       └── page.tsx (NEW - Upload history list)
│   │
│   ├── api/
│   │   └── ai/
│   │       ├── chat/
│   │       │   └── route.ts (exists - tested by AGENT 90)
│   │       ├── upload/
│   │       │   └── route.ts (exists - tested by AGENT 98)
│   │       ├── conversations/
│   │       │   ├── route.ts (NEW - List conversations)
│   │       │   └── [id]/
│   │       │       ├── route.ts (NEW - Get/update/delete)
│   │       │       └── messages/
│   │       │           └── route.ts (NEW - Add messages)
│   │       └── uploads/
│   │           ├── route.ts (NEW - List upload history)
│   │           └── [id]/
│   │               └── route.ts (NEW - Get/delete upload)
│   │
│   └── settings/
│       └── page.tsx (NEW - User preferences)
│
├── components/
│   ├── ai/
│   │   ├── ChatInterface.tsx (exists - PR #774)
│   │   ├── FileUploadInterface.tsx (exists - PR #775)
│   │   ├── ConversationHistory.tsx (NEW)
│   │   ├── UploadHistory.tsx (NEW)
│   │   └── ModelSelector.tsx (NEW - Reusable model picker)
│   │
│   ├── layouts/
│   │   ├── AppLayout.tsx (NEW - Main application wrapper)
│   │   ├── Navigation.tsx (NEW - Sidebar/header navigation)
│   │   └── Breadcrumb.tsx (NEW - Breadcrumb trail)
│   │
│   └── ui/ (ShadcN components - already exist)
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       └── ... (other UI primitives)
│
├── lib/
│   ├── ai-client.ts (exists - PR #774)
│   ├── upload-client.ts (exists - PR #775)
│   ├── conversation-client.ts (NEW - Conversation CRUD)
│   └── db.ts (exists - Prisma client)
│
├── hooks/
│   ├── useAuth.ts (exists)
│   ├── useConversation.ts (NEW - Conversation state)
│   ├── useUploadHistory.ts (NEW - Upload history state)
│   └── useModelSelection.ts (NEW - Model preferences)
│
└── types/
    ├── ai.ts (enhanced - Add conversation types)
    └── upload.ts (enhanced - Add history types)
```

### Integration Points

#### 1. Navigation System
**Location:** `src/components/layouts/Navigation.tsx`

**Features:**
- Sidebar with icons for Chat, Upload, History, Settings
- Active route highlighting
- Collapse/expand functionality
- Mobile hamburger menu
- Keyboard shortcuts (Cmd+K for command palette)

**Example:**
```tsx
<Navigation>
  <NavItem href="/chat" icon={MessageSquare} label="Chat" />
  <NavItem href="/upload" icon={Upload} label="Upload" />
  <NavItem href="/chat/history" icon={History} label="History" />
  <NavItem href="/settings" icon={Settings} label="Settings" />
</Navigation>
```

#### 2. State Management
**Strategy:** React Context + Custom Hooks (no Redux/Zustand needed for Phase 2)

**Contexts:**
- `ConversationContext`: Current conversation, messages, model selection
- `UploadContext`: Current upload, progress, results
- `PreferencesContext`: User settings, theme, default model

**Why Context over Zustand:**
- Smaller scope (only 2-3 features)
- Built-in React feature
- Easier to test
- Can migrate to Zustand in Phase 3 if needed

#### 3. API Layer
**Pattern:** RESTful APIs with standard HTTP methods

**Endpoints:**
```
# Conversations
POST   /api/conversations              - Create new conversation
GET    /api/conversations              - List user's conversations
GET    /api/conversations/:id          - Get specific conversation
PUT    /api/conversations/:id          - Update conversation (title, etc.)
DELETE /api/conversations/:id          - Delete conversation
POST   /api/conversations/:id/messages - Add message to conversation

# Uploads
GET    /api/uploads                    - List upload history
GET    /api/uploads/:id                - Get upload details
DELETE /api/uploads/:id                - Delete upload
```

**Response Format:**
```typescript
// Success response
{
  success: true,
  data: { ... },
  meta: { total: 10, page: 1, limit: 20 }
}

// Error response
{
  success: false,
  error: {
    code: "INVALID_INPUT",
    message: "File size exceeds 10MB limit",
    details: { ... }
  }
}
```

#### 4. Database Integration
**ORM:** Prisma Client (already configured)

**Connection Management:**
- Singleton Prisma Client instance
- Connection pooling (max 10 connections)
- Retry logic for transient failures
- Query logging in development

**Transaction Handling:**
```typescript
await prisma.$transaction(async (tx) => {
  const conversation = await tx.conversation.create({ ... })
  const message = await tx.message.create({ ... })
  return { conversation, message }
})
```

---

## User Flows

### Chat Flow (Detailed)

**Step 1: User navigates to /chat**
- URL: `https://app.vibecode.com/chat`
- Authentication check: Redirect to login if not authenticated
- Load default model from preferences or use Claude 3.5 Sonnet
- Display empty ChatInterface with welcome message

**Step 2: User selects model from dropdown**
- Model selector shows 8 options (Claude, GPT-4, GPT-3.5, SmolLM2)
- Selection updates state immediately
- Previous conversation context preserved if switching mid-conversation

**Step 3: User types message and sends**
- Input validation: Non-empty, max 10,000 characters
- Press Enter to send, Shift+Enter for new line
- Message appears in chat immediately (optimistic UI)
- API call to `/api/ai/chat` with streaming

**Step 4: Streaming response displays**
- Tokens stream in real-time using SSE
- Typing indicator shows while waiting
- Cancel button available during streaming
- Error handling if stream fails

**Step 5: Conversation saved to database**
- After response completes, save to database:
  - Create Conversation if first message
  - Add Message records for user and assistant
- Save happens in background (no blocking)
- Show "Saved" indicator briefly

**Step 6: User can continue or start new conversation**
- "Continue conversation" - Keep adding messages
- "New conversation" - Reset and create new Conversation record
- "View history" - Navigate to `/chat/history`

### Upload Flow (Detailed)

**Step 1: User navigates to /upload**
- URL: `https://app.vibecode.com/upload`
- Authentication check required
- Display FileUploadInterface with drop zone

**Step 2: User drags file or clicks to browse**
- Drag-and-drop events: dragover, drop
- Click triggers file input dialog
- Multiple file selection allowed (up to 10)

**Step 3: Client validates file (MIME, size)**
- MIME type whitelist: text/*, application/json, etc.
- Max file size: 10MB per file
- Max total size: 50MB
- Max file count: 10 files
- Path traversal prevention, null byte checks

**Step 4: Upload progress displays**
- Progress bar per file (XHR with progress events)
- Overall progress percentage
- Cancel button for each file
- Time remaining estimate

**Step 5: AI analysis runs on server**
- Server receives file via `/api/ai/upload`
- Security validation (same rules as client)
- AI analysis with selected model
- Response includes analysis results

**Step 6: Results displayed to user**
- Show analysis in formatted card
- Syntax highlighting for code files
- Download original file button
- Export analysis as JSON/PDF

**Step 7: Upload history saved**
- Upload record created in database
- Links to user and workspace
- Status: "uploaded" → "processing" → "processed"
- Can view in `/upload/history`

---

## Implementation Roadmap

### Phase 2.1: Basic Integration (Week 1-2)

**Goal:** Users can access chat and upload features via dedicated routes.

**Tasks:**
- [ ] Merge PR #774 (ChatInterface) into main branch
- [ ] Merge PR #775 (FileUploadInterface) into main branch
- [ ] Create `/chat` route with ChatInterface component
  - File: `src/app/chat/page.tsx`
  - Wrap ChatInterface with authentication check
  - Add page metadata (title, description)
- [ ] Create `/upload` route with FileUploadInterface component
  - File: `src/app/upload/page.tsx`
  - Wrap FileUploadInterface with authentication check
  - Add page metadata
- [ ] Create `AppLayout` component with navigation
  - File: `src/components/layouts/AppLayout.tsx`
  - Sidebar with Chat, Upload, History links
  - Responsive design (collapse on mobile)
- [ ] Update `src/app/layout.tsx` to use AppLayout
- [ ] Add navigation links in main page header
- [ ] Basic styling with Tailwind CSS
- [ ] Responsive design testing (mobile, tablet, desktop)
- [ ] Integration tests for routes
  - Test: Chat page renders ChatInterface
  - Test: Upload page renders FileUploadInterface
  - Test: Unauthenticated users redirected to login

**Deliverables:**
- Working `/chat` and `/upload` pages
- Navigation system functional
- All tests passing

**Estimated Time:** 2 weeks (80 hours)

---

### Phase 2.2: Persistence Layer (Week 3-4)

**Goal:** Conversations and uploads saved to database with retrieval APIs.

**Tasks:**

#### Database Schema
- [ ] Design Conversation and Message models
  - Add to `prisma/schema.prisma`
  - Fields: id, userId, title, model, createdAt, updatedAt
  - Message: id, conversationId, role, content, timestamp
- [ ] Create Prisma migration
  - `npx prisma migrate dev --name add_conversations`
- [ ] Deploy migration to staging database
- [ ] Update Prisma types: `npx prisma generate`

#### API Development
- [ ] Create `/api/conversations` endpoints
  - POST: Create conversation
  - GET: List user's conversations (paginated)
- [ ] Create `/api/conversations/[id]` endpoints
  - GET: Get specific conversation with messages
  - PUT: Update conversation (title)
  - DELETE: Delete conversation
- [ ] Create `/api/conversations/[id]/messages` endpoint
  - POST: Add message to conversation
- [ ] Create `/api/uploads` endpoints
  - GET: List upload history (paginated)
- [ ] Create `/api/uploads/[id]` endpoints
  - GET: Get upload details
  - DELETE: Delete upload

#### Frontend Integration
- [ ] Create `conversation-client.ts` utility
  - Functions: createConversation, getConversations, updateConversation, deleteConversation
- [ ] Implement auto-save in ChatInterface
  - Save after each message exchange
  - Debounce to avoid excessive saves
- [ ] Add "Save" indicator in chat UI
- [ ] Create `useConversation` hook for state management
- [ ] Create `useUploadHistory` hook for upload state

#### Testing
- [ ] Unit tests for API endpoints
- [ ] Integration tests for CRUD operations
- [ ] E2E tests for save/load flows

**Deliverables:**
- Database schema deployed
- All CRUD APIs functional
- Conversations and uploads persist correctly

**Estimated Time:** 2 weeks (80 hours)

---

### Phase 2.3: History & Enhanced Features (Week 5-6)

**Goal:** Users can view history and use advanced features (export, branching).

**Tasks:**

#### History Views
- [ ] Create `/chat/history` page
  - Component: `ConversationHistory.tsx`
  - List all conversations with titles and dates
  - Search and filter functionality
  - Pagination (20 per page)
- [ ] Create `/upload/history` page
  - Component: `UploadHistory.tsx`
  - List all uploads with filenames and dates
  - Filter by status (uploaded, processing, processed)
  - Pagination
- [ ] Implement conversation loading
  - Click conversation in history → Navigate to `/chat/[id]`
  - Load messages from database
  - Continue conversation from last message

#### Chat Enhancements
- [ ] Conversation branching
  - "Branch from here" button on each message
  - Creates new conversation with history up to that point
  - Use case: Try different approaches
- [ ] Export conversation
  - Formats: Markdown, JSON, PDF
  - Button in chat interface
  - Generate file client-side, trigger download
- [ ] Code syntax highlighting
  - Detect code blocks in responses
  - Use Prism.js or Highlight.js
  - Support major languages (JS, Python, etc.)
- [ ] Model switching mid-conversation
  - Select different model after N messages
  - Preserve context, continue with new model

#### Upload Enhancements
- [ ] Batch upload support
  - Select multiple files (up to 10)
  - Upload in parallel with progress tracking
  - Aggregate results display
- [ ] Processing queue/status
  - Show queue position for large files
  - Status updates via polling or WebSocket
  - Notifications when processing completes
- [ ] Result export
  - Export analysis as JSON, CSV, or PDF
  - Include metadata (filename, timestamp, model)

#### Settings Page
- [ ] Create `/settings` page
  - Default model selection
  - Theme preference (dark/light)
  - Notification settings
  - API usage summary

**Deliverables:**
- History views functional with search/filter
- Export and branching features working
- Batch upload operational

**Estimated Time:** 2 weeks (80 hours)

---

### Phase 2.4: Testing, Polish & Deployment (Week 7-8)

**Goal:** Production-ready deployment with full test coverage and performance optimization.

**Tasks:**

#### E2E Testing
- [ ] Playwright tests for chat flow
  - Test: Complete chat conversation
  - Test: Save and load conversation
  - Test: Export conversation
- [ ] Playwright tests for upload flow
  - Test: Upload single file
  - Test: Batch upload multiple files
  - Test: View upload history
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsiveness testing

#### Performance Optimization
- [ ] Bundle size analysis
  - Lazy load heavy components
  - Code splitting for routes
  - Tree-shaking unused dependencies
- [ ] Database query optimization
  - Index conversations by userId and createdAt
  - Optimize pagination queries
  - Use SELECT only needed columns
- [ ] Caching strategy
  - Cache conversation list in Redis (5 min TTL)
  - Cache model list (1 hour TTL)
  - Implement stale-while-revalidate
- [ ] Lighthouse audit
  - Target: Performance ≥90, Accessibility ≥95
  - Fix any critical issues

#### Security Audit
- [ ] OWASP Top 10 check
  - SQL injection prevention (Prisma handles)
  - XSS prevention (React escapes by default)
  - CSRF protection (tokens)
- [ ] Rate limiting implementation
  - Limit: 100 requests/hour per user for chat
  - Limit: 20 uploads/hour per user
  - Use Upstash Rate Limit (already available)
- [ ] Input validation review
  - Server-side validation for all inputs
  - Zod schemas for API requests
- [ ] Dependency audit
  - `npm audit` and fix vulnerabilities

#### Monitoring & Observability
- [ ] OpenTelemetry traces for new APIs
  - Instrument conversation CRUD endpoints
  - Track response times and errors
- [ ] Datadog dashboards
  - Chat usage metrics (messages/day, avg response time)
  - Upload metrics (files/day, avg file size)
  - Error rates and alerts
- [ ] User action tracking
  - Track: Conversation created, Message sent, File uploaded
  - Use existing Event model in database

#### Documentation
- [ ] User guide for chat feature
- [ ] User guide for upload feature
- [ ] API documentation for new endpoints
- [ ] Developer guide for Phase 3 enhancements

#### Deployment
- [ ] Deploy to staging environment
- [ ] QA testing on staging
- [ ] Run performance tests on staging
- [ ] Deploy to production (Vercel)
- [ ] Monitor for errors in first 24 hours

**Deliverables:**
- All E2E tests passing
- Performance targets met
- Zero P0/P1 security issues
- Production deployment successful

**Estimated Time:** 2 weeks (80 hours)

---

## Database Schema

### New Models (to be added to `prisma/schema.prisma`)

```prisma
// Conversation Management
model Conversation {
  id        String   @id @default(uuid())
  userId    Int
  title     String?  @db.VarChar(255)
  model     String   @db.VarChar(100) // e.g., "anthropic/claude-3.5-sonnet"
  status    String   @default("active") // active, archived
  metadata  Json?    // Additional metadata (tags, settings)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages Message[]

  @@index([userId, createdAt])
  @@index([userId, status])
  @@map("conversations")
}

model Message {
  id             String       @id @default(uuid())
  conversationId String       @map("conversation_id")
  role           String       // "user" | "assistant" | "system"
  content        String       @db.Text
  model          String?      @db.VarChar(100) // Model used for this message (if assistant)
  tokenCount     Int?         @map("token_count")
  metadata       Json?        // Additional metadata (e.g., streaming stats)
  timestamp      DateTime     @default(now())

  // Relations
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, timestamp])
  @@map("messages")
}
```

### Enhanced Upload Model

```prisma
model Upload {
  id           Int      @id @default(autoincrement())
  original_name String  @db.VarChar(255)
  stored_name  String   @unique @db.VarChar(255)
  path         String   @db.VarChar(500)
  size         Int      // File size in bytes
  mime_type    String   @db.VarChar(100)
  user_id      Int      @map("user_id")
  workspace_id Int?     @map("workspace_id")
  status       String   @default("uploaded") // uploaded, processing, processed, error
  metadata     Json?    // Additional metadata (analysis results, etc.)
  analysis     Json?    // AI analysis results
  error_message String? @db.Text @map("error_message")
  created_at   DateTime @default(now()) @map("created_at")
  processed_at DateTime? @map("processed_at")

  // Relations
  user        User           @relation(fields: [user_id], references: [id], onDelete: Cascade)
  workspace   Workspace?     @relation(fields: [workspace_id], references: [id], onDelete: SetNull)
  ingestJobs  RAGIngestJob[]

  @@index([user_id, created_at])
  @@index([workspace_id])
  @@index([status, user_id])
  @@index([stored_name])
  @@map("uploads")
}
```

### Migration Script

```sql
-- Add Conversation table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  model VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_created ON conversations(user_id, created_at);
CREATE INDEX idx_conversations_user_status ON conversations(user_id, status);

-- Add Message table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  model VARCHAR(100),
  token_count INTEGER,
  metadata JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_timestamp ON messages(conversation_id, timestamp);

-- Update Upload table (add new columns)
ALTER TABLE uploads
  ADD COLUMN analysis JSONB,
  ADD COLUMN error_message TEXT,
  ADD COLUMN processed_at TIMESTAMP;

CREATE INDEX idx_uploads_user_created ON uploads(user_id, created_at);
CREATE INDEX idx_uploads_status_user ON uploads(status, user_id);
```

---

## API Enhancements

### New Endpoints

#### Conversation CRUD

**POST /api/conversations**
- **Purpose:** Create a new conversation
- **Auth:** Required (JWT)
- **Request Body:**
  ```typescript
  {
    title?: string,
    model: string,
    initialMessage?: string
  }
  ```
- **Response:**
  ```typescript
  {
    success: true,
    data: {
      id: string,
      userId: number,
      title: string | null,
      model: string,
      status: string,
      createdAt: string,
      updatedAt: string
    }
  }
  ```
- **Rate Limit:** 50/hour per user

**GET /api/conversations**
- **Purpose:** List user's conversations
- **Auth:** Required (JWT)
- **Query Params:**
  - `page` (number, default: 1)
  - `limit` (number, default: 20, max: 100)
  - `status` (string, optional: "active" | "archived")
  - `search` (string, optional: search in titles)
- **Response:**
  ```typescript
  {
    success: true,
    data: Array<{
      id: string,
      title: string | null,
      model: string,
      messageCount: number,
      lastMessageAt: string,
      createdAt: string
    }>,
    meta: {
      total: number,
      page: number,
      limit: number,
      totalPages: number
    }
  }
  ```
- **Rate Limit:** 100/hour per user

**GET /api/conversations/:id**
- **Purpose:** Get specific conversation with messages
- **Auth:** Required (JWT, user must own conversation)
- **Response:**
  ```typescript
  {
    success: true,
    data: {
      id: string,
      title: string | null,
      model: string,
      status: string,
      messages: Array<{
        id: string,
        role: string,
        content: string,
        timestamp: string,
        tokenCount: number | null
      }>,
      createdAt: string,
      updatedAt: string
    }
  }
  ```
- **Rate Limit:** 200/hour per user

**PUT /api/conversations/:id**
- **Purpose:** Update conversation (title, status)
- **Auth:** Required (JWT, user must own conversation)
- **Request Body:**
  ```typescript
  {
    title?: string,
    status?: "active" | "archived"
  }
  ```
- **Response:**
  ```typescript
  {
    success: true,
    data: { id: string, title: string, status: string }
  }
  ```
- **Rate Limit:** 50/hour per user

**DELETE /api/conversations/:id**
- **Purpose:** Delete conversation (cascades to messages)
- **Auth:** Required (JWT, user must own conversation)
- **Response:**
  ```typescript
  {
    success: true,
    message: "Conversation deleted"
  }
  ```
- **Rate Limit:** 50/hour per user

**POST /api/conversations/:id/messages**
- **Purpose:** Add message to conversation
- **Auth:** Required (JWT, user must own conversation)
- **Request Body:**
  ```typescript
  {
    role: "user" | "assistant" | "system",
    content: string,
    tokenCount?: number,
    metadata?: Record<string, any>
  }
  ```
- **Response:**
  ```typescript
  {
    success: true,
    data: {
      id: string,
      conversationId: string,
      role: string,
      content: string,
      timestamp: string
    }
  }
  ```
- **Rate Limit:** 500/hour per user

#### Upload History

**GET /api/uploads**
- **Purpose:** List upload history
- **Auth:** Required (JWT)
- **Query Params:**
  - `page` (number, default: 1)
  - `limit` (number, default: 20, max: 100)
  - `status` (string, optional: "uploaded" | "processing" | "processed" | "error")
- **Response:**
  ```typescript
  {
    success: true,
    data: Array<{
      id: number,
      originalName: string,
      size: number,
      mimeType: string,
      status: string,
      createdAt: string,
      processedAt: string | null
    }>,
    meta: {
      total: number,
      page: number,
      limit: number,
      totalPages: number
    }
  }
  ```
- **Rate Limit:** 100/hour per user

**GET /api/uploads/:id**
- **Purpose:** Get upload details including analysis
- **Auth:** Required (JWT, user must own upload)
- **Response:**
  ```typescript
  {
    success: true,
    data: {
      id: number,
      originalName: string,
      storedName: string,
      size: number,
      mimeType: string,
      status: string,
      analysis: Record<string, any> | null,
      errorMessage: string | null,
      createdAt: string,
      processedAt: string | null
    }
  }
  ```
- **Rate Limit:** 200/hour per user

**DELETE /api/uploads/:id**
- **Purpose:** Delete upload and associated file
- **Auth:** Required (JWT, user must own upload)
- **Response:**
  ```typescript
  {
    success: true,
    message: "Upload deleted"
  }
  ```
- **Rate Limit:** 50/hour per user

### Error Codes

```typescript
// Common error codes
const ERROR_CODES = {
  UNAUTHORIZED: 'User not authenticated',
  FORBIDDEN: 'User does not have permission',
  NOT_FOUND: 'Resource not found',
  INVALID_INPUT: 'Invalid request parameters',
  RATE_LIMIT_EXCEEDED: 'Too many requests',
  SERVER_ERROR: 'Internal server error',

  // Conversation-specific
  CONVERSATION_NOT_FOUND: 'Conversation does not exist',
  INVALID_MODEL: 'Model not supported',
  MESSAGE_TOO_LONG: 'Message exceeds maximum length',

  // Upload-specific
  UPLOAD_NOT_FOUND: 'Upload does not exist',
  FILE_TOO_LARGE: 'File exceeds size limit',
  INVALID_FILE_TYPE: 'File type not supported',
  UPLOAD_FAILED: 'File upload failed'
}
```

---

## Testing Strategy

### Unit Tests

**Component Tests:**
- ChatInterface (already exists - 45 tests)
- FileUploadInterface (already exists - 39 tests)
- ConversationHistory (NEW - 15 tests)
  - Renders list of conversations
  - Search filters conversations
  - Pagination works correctly
  - Click conversation navigates to chat
- UploadHistory (NEW - 12 tests)
  - Renders list of uploads
  - Status filtering works
  - Pagination works correctly

**API Route Tests:**
- `/api/conversations` POST (NEW - 5 tests)
  - Creates conversation successfully
  - Requires authentication
  - Validates model parameter
  - Associates with correct user
- `/api/conversations` GET (NEW - 8 tests)
  - Lists user's conversations only
  - Pagination works correctly
  - Search filters by title
  - Status filter works
- `/api/conversations/:id` GET (NEW - 5 tests)
  - Returns conversation with messages
  - Returns 404 if not found
  - Returns 403 if user doesn't own it
- `/api/conversations/:id` DELETE (NEW - 4 tests)
  - Deletes conversation and messages
  - Returns 403 if user doesn't own it
  - Cascades to messages

**Database Model Tests:**
- Conversation model (NEW - 6 tests)
  - Creates with valid data
  - Validates required fields
  - Indexes work correctly
  - Cascades delete to messages
- Message model (NEW - 4 tests)
  - Creates with valid data
  - Links to conversation correctly

**Target:** Add 60-80 new tests, maintain overall coverage ≥25%

### Integration Tests

**End-to-End User Flows:**
- Complete chat conversation (NEW)
  - Create conversation → Send message → Receive response → Save
  - Verify database records created
  - Load conversation → Continue chat
- File upload and retrieval (NEW)
  - Upload file → Validate → Process → Save
  - Retrieve upload history → View details
  - Delete upload → Verify file removed

**API Integration:**
- Chat + Conversation persistence (NEW)
  - Send chat message → Auto-save to conversation
  - Verify message in database
  - Load conversation → Messages retrieved
- Upload + Analysis (existing, enhanced)
  - Upload file → AI analysis → Results saved
  - Verify upload record in database

**Database Integration:**
- Conversation CRUD operations (NEW)
  - Create, read, update, delete conversations
  - Transaction rollback on errors
- Upload history queries (NEW)
  - Pagination, filtering, sorting

**Target:** 20-30 integration tests

### E2E Tests (Playwright)

**Complete User Journeys:**
1. **Signup → Chat → Save Conversation** (NEW)
   - Sign up for account
   - Navigate to /chat
   - Select model
   - Send message
   - Receive streaming response
   - Navigate to /chat/history
   - Verify conversation appears
   - Click conversation → Verify it loads

2. **Login → Upload File → View History** (NEW)
   - Log in to account
   - Navigate to /upload
   - Drag and drop file
   - Verify progress bar
   - Wait for analysis results
   - Navigate to /upload/history
   - Verify upload appears
   - Click upload → Verify details

3. **Mobile Responsiveness** (NEW)
   - Test chat on mobile viewport
   - Test upload on mobile viewport
   - Verify navigation collapses correctly

**Cross-Browser Compatibility:**
- Chrome (primary)
- Firefox
- Safari (macOS)
- Mobile Safari (iOS)
- Mobile Chrome (Android)

**Performance Tests:**
- Lighthouse audit on /chat page
  - Target: Performance ≥90
  - Target: Accessibility ≥95
  - Target: Best Practices ≥90
- Lighthouse audit on /upload page
  - Same targets

**Target:** 15-20 E2E tests

---

## Security Considerations

### Authentication
- **Requirement:** User must be logged in for all chat/upload operations
- **Implementation:** Middleware checks JWT token on protected routes
- **Fallback:** Redirect to `/auth/login` if not authenticated
- **Session Management:** Use NextAuth.js sessions (already configured)

### Authorization
- **Principle:** Users only see their own data
- **Implementation:**
  - Database queries filter by `userId`
  - API routes verify ownership before returning/modifying data
  - Example: `WHERE user_id = ${session.user.id}`
- **Error Handling:** Return 403 Forbidden if user tries to access others' data

### Input Validation
- **Client-Side:** Basic validation for UX (file size, message length)
- **Server-Side:** Full validation with Zod schemas (required)
- **Examples:**
  - Message content: max 10,000 characters
  - Conversation title: max 255 characters
  - File upload: MIME type whitelist, max 10MB per file
- **SQL Injection:** Prevented by Prisma (parameterized queries)
- **XSS:** Prevented by React (auto-escaping)

### File Upload Security
- **Path Traversal:** Check filename for `..`, `/`, `\`
- **Null Bytes:** Reject filenames with `\0`
- **MIME Type:** Validate on server (don't trust client)
- **Storage:** Store files outside web root or use cloud storage
- **Scanning:** Consider antivirus scanning for production (ClamAV)

### Rate Limiting
- **Strategy:** Use Upstash Rate Limit (already available)
- **Limits:**
  - Chat: 100 messages/hour per user
  - Upload: 20 files/hour per user
  - API calls: 1000 requests/hour per IP
- **Implementation:**
  ```typescript
  import { ratelimit } from '@/lib/ratelimit'

  const { success } = await ratelimit.limit(`chat:${userId}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }
  ```

### CSRF Protection
- **Tokens:** Use CSRF tokens for state-changing operations
- **SameSite Cookies:** Set `SameSite=Strict` on session cookies
- **Double Submit:** Verify CSRF token in request matches cookie

### Content Security Policy (CSP)
- **Headers:** Set strict CSP headers
- **Nonce:** Use nonce for inline scripts
- **Allowlist:** Only allow trusted domains for scripts/styles

### Data Encryption
- **In Transit:** HTTPS only (enforced by Vercel)
- **At Rest:** Database encryption (managed by PostgreSQL provider)
- **Sensitive Data:** Hash passwords with bcrypt (already implemented)

---

## Performance Targets

### Response Times
- **Chat response time (non-streaming):** <100ms from button click to first token
- **Upload processing:** <5s for 10MB file (validation + storage)
- **Page load:** <2s for LCP (Largest Contentful Paint)
- **Database queries:** <50ms average (95th percentile <200ms)
- **API endpoints:** <200ms average response time

### Throughput
- **Concurrent users:** Support 100 simultaneous users
- **Chat messages:** Handle 10 messages/second
- **File uploads:** Handle 5 concurrent uploads
- **Database connections:** Max 10 connections in pool

### Resource Usage
- **Bundle size:** <500KB initial load (gzipped)
- **Memory usage:** <100MB per Node.js process
- **CPU usage:** <70% average during peak load
- **Database queries:** <100 queries/second

### Optimization Strategies
1. **Code Splitting:** Lazy load ChatInterface and FileUploadInterface
2. **Caching:**
   - Redis cache for conversation lists (5 min TTL)
   - Model list cached (1 hour TTL)
   - Static assets cached (1 year)
3. **Database Indexes:** All queries use indexed columns
4. **Connection Pooling:** Reuse Prisma Client connections
5. **CDN:** Serve static assets via Vercel Edge Network
6. **Image Optimization:** Use Next.js Image component
7. **Compression:** Gzip/Brotli for API responses

---

## Monitoring & Observability

### OpenTelemetry Traces
- **Instrumentation:** All API calls automatically traced (already configured)
- **Custom Spans:** Add spans for critical operations
  - `conversation.create`
  - `message.save`
  - `upload.process`
- **Attributes:** Include userId, conversationId, model, etc.

### User Action Tracking
- **Events to Track:**
  - `conversation_created` - User starts new conversation
  - `message_sent` - User sends message
  - `file_uploaded` - User uploads file
  - `conversation_loaded` - User loads past conversation
  - `export_triggered` - User exports conversation
- **Storage:** Use existing Event model in database
- **Example:**
  ```typescript
  await prisma.event.create({
    data: {
      user_id: userId,
      event_type: 'user_action',
      event_name: 'conversation_created',
      properties: { conversationId, model },
      created_at: new Date()
    }
  })
  ```

### Error Tracking
- **Tool:** Datadog Error Tracking (already configured)
- **Automatic:** All uncaught errors sent to Datadog
- **Custom:** Log critical errors explicitly
  ```typescript
  logger.error('Failed to save conversation', {
    error: err.message,
    stack: err.stack,
    userId,
    conversationId
  })
  ```

### Performance Metrics
- **Dashboard in Datadog:**
  - Chat usage: Messages/day, avg response time, error rate
  - Upload usage: Files/day, avg file size, processing time
  - API performance: P50, P95, P99 latency for each endpoint
  - Database performance: Query time, connection pool usage
- **Alerts:**
  - Chat response time >1s for 5 minutes
  - Upload error rate >5% for 10 minutes
  - Database connection pool >80% full
  - API error rate >2% for 5 minutes

### Health Checks
- **Endpoint:** `/api/health` (already exists)
- **Checks:**
  - Database connection
  - Redis connection
  - AI API availability (via `/api/ai/provider-health`)
- **Response:**
  ```json
  {
    "status": "healthy",
    "checks": {
      "database": "ok",
      "redis": "ok",
      "ai_providers": "ok"
    }
  }
  ```

---

## Timeline & Milestones

### Week 1-2: Basic Integration (Phase 2.1)
**Deliverable:** Working /chat and /upload pages with navigation

**Key Tasks:**
- Merge PRs #774 and #775
- Create route pages
- Build AppLayout with navigation
- Integration tests

**Milestone Criteria:**
- [ ] User can navigate to /chat and see ChatInterface
- [ ] User can navigate to /upload and see FileUploadInterface
- [ ] Navigation sidebar functional on desktop and mobile
- [ ] All integration tests passing

**Risk:** Merge conflicts from PRs → Mitigation: Merge PRs early, resolve conflicts immediately

---

### Week 3-4: Persistence (Phase 2.2)
**Deliverable:** Conversations and uploads saved to database

**Key Tasks:**
- Design and deploy database schema
- Build CRUD APIs for conversations
- Implement auto-save in ChatInterface
- Create conversation/upload history APIs

**Milestone Criteria:**
- [ ] Database schema deployed to staging and production
- [ ] Conversations auto-save after each message exchange
- [ ] GET /api/conversations returns user's conversations
- [ ] Upload history API functional
- [ ] All CRUD operations tested

**Risk:** Database migration failures → Mitigation: Test migrations on staging first, have rollback script ready

---

### Week 5-6: Enhanced Features (Phase 2.3)
**Deliverable:** History views, export, branching, batch upload

**Key Tasks:**
- Create history pages
- Implement conversation export (Markdown, JSON)
- Build conversation branching
- Add batch upload support
- Create settings page

**Milestone Criteria:**
- [ ] /chat/history displays conversation list with search
- [ ] User can export conversation in Markdown format
- [ ] Conversation branching creates new conversation correctly
- [ ] Batch upload handles up to 10 files
- [ ] Settings page allows default model selection

**Risk:** Feature creep, scope expansion → Mitigation: Stick to primary and secondary objectives, defer stretch goals to Phase 3

---

### Week 7-8: Testing & Production (Phase 2.4)
**Deliverable:** Production-ready deployment with full test coverage

**Key Tasks:**
- E2E testing with Playwright
- Performance optimization
- Security audit
- Deploy to production
- Monitor in production

**Milestone Criteria:**
- [ ] All E2E tests passing (15-20 tests)
- [ ] Lighthouse score ≥90 for performance
- [ ] Zero P0/P1 security vulnerabilities
- [ ] Deployed to production successfully
- [ ] No critical errors in first 24 hours

**Risk:** Production issues discovered late → Mitigation: Deploy to staging 1 week early, thorough QA testing

---

## Success Metrics

### Coverage & Quality
- **Test Coverage:** ≥25% overall (currently ~27%)
- **E2E Tests:** All 15-20 tests passing
- **Code Quality:** No ESLint errors, TypeScript strict mode
- **Accessibility:** WCAG 2.1 AA compliance

### Performance
- **Lighthouse Score:** Performance ≥90, Accessibility ≥95
- **Chat Response Time:** <100ms to first token
- **Upload Processing:** <5s for 10MB file
- **Page Load:** LCP <2s

### Security
- **Vulnerabilities:** Zero P0/P1 issues
- **Auth Coverage:** 100% of routes protected
- **Input Validation:** Server-side validation on all inputs
- **Rate Limiting:** Active on all API endpoints

### User Experience
- **Error Rate:** <2% for chat operations
- **Error Rate:** <5% for upload operations
- **Mobile Usability:** All features functional on mobile
- **Navigation:** Users can complete workflows without friction

### Business Metrics
- **Adoption:** 50% of users try chat feature in first week
- **Retention:** 30% of users return to chat after first use
- **Usage:** Avg 10 messages/user/day
- **Upload Usage:** Avg 2 uploads/user/week

---

## Risks & Mitigation

### 1. Database Migration Issues
**Risk Level:** High
**Impact:** Production downtime, data loss
**Likelihood:** Medium

**Mitigation:**
- Test migrations on staging environment first
- Create backup of production database before migration
- Have rollback script prepared
- Run migrations during low-traffic hours
- Monitor database health after migration

---

### 2. File Storage Costs
**Risk Level:** Medium
**Impact:** Unexpected cloud storage bills
**Likelihood:** High (if users upload many large files)

**Mitigation:**
- Set user quotas (max 100MB per user, 1GB per workspace)
- Implement automatic cleanup policy (delete files >90 days old)
- Monitor storage usage with Datadog alerts
- Offer paid plans with higher storage limits
- Use Vercel Blob with cost limits

---

### 3. API Rate Limits (OpenRouter, Anthropic)
**Risk Level:** High
**Impact:** Chat feature unavailable
**Likelihood:** Medium (during high traffic)

**Mitigation:**
- Implement client-side request queueing
- Show "Rate limit reached, please wait" message to user
- Cache model listings to reduce API calls
- Use multiple API keys for load balancing
- Monitor API usage with alerts

---

### 4. Streaming Reliability
**Risk Level:** Medium
**Impact:** Poor user experience
**Likelihood:** Medium (network issues, browser incompatibility)

**Mitigation:**
- Implement fallback to non-streaming mode
- Add reconnection logic with exponential backoff
- Show "Connection lost, retrying..." message
- Test streaming on multiple browsers
- Log streaming errors for debugging

---

### 5. Performance Degradation
**Risk Level:** Medium
**Impact:** Slow response times, poor UX
**Likelihood:** Medium (as database grows)

**Mitigation:**
- Implement database indexes on all query columns
- Use Redis caching for frequently accessed data
- Monitor query performance with Datadog APM
- Set up alerts for slow queries (>200ms)
- Optimize queries based on real usage patterns

---

### 6. Security Vulnerabilities
**Risk Level:** High
**Impact:** Data breach, unauthorized access
**Likelihood:** Low (with proper precautions)

**Mitigation:**
- Run `npm audit` before each deployment
- Implement rate limiting on all endpoints
- Use Zod validation on all inputs
- Run OWASP Top 10 checks
- Conduct security review before production deploy

---

### 7. User Data Privacy
**Risk Level:** High
**Impact:** Compliance violations (GDPR, CCPA)
**Likelihood:** Low (with proper handling)

**Mitigation:**
- Implement data deletion API (user can delete conversations)
- Add "Export my data" feature (JSON download)
- Include privacy policy link on all pages
- Log data access for audit trail
- Encrypt sensitive data at rest

---

### 8. Conversation Context Limits
**Risk Level:** Medium
**Impact:** AI responses degrade quality in long conversations
**Likelihood:** High (for power users)

**Mitigation:**
- Implement token counting for conversation history
- Truncate old messages when context limit reached
- Show "Context limit approaching" warning
- Offer conversation branching to start fresh
- Document context limits in user guide

---

## Next Steps

### Immediate Actions (This Week)
1. **Review and approve this plan** - Stakeholders review and sign off
2. **Create Phase 2.1 epic in project management** - Jira/Linear/GitHub Projects
3. **Break down into individual tasks** - Detailed task list for each week
4. **Assign to development team** - Allocate engineers to tasks
5. **Set up staging environment** - Prepare for deployment testing

### Pre-Implementation Checklist
- [ ] PRs #774 and #775 reviewed and ready to merge
- [ ] Database backup strategy confirmed
- [ ] Staging environment provisioned
- [ ] OpenTelemetry instrumentation tested
- [ ] Rate limiting library configured
- [ ] Security review scheduled for Week 7

### Phase 2.1 Kickoff (Week 1)
- [ ] Merge PR #774 (ChatInterface)
- [ ] Merge PR #775 (FileUploadInterface)
- [ ] Create `/chat` route file
- [ ] Create `/upload` route file
- [ ] Design AppLayout component (wireframes)
- [ ] Set up integration test suite

### Communication Plan
- **Daily Standups:** Team syncs on progress and blockers
- **Weekly Demos:** Show working features to stakeholders
- **Milestone Reviews:** Review deliverables at end of each 2-week phase
- **Documentation Updates:** Keep this plan updated as scope changes

### Success Tracking
- **Metrics Dashboard:** Datadog dashboard for all key metrics
- **Test Coverage Report:** Weekly coverage reports
- **User Feedback:** Collect feedback from beta users in Week 5-6
- **Performance Monitoring:** Lighthouse audits every Friday

---

## Appendices

### A. Related Documentation
- [ChatInterface Component (PR #774)](https://github.com/vibecode/vibecode-webgui/pull/774)
- [FileUploadInterface Component (PR #775)](https://github.com/vibecode/vibecode-webgui/pull/775)
- [AI Chat API Documentation](./api/ai-chat-api.md)
- [File Upload API Documentation](./api/file-upload-api.md)
- [Database Schema Documentation](./database/schema.md)

### B. Tech Stack Reference
- **Framework:** Next.js 15.0+ (App Router)
- **Language:** TypeScript 5.3+
- **UI Library:** React 19.0+
- **Styling:** Tailwind CSS 4.0+
- **Component Library:** ShadcN UI (Radix UI primitives)
- **Database:** PostgreSQL 15+ with Prisma 6.0+
- **Authentication:** NextAuth.js 4.24+
- **Caching:** Redis (Upstash)
- **Monitoring:** Datadog APM + OpenTelemetry
- **Deployment:** Vercel (production), Docker (local)

### C. Code Style Guide
- **React Components:** Functional components with hooks
- **Naming:** camelCase for variables, PascalCase for components
- **File Structure:** Co-locate tests with components
- **Comments:** JSDoc for all exported functions
- **Formatting:** Prettier with 2-space indents
- **Linting:** ESLint with TypeScript rules

### D. Glossary
- **LCP:** Largest Contentful Paint (performance metric)
- **SSE:** Server-Sent Events (streaming protocol)
- **CRUD:** Create, Read, Update, Delete (database operations)
- **E2E:** End-to-End (testing methodology)
- **JWT:** JSON Web Token (authentication)
- **CSRF:** Cross-Site Request Forgery (security attack)
- **WCAG:** Web Content Accessibility Guidelines

### E. Contact Information
- **Project Lead:** TBD
- **Lead Developer:** TBD
- **Security Lead:** TBD
- **QA Lead:** TBD
- **DevOps:** TBD

---

**Document End**

*This plan will be updated as Phase 2 progresses. All changes will be tracked in version control.*

**Last Updated:** 2026-01-12
**Next Review:** 2026-01-19 (Week 1 completion)
