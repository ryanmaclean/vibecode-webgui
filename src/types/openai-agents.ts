/**
 * TypeScript type definitions for OpenAI Agents API
 * Provides comprehensive type safety for Agent creation, management, and interactions
 */

// Core Agent Types
export interface AgentConfig {
  model: string
  name: string
  instructions: string
  tools?: Tool[]
  tool_resources?: ToolResources
  metadata?: Record<string, string>
  temperature?: number
  top_p?: number
  response_format?: ResponseFormat
}

export interface Agent {
  id: string
  object: 'assistant'
  created_at: number
  name: string | null
  description: string | null
  model: string
  instructions: string | null
  tools: Tool[]
  tool_resources: ToolResources | null
  metadata: Record<string, string>
  temperature: number | null
  top_p: number | null
  response_format: ResponseFormat | null
}

// Tool Types
export type ToolType = 'code_interpreter' | 'file_search' | 'function'

export interface CodeInterpreterTool {
  type: 'code_interpreter'
}

export interface FileSearchTool {
  type: 'file_search'
  file_search?: {
    max_num_results?: number
    ranking_options?: {
      score_threshold?: number
      ranker?: 'auto' | 'default_2024_08_21'
    }
  }
}

export interface FunctionTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
    strict?: boolean
  }
}

export type Tool = CodeInterpreterTool | FileSearchTool | FunctionTool

export interface ToolResources {
  code_interpreter?: {
    file_ids?: string[]
  }
  file_search?: {
    vector_store_ids?: string[]
  }
}

// Thread Types
export interface Thread {
  id: string
  object: 'thread'
  created_at: number
  metadata: Record<string, string>
  tool_resources: ToolResources | null
}

export interface ThreadCreateParams {
  messages?: ThreadMessageCreateParams[]
  metadata?: Record<string, string>
  tool_resources?: ToolResources
}

// Message Types
export interface ThreadMessage {
  id: string
  object: 'thread.message'
  created_at: number
  thread_id: string
  role: 'user' | 'assistant'
  content: MessageContent[]
  assistant_id: string | null
  run_id: string | null
  attachments: MessageAttachment[] | null
  metadata: Record<string, string>
}

export interface ThreadMessageCreateParams {
  role: 'user' | 'assistant'
  content: string | MessageContent[]
  attachments?: MessageAttachment[]
  metadata?: Record<string, string>
}

export type MessageContent =
  | TextContent
  | ImageFileContent
  | ImageUrlContent
  | FilePathContent

export interface TextContent {
  type: 'text'
  text: {
    value: string
    annotations: Annotation[]
  }
}

export interface ImageFileContent {
  type: 'image_file'
  image_file: {
    file_id: string
    detail?: 'auto' | 'low' | 'high'
  }
}

export interface ImageUrlContent {
  type: 'image_url'
  image_url: {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }
}

export interface FilePathContent {
  type: 'file_path'
  file_path: {
    file_id: string
  }
}

export interface MessageAttachment {
  file_id: string
  tools: Tool[]
}

export type Annotation = FileCitationAnnotation | FilePathAnnotation

export interface FileCitationAnnotation {
  type: 'file_citation'
  text: string
  file_citation: {
    file_id: string
    quote: string
  }
  start_index: number
  end_index: number
}

export interface FilePathAnnotation {
  type: 'file_path'
  text: string
  file_path: {
    file_id: string
  }
  start_index: number
  end_index: number
}

// Run Types
export interface Run {
  id: string
  object: 'thread.run'
  created_at: number
  thread_id: string
  assistant_id: string
  status: RunStatus
  required_action: RequiredAction | null
  last_error: RunError | null
  expires_at: number
  started_at: number | null
  cancelled_at: number | null
  failed_at: number | null
  completed_at: number | null
  incomplete_details: IncompleteDetails | null
  model: string
  instructions: string | null
  tools: Tool[]
  metadata: Record<string, string>
  usage: RunUsage | null
  temperature: number | null
  top_p: number | null
  max_prompt_tokens: number | null
  max_completion_tokens: number | null
  truncation_strategy: TruncationStrategy | null
  response_format: ResponseFormat | null
  tool_choice: ToolChoice | null
}

export type RunStatus =
  | 'queued'
  | 'in_progress'
  | 'requires_action'
  | 'cancelling'
  | 'cancelled'
  | 'failed'
  | 'completed'
  | 'expired'

export interface RunCreateParams {
  assistant_id: string
  model?: string
  instructions?: string
  additional_instructions?: string
  additional_messages?: ThreadMessageCreateParams[]
  tools?: Tool[]
  metadata?: Record<string, string>
  temperature?: number
  top_p?: number
  stream?: boolean
  max_prompt_tokens?: number
  max_completion_tokens?: number
  truncation_strategy?: TruncationStrategy
  tool_choice?: ToolChoice
  response_format?: ResponseFormat
}

export interface RequiredAction {
  type: 'submit_tool_outputs'
  submit_tool_outputs: {
    tool_calls: ToolCall[]
  }
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolOutput {
  tool_call_id: string
  output: string
}

export interface RunError {
  code: string
  message: string
}

export interface IncompleteDetails {
  reason: 'max_completion_tokens' | 'max_prompt_tokens'
}

export interface RunUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface TruncationStrategy {
  type: 'auto' | 'last_messages'
  last_messages?: number
}

export type ToolChoice = 'none' | 'auto' | 'required' | ToolChoiceFunction

export interface ToolChoiceFunction {
  type: 'function'
  function: {
    name: string
  }
}

export type ResponseFormat =
  | { type: 'text' }
  | { type: 'json_object' }
  | { type: 'json_schema'; json_schema: JsonSchema }

export interface JsonSchema {
  name: string
  description?: string
  schema: Record<string, unknown>
  strict?: boolean
}

// File Types
export interface FileObject {
  id: string
  object: 'file'
  bytes: number
  created_at: number
  filename: string
  purpose: FilePurpose
  status: 'uploaded' | 'processed' | 'error'
  status_details?: string
}

export type FilePurpose =
  | 'assistants'
  | 'assistants_output'
  | 'batch'
  | 'fine-tune'
  | 'vision'

// Vector Store Types
export interface VectorStore {
  id: string
  object: 'vector_store'
  created_at: number
  name: string
  usage_bytes: number
  file_counts: {
    in_progress: number
    completed: number
    failed: number
    cancelled: number
    total: number
  }
  status: 'expired' | 'in_progress' | 'completed'
  expires_after?: ExpiresAfter
  expires_at?: number
  last_active_at: number | null
  metadata: Record<string, string>
}

export interface ExpiresAfter {
  anchor: 'last_active_at'
  days: number
}

// Streaming Types
export interface StreamEvent {
  event: string
  data: string
}

export type RunStreamEvent =
  | { event: 'thread.run.created'; data: Run }
  | { event: 'thread.run.queued'; data: Run }
  | { event: 'thread.run.in_progress'; data: Run }
  | { event: 'thread.run.requires_action'; data: Run }
  | { event: 'thread.run.completed'; data: Run }
  | { event: 'thread.run.failed'; data: Run }
  | { event: 'thread.run.cancelling'; data: Run }
  | { event: 'thread.run.cancelled'; data: Run }
  | { event: 'thread.run.expired'; data: Run }
  | { event: 'thread.run.step.created'; data: RunStep }
  | { event: 'thread.run.step.in_progress'; data: RunStep }
  | { event: 'thread.run.step.completed'; data: RunStep }
  | { event: 'thread.run.step.failed'; data: RunStep }
  | { event: 'thread.message.created'; data: ThreadMessage }
  | { event: 'thread.message.in_progress'; data: ThreadMessage }
  | { event: 'thread.message.completed'; data: ThreadMessage }
  | { event: 'thread.message.delta'; data: MessageDelta }

export interface RunStep {
  id: string
  object: 'thread.run.step'
  created_at: number
  assistant_id: string
  thread_id: string
  run_id: string
  type: 'message_creation' | 'tool_calls'
  status: RunStatus
  step_details: StepDetails
  last_error: RunError | null
  expired_at: number | null
  cancelled_at: number | null
  failed_at: number | null
  completed_at: number | null
  metadata: Record<string, string>
  usage: RunUsage | null
}

export type StepDetails = MessageCreationStepDetails | ToolCallsStepDetails

export interface MessageCreationStepDetails {
  type: 'message_creation'
  message_creation: {
    message_id: string
  }
}

export interface ToolCallsStepDetails {
  type: 'tool_calls'
  tool_calls: ToolCall[]
}

export interface MessageDelta {
  id: string
  object: 'thread.message.delta'
  delta: {
    role?: 'user' | 'assistant'
    content?: MessageContent[]
  }
}

// API Response Types
export interface ListResponse<T> {
  object: 'list'
  data: T[]
  first_id: string | null
  last_id: string | null
  has_more: boolean
}

export interface DeleteResponse {
  id: string
  object: string
  deleted: boolean
}

// Error Types
export interface APIError {
  error: {
    message: string
    type: string
    param: string | null
    code: string | null
  }
}

// Webhook Event Types
export interface WebhookEvent {
  id: string
  object: 'event'
  created: number
  type: string
  data: Record<string, unknown>
}

// Client Configuration
export interface OpenAIAgentsConfig {
  apiKey: string
  organization?: string
  baseURL?: string
  timeout?: number
  maxRetries?: number
  defaultHeaders?: Record<string, string>
}

// Tool Registry Types
export interface RegisteredTool {
  definition: FunctionTool
  handler: ToolHandler
  metadata?: {
    category?: string
    tags?: string[]
    rateLimit?: {
      maxCalls: number
      windowMs: number
    }
  }
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>

// Thread Manager Types
export interface ThreadSession {
  threadId: string
  assistantId: string
  userId: string
  createdAt: Date
  lastActiveAt: Date
  metadata: Record<string, string>
}

export interface ConversationContext {
  threadId: string
  messages: ThreadMessage[]
  vectorStoreIds?: string[]
  fileIds?: string[]
}
