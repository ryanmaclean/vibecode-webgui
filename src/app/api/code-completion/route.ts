import { createHmac, createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { createServiceLogger } from '@/lib/logging'
import { z } from '@/lib/zod-compat'
import { validateRequestBody } from '@/lib/api/validation/middleware'
import { loadSecret } from '@/lib/security/macos-keychain-server'
import { fetchWithRetry } from '@/lib/utils/fetch'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'code-completion' });

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(30) // 30 req/min for AI endpoints

// Code completion request validation schema
const codeCompletionSchema = z.object({
  completionMetadata: z.object({
    language: z.string().min(1).max(50).optional(),
    filename: z.string().max(255).optional(),
    technologies: z.array(z.string()).max(20).optional(),
    relatedFiles: z.array(z.object({
      path: z.string().max(500),
      content: z.string().max(10000)
    })).max(10).optional(),
    textBeforeCursor: z.string().max(5000).optional(),
    textAfterCursor: z.string().max(5000).optional()
  }).optional(),
  provider: z.string().min(1).max(50).optional(),
  model: z.string().min(1).max(100).optional()
})

type CompletionMetadata = {
  language?: string
  filename?: string
  technologies?: string[]
  relatedFiles?: Array<{ path: string; content: string }>
  textBeforeCursor?: string
  textAfterCursor?: string
}

type CompletionRequestBody = {
  completionMetadata?: CompletionMetadata
  provider?: string
  model?: string
}

type CompletionResult = {
  completion: string | null
  raw?: unknown
}

const DEFAULT_PROVIDER = (process.env.AI_COMPLETION_PROVIDER || 'openai').toLowerCase()
const DEFAULT_MODEL = process.env.AI_COMPLETION_MODEL || 'gpt-4o-mini'
const DEFAULT_MAX_TOKENS = Number(process.env.AI_COMPLETION_MAX_TOKENS || '512')
const CURSOR_MARKER = '<cursor>'
const SYSTEM_PROMPT =
  'You are an expert pair programmer. Return only the code to insert at the cursor with no additional commentary.'
const REQUEST_TIMEOUT_MS = Number(process.env.AI_COMPLETION_REQUEST_TIMEOUT_MS || '45000')
const REQUEST_RETRY_COUNT = Number(process.env.AI_COMPLETION_REQUEST_RETRIES || '2')
const REQUEST_RETRY_DELAY_MS = Number(process.env.AI_COMPLETION_RETRY_DELAY_MS || '1000')

type CompletionRequestInit = RequestInit & {
  timeout?: number
  retries?: number
  retryDelay?: number
}

function fetchLLM(input: RequestInfo | URL, init: CompletionRequestInit = {}) {
  const { timeout, retries, retryDelay, ...rest } = init

  return fetchWithRetry(input, {
    failOnNonOk: false,
    timeout: timeout ?? REQUEST_TIMEOUT_MS,
    retries: retries ?? REQUEST_RETRY_COUNT,
    retryDelay: retryDelay ?? REQUEST_RETRY_DELAY_MS,
    ...rest,
  })
}

const AVAILABLE_PROVIDERS = [
  'openai',
  'codex',
  'gemini',
  'gemini-cli',
  'opencode',
  'openrouter',
  'claude',
  'anthropic',
  'aider',
  'goose',
  'project4',
  'deepseek',
  'google',
  'azure-openai',
  'bedrock',
  'vertex',
]

function ensureMetadata(body: CompletionRequestBody): CompletionMetadata {
  if (!body || typeof body !== 'object' || !body.completionMetadata) {
    throw new Error('Missing completion metadata')
  }

  return body.completionMetadata
}

function truncateSegment(text: string | undefined, maxChars = 6000, keepEnd = false): string {
  if (!text) {
    return ''
  }

  if (text.length <= maxChars) {
    return text
  }

  return keepEnd ? text.slice(-maxChars) : text.slice(0, maxChars)
}

function buildUserPrompt(metadata: CompletionMetadata): string {
  const language = metadata.language || 'plaintext'
  const filename = metadata.filename ? `\nFile: ${metadata.filename}` : ''
  const technologies = metadata.technologies && metadata.technologies.length > 0
    ? metadata.technologies.join(', ')
    : 'unspecified'

  const relatedFiles = metadata.relatedFiles && metadata.relatedFiles.length > 0
    ? metadata.relatedFiles
        .map((file) => `### ${file.path}\n${file.content}`)
        .join('\n\n')
    : ''

  const before = truncateSegment(metadata.textBeforeCursor, 6000, true)
  const after = truncateSegment(metadata.textAfterCursor, 2000, false)

  const sections = [
    relatedFiles ? `# Related Files\n${relatedFiles}` : '',
    `# Context\nLanguage: ${language}${filename}\nTech stack: ${technologies}`,
    '# Current File\n```\n' + before + CURSOR_MARKER + after + '\n```',
    `# Task\nWrite the next code that should appear at ${CURSOR_MARKER}. Do not repeat existing code and do not include explanations.`,
  ].filter(Boolean)

  return sections.join('\n\n')
}

type OpenAICompatOptions = {
  apiKey?: string
  baseURL?: string
  modelFallback?: string
  providerLabel?: string
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string | null
      }>
    }
  }>
}

type OpenRouterMessagePart = {
  text?: string | null
  content?: string | null
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | OpenRouterMessagePart[] | null
    }
  }>
}

type ClaudeMessageResponse = {
  content?: Array<{
    text?: string | null
  }>
}

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

type AzureOpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

type BedrockInvokeResponse = {
  content?: Array<{
    text?: string | null
  }>
  outputText?: string | null
}

async function callOpenAI(
  metadata: CompletionMetadata,
  provider: 'openai' | 'codex',
  modelOverride?: string,
  options: OpenAICompatOptions = {},
): Promise<CompletionResult> {
  const defaultKey = provider === 'codex' ? process.env.CODEX_API_KEY : process.env.OPENAI_API_KEY
  const apiKey = options.apiKey || defaultKey
  const baseURL = options.baseURL || process.env.OPENAI_API_BASE
  const label = options.providerLabel || (provider === 'codex' ? 'Codex' : 'OpenAI')

  if (!apiKey) {
    throw new Error(`${label} API key is required for provider ${provider}`)
  }

  const client = new OpenAI({ apiKey, baseURL })
  const model = modelOverride || options.modelFallback || DEFAULT_MODEL
  const response = await client.responses.create({
    model,
    input: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(metadata) },
    ],
    temperature: Number(process.env.AI_COMPLETION_TEMPERATURE || '0.2'),
    max_output_tokens: Number(process.env.AI_COMPLETION_MAX_TOKENS || DEFAULT_MAX_TOKENS),
  })

  const text = response.output_text?.trim()
  return {
    completion: text?.length ? text : null,
    raw: response,
  }
}

async function callGemini(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY (or GOOGLE_API_KEY) is required for Gemini provider')
  }

  const model = modelOverride || process.env.GEMINI_MODEL || 'gemini-1.5-pro-latest'
  const base = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta'
  const url = `${base}/models/${model}:generateContent?key=${apiKey}`

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(metadata)}` }],
      },
    ],
    generationConfig: {
      temperature: Number(process.env.AI_COMPLETION_TEMPERATURE || '0.2'),
      maxOutputTokens: Number(process.env.AI_COMPLETION_MAX_TOKENS || DEFAULT_MAX_TOKENS),
    },
  }

  const response = await fetchLLM(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    throw new Error(`Gemini request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  const data = (await response.json()) as GeminiGenerateContentResponse
  const completion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null

  return {
    completion,
    raw: data,
  }
}

async function callGeminiCli(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  const apiKey =
    process.env.GEMINI_CLI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_CLI_API_KEY (or GEMINI_API_KEY/GOOGLE_API_KEY) is required for gemini-cli provider')
  }

  const model = modelOverride || process.env.GEMINI_CLI_MODEL || process.env.GEMINI_MODEL || 'gemini-1.5-pro-latest'
  const base = process.env.GEMINI_CLI_API_BASE || process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta'
  const url = `${base}/models/${model}:generateContent?key=${apiKey}`

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(metadata)}` }],
      },
    ],
    generationConfig: {
      temperature: Number(process.env.AI_COMPLETION_TEMPERATURE || '0.2'),
      maxOutputTokens: Number(process.env.AI_COMPLETION_MAX_TOKENS || DEFAULT_MAX_TOKENS),
    },
  }

  const response = await fetchLLM(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    throw new Error(`Gemini CLI request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  const data = (await response.json()) as GeminiGenerateContentResponse
  const completion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null

  return {
    completion,
    raw: data,
  }
}

async function callOpenCode(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  const apiKey = process.env.OPENCODE_API_KEY || process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENCODE_API_KEY (or OPENROUTER_API_KEY) is required for OpenCode provider')
  }

  const baseUrl = process.env.OPENCODE_API_BASE || 'https://openrouter.ai/api/v1'
  const model = modelOverride || process.env.OPENCODE_MODEL || 'anthropic/claude-3.5-sonnet'
  const url = `${baseUrl}/chat/completions`

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(metadata) },
    ],
    temperature: Number(process.env.AI_COMPLETION_TEMPERATURE || '0.2'),
    max_tokens: Number(process.env.AI_COMPLETION_MAX_TOKENS || DEFAULT_MAX_TOKENS),
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  if (process.env.OPENROUTER_HTTP_REFERER) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER
  }

  if (process.env.OPENROUTER_APP_TITLE) {
    headers['X-Title'] = process.env.OPENROUTER_APP_TITLE
  }

  const response = await fetchLLM(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    throw new Error(`OpenCode request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  const data = (await response.json()) as OpenRouterResponse
  const completion = extractOpenRouterCompletion(data)

  return {
    completion: completion && completion.length ? completion : null,
    raw: data,
  }
}

async function callClaude(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  const apiKey = loadSecret('CLAUDE_CODE_API_KEY') || loadSecret('ANTHROPIC_API_KEY') || 
                 process.env.CLAUDE_CODE_API_KEY || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('CLAUDE_CODE_API_KEY (or ANTHROPIC_API_KEY) is required for Claude provider. Set in keychain or environment variable.')
  }

  const model = modelOverride || process.env.CLAUDE_CODE_MODEL || 'claude-3.5-sonnet-20240620'
  const body = {
    model,
    max_tokens: Number(process.env.AI_COMPLETION_MAX_TOKENS || DEFAULT_MAX_TOKENS),
    temperature: Number(process.env.AI_COMPLETION_TEMPERATURE || '0.2'),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: buildUserPrompt(metadata) }],
      },
    ],
  }

  const response = await fetchLLM(process.env.CLAUDE_API_BASE || 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': process.env.CLAUDE_API_VERSION || '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    throw new Error(`Claude request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  const data = (await response.json()) as ClaudeMessageResponse
  const completion = data.content?.[0]?.text?.trim() ?? null

  return {
    completion,
    raw: data,
  }
}

async function callAider(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  return callOpenAI(metadata, 'openai', modelOverride || process.env.AIDER_MODEL, {
    apiKey: process.env.AIDER_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.AIDER_API_BASE || process.env.OPENAI_API_BASE,
    modelFallback: process.env.AIDER_MODEL || DEFAULT_MODEL,
    providerLabel: 'Aider',
  })
}

async function callGoose(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  const baseURL = process.env.GOOSE_API_BASE || 'https://api.goose.ai/v1'
  return callOpenAI(metadata, 'openai', modelOverride || process.env.GOOSE_MODEL, {
    apiKey: process.env.GOOSE_API_KEY || process.env.OPENAI_API_KEY,
    baseURL,
    modelFallback: process.env.GOOSE_MODEL || DEFAULT_MODEL,
    providerLabel: 'GooseAI',
  })
}

async function callProject4(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  const baseURL = process.env.PROJECT4_API_BASE || 'https://api.project4.ai/v1'
  return callOpenAI(metadata, 'openai', modelOverride || process.env.PROJECT4_MODEL, {
    apiKey: process.env.PROJECT4_API_KEY || process.env.OPENAI_API_KEY,
    baseURL,
    modelFallback: process.env.PROJECT4_MODEL || DEFAULT_MODEL,
    providerLabel: 'Project4',
  })
}

async function callOpenRouter(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENCODE_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY (or OPENCODE_API_KEY) is required for openrouter provider')
  }

  const model =
    modelOverride ||
    process.env.OPENROUTER_MODEL ||
    process.env.OPENCODE_MODEL ||
    'anthropic/claude-3.5-sonnet'

  const baseUrl = process.env.OPENROUTER_API_BASE || process.env.OPENCODE_API_BASE || 'https://openrouter.ai/api/v1'
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(metadata) },
    ],
    temperature: Number(process.env.AI_COMPLETION_TEMPERATURE || '0.2'),
    max_tokens: Number(process.env.AI_COMPLETION_MAX_TOKENS || DEFAULT_MAX_TOKENS),
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  if (process.env.OPENROUTER_HTTP_REFERER) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER
  }

  if (process.env.OPENROUTER_APP_TITLE) {
    headers['X-Title'] = process.env.OPENROUTER_APP_TITLE
  }

  const response = await fetchLLM(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    throw new Error(`OpenRouter request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  const data = (await response.json()) as OpenRouterResponse
  const completion = extractOpenRouterCompletion(data)

  return {
    completion: completion && completion.length ? completion : null,
    raw: data,
  }
}

async function callAnthropicDirect(
  metadata: CompletionMetadata,
  modelOverride?: string,
): Promise<CompletionResult> {
  const apiKey = loadSecret('ANTHROPIC_API_KEY') || loadSecret('CLAUDE_CODE_API_KEY') ||
                 process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY (or CLAUDE_CODE_API_KEY) is required for anthropic provider. Set in keychain or environment variable.')
  }

  return callClaude(metadata, modelOverride || process.env.ANTHROPIC_MODEL)
}

async function callDeepSeek(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is required for deepseek provider')
  }

  const model = modelOverride || process.env.DEEPSEEK_MODEL || 'deepseek-coder'
  const base = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com'
  const url = `${base.replace(/\/$/, '')}/v1/chat/completions`

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(metadata) },
    ],
    temperature: Number(process.env.AI_COMPLETION_TEMPERATURE || '0.2'),
    max_tokens: Number(process.env.AI_COMPLETION_MAX_TOKENS || DEFAULT_MAX_TOKENS),
  }

  const response = await fetchLLM(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    throw new Error(`DeepSeek request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  const data = (await response.json()) as DeepSeekChatResponse
  const completion = data.choices?.[0]?.message?.content?.trim() ?? null

  return {
    completion,
    raw: data,
  }
}

async function callGoogle(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error('GOOGLE_API_KEY (or GEMINI_API_KEY) is required for google provider')
  }

  return callGemini(metadata, modelOverride || process.env.GOOGLE_MODEL)
}

async function callAzureOpenAI(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
  if (!apiKey || !endpoint || !deployment) {
    throw new Error('AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT are required for azure-openai provider')
  }

  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview'
  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(metadata) },
  ]

  const body = {
    messages,
    temperature: Number(process.env.AI_COMPLETION_TEMPERATURE || '0.2'),
    max_tokens: Number(process.env.AI_COMPLETION_MAX_TOKENS || DEFAULT_MAX_TOKENS),
    model: modelOverride || process.env.AZURE_OPENAI_MODEL || undefined,
  }

  const response = await fetchLLM(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    throw new Error(`Azure OpenAI request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  const data = (await response.json()) as AzureOpenAIChatResponse
  const completion = data.choices?.[0]?.message?.content?.trim() ?? null

  return {
    completion,
    raw: data,
  }
}

async function callBedrock(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  const accessKey = process.env.AWS_BEDROCK_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
  const secretKey = process.env.AWS_BEDROCK_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
  const sessionToken = process.env.AWS_BEDROCK_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN
  const region = process.env.AWS_BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1'
  const modelId = modelOverride || process.env.AWS_BEDROCK_MODEL || 'anthropic.claude-3-sonnet-20240229-v1:0'

  if (!accessKey || !secretKey) {
    throw new Error('AWS_BEDROCK_ACCESS_KEY_ID/AWS_ACCESS_KEY_ID and AWS_BEDROCK_SECRET_ACCESS_KEY/AWS_SECRET_ACCESS_KEY are required for bedrock provider')
  }

  const host = `bedrock-runtime.${region}.amazonaws.com`
  const path = `/model/${encodeURIComponent(modelId)}/invoke`
  const url = `https://${host}${path}`

  const body = JSON.stringify({
    anthropic_version: process.env.AWS_BEDROCK_ANTHROPIC_VERSION || 'bedrock-2023-06-01',
    max_tokens: Number(process.env.AI_COMPLETION_MAX_TOKENS || DEFAULT_MAX_TOKENS),
    temperature: Number(process.env.AI_COMPLETION_TEMPERATURE || '0.2'),
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(metadata)}` }],
      },
    ],
  })

  const contentType = 'application/json'
  const { authorization, amzDate, securityTokenHeader } = signAwsRequest({
    method: 'POST',
    service: 'bedrock',
    region,
    host,
    path,
    contentType,
    body,
    accessKey,
    secretKey,
    sessionToken,
  })

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    Authorization: authorization,
    'X-Amz-Date': amzDate,
  }

  if (securityTokenHeader) {
    headers['X-Amz-Security-Token'] = securityTokenHeader
  }

  const response = await fetchLLM(url, {
    method: 'POST',
    headers,
    body,
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    throw new Error(`Bedrock request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  const data = (await response.json()) as BedrockInvokeResponse
  const completion =
    data.content?.[0]?.text?.trim() ?? data.outputText?.trim() ?? null

  return {
    completion,
    raw: data,
  }
}

async function callVertex(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  const accessToken = process.env.GOOGLE_VERTEX_ACCESS_TOKEN
  const projectId = process.env.GOOGLE_VERTEX_PROJECT_ID
  const location = process.env.GOOGLE_VERTEX_LOCATION || 'us-central1'

  if (!accessToken || !projectId) {
    throw new Error('GOOGLE_VERTEX_ACCESS_TOKEN and GOOGLE_VERTEX_PROJECT_ID are required for vertex provider')
  }

  const model = modelOverride || process.env.GOOGLE_VERTEX_MODEL || 'gemini-1.5-pro'
  const endpoint = process.env.GOOGLE_VERTEX_API_BASE || `${location}-aiplatform.googleapis.com`
  const url = `https://${endpoint.replace(/\/$/, '')}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(metadata)}` }],
      },
    ],
    generationConfig: {
      temperature: Number(process.env.AI_COMPLETION_TEMPERATURE || '0.2'),
      maxOutputTokens: Number(process.env.AI_COMPLETION_MAX_TOKENS || DEFAULT_MAX_TOKENS),
    },
  }

  const response = await fetchLLM(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    throw new Error(`Vertex request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  const data = (await response.json()) as GeminiGenerateContentResponse
  const completion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null

  return {
    completion,
    raw: data,
  }
}

type AwsSignatureOptions = {
  method: 'POST'
  service: 'bedrock'
  region: string
  host: string
  path: string
  contentType: string
  body: string
  accessKey: string
  secretKey: string
  sessionToken?: string
}

function signAwsRequest(options: AwsSignatureOptions) {
  const { method, service, region, host, path, contentType, body, accessKey, secretKey, sessionToken } = options

  const now = new Date()
  const amzDate = toAmzDate(now)
  const dateStamp = toDateStamp(now)
  const payloadHash = sha256Hex(body)

  let canonicalHeaders = `content-type:${contentType}\n`
  canonicalHeaders += `host:${host}\n`
  if (sessionToken) {
    canonicalHeaders += `x-amz-security-token:${sessionToken}\n`
  }
  canonicalHeaders += `x-amz-date:${amzDate}\n`

  const signedHeaders = sessionToken
    ? 'content-type;host;x-amz-date;x-amz-security-token'
    : 'content-type;host;x-amz-date'

  const canonicalRequest = [
    method,
    path,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const canonicalRequestHash = sha256Hex(canonicalRequest)
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`
  const signingKey = getSignatureKey(secretKey, dateStamp, region, service)
  const signature = hmacSha256(signingKey, stringToSign).toString('hex')

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    authorization,
    amzDate,
    signedHeaders,
    securityTokenHeader: sessionToken,
  }
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function hmacSha256(key: Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest()
}

function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(Buffer.from(`AWS4${secretKey}`, 'utf8'), dateStamp)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  return hmacSha256(kService, 'aws4_request')
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function toDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

function extractOpenRouterCompletion(data: OpenRouterResponse): string | null {
  const content = data.choices?.[0]?.message?.content

  if (typeof content === 'string') {
    const trimmed = content.trim()
    return trimmed.length ? trimmed : null
  }

  if (isOpenRouterPartArray(content)) {
    const joined = content
      .map((part) => (part?.text ?? part?.content ?? '') ?? '')
      .join('')
      .trim()

    return joined.length ? joined : null
  }

  return null
}

function isOpenRouterPartArray(value: unknown): value is OpenRouterMessagePart[] {
  return Array.isArray(value)
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return { body: await response.text() }
  }
}

async function generateCompletion(body: CompletionRequestBody): Promise<CompletionResult> {
  const metadata = ensureMetadata(body)
  const provider = (body.provider || DEFAULT_PROVIDER).toLowerCase()
  const model = body.model

  switch (provider) {
    case 'openai':
      return callOpenAI(metadata, 'openai', model)
    case 'codex':
      return callOpenAI(metadata, 'codex', model || process.env.CODEX_MODEL || 'gpt-4o-mini')
    case 'gemini':
      return callGemini(metadata, model)
    case 'gemini-cli':
      return callGeminiCli(metadata, model)
    case 'opencode':
      return callOpenCode(metadata, model)
    case 'openrouter':
      return callOpenRouter(metadata, model)
    case 'claude':
      return callClaude(metadata, model)
    case 'anthropic':
      return callAnthropicDirect(metadata, model)
    case 'aider':
      return callAider(metadata, model)
    case 'goose':
      return callGoose(metadata, model)
    case 'project4':
      return callProject4(metadata, model)
    case 'deepseek':
      return callDeepSeek(metadata, model)
    case 'google':
      return callGoogle(metadata, model)
    case 'azure-openai':
      return callAzureOpenAI(metadata, model)
    case 'bedrock':
      return callBedrock(metadata, model)
    case 'vertex':
      return callVertex(metadata, model)
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const rateLimitResult = await apiRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      })
    }

    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required for code completion' },
        { status: 401 }
      )
    }

    // Validate request body
    const validation = await validateRequestBody(request, codeCompletionSchema)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error },
        { status: 400 }
      )
    }

    const body = validation.data as CompletionRequestBody
    const completion = await generateCompletion(body)

    return NextResponse.json(completion)
  } catch (error) {
    logger.error('Code completion error', { error });

    return NextResponse.json(
      {
        error: 'Failed to generate completion',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  // Authentication check for GET endpoint
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required for code completion status' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    status: 'ok',
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    providers: AVAILABLE_PROVIDERS,
  })
}
