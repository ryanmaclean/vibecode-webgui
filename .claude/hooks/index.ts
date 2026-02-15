#!/usr/bin/env bun

import type {
  NotificationHandler,
  PostToolUseHandler,
  PreCompactHandler,
  PreToolUseHandler,
  PullRequest,
  MergeRequest,
  SessionStartHandler,
  StopHandler,
  SubagentStopHandler,
  UserPromptSubmitHandler,
} from './lib'
import {runHook} from './lib'
import {listPullRequests, listMergeRequests} from './pr'
import {saveSessionData} from './session'

// PR/MR detection patterns (case insensitive)
const PR_PATTERNS = [
  /\bpr\b/i,           // "PR" as whole word
  /\bprs\b/i,          // "PRs" as whole word
  /pull\s*request/i,   // "pull request" or "pullrequest"
  /pull\s*requests/i,  // "pull requests"
]

const MR_PATTERNS = [
  /\bmr\b/i,           // "MR" as whole word
  /\bmrs\b/i,          // "MRs" as whole word
  /merge\s*request/i,  // "merge request" or "mergerequest"
  /merge\s*requests/i, // "merge requests"
]

/**
 * Check if the prompt mentions PRs
 */
function hasPRMention(prompt: string): boolean {
  return PR_PATTERNS.some((pattern) => pattern.test(prompt))
}

/**
 * Check if the prompt mentions MRs
 */
function hasMRMention(prompt: string): boolean {
  return MR_PATTERNS.some((pattern) => pattern.test(prompt))
}

/**
 * Format PR list as context string for Claude
 */
function formatPRContextString(prs: PullRequest[]): string {
  if (prs.length === 0) {
    return 'No open pull requests found in this repository.'
  }

  const lines = ['Open Pull Requests:']
  for (const pr of prs) {
    lines.push(`  #${pr.number}: ${pr.title} (by ${pr.author.login}, ${pr.state})`)
  }
  return lines.join('\n')
}

/**
 * Format MR list as context string for Claude
 */
function formatMRContextString(mrs: MergeRequest[]): string {
  if (mrs.length === 0) {
    return 'No open merge requests found in this repository.'
  }

  const lines = ['Open Merge Requests:']
  for (const mr of mrs) {
    lines.push(`  !${mr.iid}: ${mr.title} (by ${mr.author.username}, ${mr.state})`)
  }
  return lines.join('\n')
}

/**
 * Non-blocking fetch with timeout
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutId: Timer | undefined
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), timeoutMs)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    if (timeoutId) clearTimeout(timeoutId)
    return result
  } catch {
    if (timeoutId) clearTimeout(timeoutId)
    return fallback
  }
}

// SessionStart handler - called when a new Claude session starts
const sessionStart: SessionStartHandler = async (payload) => {
  // Save session data (optional - remove if not needed)
  await saveSessionData('SessionStart', {...payload, hook_type: 'SessionStart'} as const)

  // Example: Log session start with source
  console.log(`🚀 New session started from: ${payload.source}`)
  console.log(`📍 Session ID: ${payload.session_id}`)

  // Example: Load user preferences or configuration
  // const userConfig = await loadUserPreferences()

  // Example: Set up session-specific resources
  // await initializeSessionResources(payload.session_id)

  // Example: Apply different behavior based on session source
  if (payload.source === 'vscode') {
    console.log('👨‍💻 VS Code session detected - enabling IDE-specific features')
  } else if (payload.source === 'web') {
    console.log('🌐 Web session detected')
  }

  // Add your custom session initialization logic here

  return {} // Empty object means continue normally
}

// PreToolUse handler - called before Claude uses any tool
// This handler can block tool execution by returning a deny decision
const preToolUse: PreToolUseHandler = async (payload) => {
  // Save session data (optional - remove if not needed)
  await saveSessionData('PreToolUse', {...payload, hook_type: 'PreToolUse'} as const)

  // Example: Log when Claude is about to edit files
  if (payload.tool_name === 'Edit' && payload.tool_input) {
    const {file_path} = payload.tool_input as {file_path: string}
    console.log(`📝 Claude is editing: ${file_path}`)
  }

  // Example: Track bash commands
  if (payload.tool_name === 'Bash' && payload.tool_input && 'command' in payload.tool_input) {
    const command = (payload.tool_input as {command: string}).command
    console.log(`🚀 Running command: ${command}`)

    // Block dangerous commands
    if (command.includes('rm -rf /') || command.includes('rm -rf ~')) {
      console.error('❌ Dangerous command detected! Blocking execution.')
      return {
        permissionDecision: 'deny',
        permissionDecisionReason: `Dangerous command detected: ${command}`,
      }
    }
  }

  // Add your custom logic here!
  // You have full TypeScript support and can use any npm packages

  return {} // Empty object means continue with default behavior
}

// PostToolUse handler - called after Claude uses a tool
const postToolUse: PostToolUseHandler = async (payload) => {
  // Save session data (optional - remove if not needed)
  await saveSessionData('PostToolUse', {...payload, hook_type: 'PostToolUse'} as const)

  // Example: React to successful file writes
  if (payload.tool_name === 'Write' && payload.tool_response) {
    console.log(`✅ File written successfully!`)
  }

  // Add your custom post-processing logic here

  return {} // Return empty object to continue normally
}

// Notification handler - receive Claude's notifications
const notification: NotificationHandler = async (payload) => {
  await saveSessionData('Notification', {...payload, hook_type: 'Notification'} as const)

  // Example: Log Claude's progress
  console.log(`🔔 ${payload.message}`)

  return {} // Return empty object to continue normally
}

// Stop handler - called when Claude stops
const stop: StopHandler = async (payload) => {
  await saveSessionData('Stop', {...payload, hook_type: 'Stop'} as const)

  // Example: Summary or cleanup logic
  console.log(`👋 Session ended`)

  return {} // Return empty object to continue normally
}

// SubagentStop handler - called when a Claude subagent (Task tool) stops
const subagentStop: SubagentStopHandler = async (payload) => {
  await saveSessionData('SubagentStop', {...payload, hook_type: 'SubagentStop'} as const)

  // Example: Log subagent completion
  console.log(`🤖 Subagent task completed`)

  // Add your custom subagent cleanup logic here
  // Note: Be careful with stop_hook_active to avoid infinite loops
  if (payload.stop_hook_active) {
    console.log('⚠️  Stop hook is already active, skipping additional processing')
  }

  return {} // Return empty object to continue normally
}

// UserPromptSubmit handler - called when the user submits a prompt
const userPromptSubmit: UserPromptSubmitHandler = async (payload) => {
  await saveSessionData('UserPromptSubmit', {...payload, hook_type: 'UserPromptSubmit'} as const)

  // Example: Log user prompts
  console.log(`💬 User prompt: ${payload.prompt}`)

  // Example: Add context files automatically based on prompt content
  const contextFiles: string[] = []
  if (payload.prompt.toLowerCase().includes('test')) {
    // Automatically include test files when user mentions testing
    contextFiles.push('**/*.test.ts', '**/*.test.js')
    console.log('📁 Auto-adding test files to context')
  }

  // Example: Validate or modify prompts
  if (payload.prompt.includes('delete all')) {
    console.error('⚠️  Dangerous prompt detected! Blocking.')
    return {decision: 'block', reason: 'Prompts containing "delete all" are not allowed'}
  }

  // PR/MR context enrichment - detect PR/MR mentions and add context
  const prMention = hasPRMention(payload.prompt)
  const mrMention = hasMRMention(payload.prompt)

  // Collect context strings for PR/MR information
  const prMrContext: string[] = []

  if (prMention) {
    console.log('🔍 PR mention detected in prompt')
    // Non-blocking fetch with 3 second timeout
    const prs = await withTimeout(listPullRequests(), 3000, [])
    if (prs.length > 0) {
      console.log(`📋 Found ${prs.length} open PRs`)
      prMrContext.push(formatPRContextString(prs))
    } else {
      console.log('📋 No open PRs found or GitHub CLI unavailable')
    }
  }

  if (mrMention) {
    console.log('🔍 MR mention detected in prompt')
    // Non-blocking fetch with 3 second timeout
    const mrs = await withTimeout(listMergeRequests(), 3000, [])
    if (mrs.length > 0) {
      console.log(`📋 Found ${mrs.length} open MRs`)
      prMrContext.push(formatMRContextString(mrs))
    } else {
      console.log('📋 No open MRs found or GitLab CLI unavailable')
    }
  }

  // Build response with context
  const response: {contextFiles?: string[]; hookSpecificOutput?: string} = {}

  if (contextFiles.length > 0) {
    response.contextFiles = contextFiles
  }

  if (prMrContext.length > 0) {
    response.hookSpecificOutput = prMrContext.join('\n\n')
  }

  return Object.keys(response).length > 0 ? response : {}
}

// PreCompact handler - called before Claude compacts the conversation
const preCompact: PreCompactHandler = async (payload) => {
  await saveSessionData('PreCompact', {...payload, hook_type: 'PreCompact'} as const)

  // Example: Log compact events
  console.log(`🗜️  Compact triggered: ${payload.trigger}`)

  // Example: Block automatic compaction during critical operations
  if (payload.trigger === 'auto') {
    // You could check if critical operations are in progress
    // For now, we'll allow all compactions
    console.log('📋 Allowing automatic compaction')
  }

  // Add your custom compaction logic here

  return {} // Empty object means allow compaction
}

// Run the hook with our handlers
runHook({
  sessionStart,
  preToolUse,
  postToolUse,
  notification,
  stop,
  subagentStop,
  userPromptSubmit,
  preCompact,
})
