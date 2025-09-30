import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

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

const AVAILABLE_PROVIDERS = [
  'openai',
  'codex',
  'gemini',
  'gemini-cli',
  'opencode',
  'claude',
  'aider',
  'goose',
  'project4',
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

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    throw new Error(`Gemini request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  const data: any = await response.json()
  const completion = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null

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

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    throw new Error(`Gemini CLI request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  const data: any = await response.json()
  const completion = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null

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

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    throw new Error(`OpenCode request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  const data: any = await response.json()
  const content = data?.choices?.[0]?.message?.content
  const completion = Array.isArray(content)
    ? content.map((part: any) => part?.text ?? part?.content ?? '').join('').trim()
    : typeof content === 'string'
      ? content.trim()
      : null

  return {
    completion: completion && completion.length ? completion : null,
    raw: data,
  }
}

async function callClaude(metadata: CompletionMetadata, modelOverride?: string): Promise<CompletionResult> {
  const apiKey = process.env.CLAUDE_CODE_API_KEY || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('CLAUDE_CODE_API_KEY (or ANTHROPIC_API_KEY) is required for Claude provider')
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

  const response = await fetch(process.env.CLAUDE_API_BASE || 'https://api.anthropic.com/v1/messages', {
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

  const data: any = await response.json()
  const completion = data?.content?.[0]?.text?.trim() || null

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
    case 'claude':
      return callClaude(metadata, model)
    case 'aider':
      return callAider(metadata, model)
    case 'goose':
      return callGoose(metadata, model)
    case 'project4':
      return callProject4(metadata, model)
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CompletionRequestBody
    const completion = await generateCompletion(body)

    return NextResponse.json(completion)
  } catch (error) {
    console.error('[Code Completion] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to generate completion',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    providers: AVAILABLE_PROVIDERS,
  })
}
