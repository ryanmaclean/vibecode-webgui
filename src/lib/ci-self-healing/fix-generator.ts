/**
 * CI Fix Generator
 *
 * Uses Claude to analyze CI failures and generate code fixes
 */

import Anthropic from '@anthropic-ai/sdk'
import { Octokit } from '@octokit/rest'
import type {
  AnalyzedFailure,
  FailureAnalysisResult,
  FixSuggestion,
  FixGenerationResult,
  CodeFix,
  SelfHealingConfig,
  PRCreationResult,
} from './types'

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

export class FixGenerator {
  private anthropic: Anthropic
  private octokit: Octokit
  private config: SelfHealingConfig

  constructor(config: SelfHealingConfig) {
    this.config = config
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    })
    this.octokit = new Octokit({
      auth: config.githubToken,
    })
  }

  /**
   * Generate fixes for all analyzed failures
   */
  async generateFixes(analysis: FailureAnalysisResult): Promise<FixGenerationResult> {
    const suggestions: FixSuggestion[] = []

    for (const failure of analysis.failures) {
      // Skip low-confidence failures
      if (failure.confidence < (this.config.confidenceThreshold || 0.3)) {
        continue
      }

      // Fetch file contents for affected files
      const fileContents = await this.fetchAffectedFiles(failure.affectedFiles, analysis.workflowRun.headSha)

      // Generate fix using Claude
      const suggestion = await this.generateFixForFailure(failure, fileContents)

      if (suggestion) {
        suggestions.push(suggestion)
      }
    }

    return {
      analysisId: analysis.workflowRun.id.toString(),
      suggestions,
      generatedAt: new Date().toISOString(),
      model: this.config.fixModel || DEFAULT_MODEL,
    }
  }

  /**
   * Generate a fix for a single failure
   */
  private async generateFixForFailure(
    failure: AnalyzedFailure,
    fileContents: Map<string, string>
  ): Promise<FixSuggestion | null> {
    try {
      const prompt = this.buildFixPrompt(failure, fileContents)
      const systemPrompt = this.buildSystemPrompt()

      const response = await this.anthropic.messages.create({
        model: this.config.fixModel || DEFAULT_MODEL,
        max_tokens: 8192,
        temperature: 0.1,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        return null
      }

      // Parse the response to extract fixes
      return this.parseFixResponse(content.text, failure)
    } catch (error) {
      console.error(`Failed to generate fix for failure ${failure.id}:`, error)
      return null
    }
  }

  /**
   * Build system prompt for fix generation
   */
  private buildSystemPrompt(): string {
    return `You are an expert software engineer specializing in CI/CD debugging and automated code fixes. Your role is to analyze CI failures and generate precise, minimal code fixes.

Guidelines:
1. Generate the MINIMUM change needed to fix the issue
2. Preserve existing code style and formatting
3. Only modify the specific lines causing the error
4. Include clear explanations for each fix
5. Consider edge cases and potential regressions
6. If unsure, explain why a fix might not be possible

Response Format:
You MUST respond with valid JSON in the following structure:
{
  "title": "Brief title describing the fix",
  "description": "Detailed description of what was wrong and how the fix addresses it",
  "fixes": [
    {
      "file": "path/to/file.ts",
      "description": "What this specific fix does",
      "originalCode": "The exact original code that needs to be replaced (or null for new code)",
      "fixedCode": "The corrected code",
      "lineStart": 10,
      "lineEnd": 15
    }
  ],
  "confidence": 0.85,
  "estimatedImpact": "full|partial|uncertain",
  "requiresReview": true,
  "testCommands": ["npm test -- path/to/test.ts"]
}

IMPORTANT: Return ONLY valid JSON. Do not include markdown code fences or any other formatting.`
  }

  /**
   * Build prompt for generating a fix
   */
  private buildFixPrompt(failure: AnalyzedFailure, fileContents: Map<string, string>): string {
    let prompt = `## CI Failure Analysis

**Category:** ${failure.category}
**Severity:** ${failure.severity}
**Summary:** ${failure.summary}

### Error Details:
`

    for (const detail of failure.details.slice(0, 10)) {
      prompt += `\n**Error:** ${detail.message}\n`
      if (detail.location) {
        prompt += `**Location:** ${detail.location.file || 'unknown'}:${detail.location.line || '?'}:${detail.location.column || '?'}\n`
      }
      if (detail.stackTrace) {
        prompt += `**Stack Trace:**\n\`\`\`\n${detail.stackTrace.slice(0, 1000)}\n\`\`\`\n`
      }
      if (detail.context?.length) {
        prompt += `**Context:**\n${detail.context.join('\n')}\n`
      }
    }

    if (failure.rootCause) {
      prompt += `\n### Root Cause\n${failure.rootCause}\n`
    }

    if (failure.relatedErrors.length > 0) {
      prompt += `\n### Related Warnings/Errors\n`
      for (const error of failure.relatedErrors.slice(0, 5)) {
        prompt += `- ${error}\n`
      }
    }

    // Include file contents
    prompt += `\n### Affected Files\n`
    fileContents.forEach((content, filePath) => {
      // Truncate large files
      const truncatedContent = content.length > 5000
        ? content.slice(0, 5000) + '\n... (truncated)'
        : content
      prompt += `\n**${filePath}:**\n\`\`\`\n${truncatedContent}\n\`\`\`\n`
    })

    prompt += `\n### Task
Analyze the CI failure above and generate a fix. Consider:
1. What exactly is causing the error?
2. What is the minimal code change needed?
3. Are there any side effects to consider?
4. What tests should verify the fix?

Generate your response as valid JSON following the specified format.`

    return prompt
  }

  /**
   * Fetch contents of affected files from the repository
   */
  private async fetchAffectedFiles(
    filePaths: string[],
    sha: string
  ): Promise<Map<string, string>> {
    const contents = new Map<string, string>()

    // Limit to first 5 files to avoid token limits
    const limitedPaths = filePaths.slice(0, 5)

    for (const filePath of limitedPaths) {
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner: this.config.owner,
          repo: this.config.repo,
          path: filePath,
          ref: sha,
        })

        if ('content' in data && data.type === 'file') {
          const content = Buffer.from(data.content, 'base64').toString('utf-8')
          contents.set(filePath, content)
        }
      } catch (error) {
        // File might not exist or be inaccessible
        console.warn(`Could not fetch file ${filePath}:`, error)
      }
    }

    return contents
  }

  /**
   * Parse Claude's response into a FixSuggestion
   */
  private parseFixResponse(response: string, failure: AnalyzedFailure): FixSuggestion | null {
    try {
      // Try to extract JSON from the response
      let jsonStr = response.trim()

      // Handle if response is wrapped in markdown code block
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim()
      }

      const parsed = JSON.parse(jsonStr)

      // Validate required fields
      if (!parsed.title || !parsed.fixes || !Array.isArray(parsed.fixes)) {
        console.warn('Invalid fix response structure')
        return null
      }

      // Transform to our format
      const fixes: CodeFix[] = parsed.fixes.map((f: any) => ({
        file: f.file,
        description: f.description || '',
        originalCode: f.originalCode || undefined,
        fixedCode: f.fixedCode,
        lineStart: f.lineStart,
        lineEnd: f.lineEnd,
        diffPatch: this.generateDiffPatch(f.originalCode, f.fixedCode, f.file),
      }))

      return {
        failureId: failure.id,
        title: parsed.title,
        description: parsed.description || '',
        fixes,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        estimatedImpact: parsed.estimatedImpact || 'uncertain',
        requiresReview: parsed.requiresReview !== false,
        testCommands: parsed.testCommands,
      }
    } catch (error) {
      console.error('Failed to parse fix response:', error)
      return null
    }
  }

  /**
   * Generate a unified diff patch
   */
  private generateDiffPatch(original: string | undefined, fixed: string, file: string): string {
    if (!original) return ''

    const originalLines = original.split('\n')
    const fixedLines = fixed.split('\n')

    let patch = `--- a/${file}\n+++ b/${file}\n`

    // Simple diff - not a full implementation
    patch += `@@ -1,${originalLines.length} +1,${fixedLines.length} @@\n`
    for (const line of originalLines) {
      patch += `-${line}\n`
    }
    for (const line of fixedLines) {
      patch += `+${line}\n`
    }

    return patch
  }

  /**
   * Apply fixes and create a PR
   */
  async applyFixesAndCreatePR(
    analysis: FailureAnalysisResult,
    fixes: FixGenerationResult
  ): Promise<PRCreationResult | null> {
    if (this.config.dryRun) {
      console.log('Dry run mode - not creating PR')
      return null
    }

    if (fixes.suggestions.length === 0) {
      console.log('No fixes to apply')
      return null
    }

    try {
      // Create a new branch
      const branchName = `ci-fix/${analysis.workflowRun.headBranch}-${Date.now()}`

      // Get the base commit
      const { data: ref } = await this.octokit.rest.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${analysis.workflowRun.headBranch}`,
      })

      // Create the new branch
      await this.octokit.rest.git.createRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha,
      })

      // Apply each fix
      for (const suggestion of fixes.suggestions) {
        for (const fix of suggestion.fixes) {
          await this.applyFix(fix, branchName)
        }
      }

      // Create the PR
      const prTitle = `fix(ci): ${fixes.suggestions[0].title}`
      const prBody = this.generatePRBody(analysis, fixes)

      const { data: pr } = await this.octokit.rest.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title: prTitle,
        body: prBody,
        head: branchName,
        base: analysis.workflowRun.headBranch,
      })

      return {
        prNumber: pr.number,
        prUrl: pr.html_url,
        branch: branchName,
        title: prTitle,
        body: prBody,
      }
    } catch (error) {
      console.error('Failed to create PR:', error)
      return null
    }
  }

  /**
   * Apply a single fix to the repository
   */
  private async applyFix(fix: CodeFix, branch: string): Promise<void> {
    try {
      // Get current file content
      const { data: fileData } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: fix.file,
        ref: branch,
      })

      if (!('content' in fileData) || fileData.type !== 'file') {
        throw new Error(`Cannot update non-file: ${fix.file}`)
      }

      const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8')

      // Apply the fix
      let newContent: string
      if (fix.originalCode && fix.fixedCode) {
        // Replace the original code with fixed code
        newContent = currentContent.replace(fix.originalCode, fix.fixedCode)
      } else if (fix.lineStart && fix.lineEnd && fix.fixedCode) {
        // Replace specific lines
        const lines = currentContent.split('\n')
        const before = lines.slice(0, fix.lineStart - 1)
        const after = lines.slice(fix.lineEnd)
        newContent = [...before, fix.fixedCode, ...after].join('\n')
      } else {
        // Append the fix (fallback)
        newContent = fix.fixedCode
      }

      // Update the file
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path: fix.file,
        message: `fix: ${fix.description}`,
        content: Buffer.from(newContent).toString('base64'),
        sha: fileData.sha,
        branch,
      })
    } catch (error) {
      console.error(`Failed to apply fix to ${fix.file}:`, error)
      throw error
    }
  }

  /**
   * Generate PR body with fix details
   */
  private generatePRBody(analysis: FailureAnalysisResult, fixes: FixGenerationResult): string {
    let body = `## 🤖 Self-Healing CI Fix

This PR was automatically generated to fix CI failures detected in workflow run [#${analysis.workflowRun.id}](${analysis.workflowRun.htmlUrl}).

### Failure Analysis

**Workflow:** ${analysis.workflowRun.name}
**Branch:** ${analysis.workflowRun.headBranch}
**Commit:** ${analysis.workflowRun.headSha.slice(0, 7)}

${analysis.overallSummary}

### Applied Fixes

`

    for (const suggestion of fixes.suggestions) {
      body += `#### ${suggestion.title}

${suggestion.description}

**Confidence:** ${Math.round(suggestion.confidence * 100)}%
**Impact:** ${suggestion.estimatedImpact}

<details>
<summary>Files Changed</summary>

`

      for (const fix of suggestion.fixes) {
        body += `- \`${fix.file}\`: ${fix.description}\n`
      }

      body += `
</details>

`

      if (suggestion.testCommands?.length) {
        body += `**Verify with:**
\`\`\`bash
${suggestion.testCommands.join('\n')}
\`\`\`

`
      }
    }

    body += `---

> ⚠️ **Review Required:** This fix was auto-generated and should be reviewed before merging.

🤖 Generated with [Claude Code](https://claude.com/claude-code) Self-Healing CI`

    return body
  }
}
