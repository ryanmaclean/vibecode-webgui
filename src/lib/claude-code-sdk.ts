/**
 * Claude Code SDK Integration
 * 
 * AI-powered development assistance integrated with code-server
 * Based on claude-prompt.md guidance for web-based IDE integration
 * 
 * Staff Engineer Implementation - Production-ready AI code assistance
 */

import Anthropic from '@anthropic-ai/sdk'

export interface CodeContext {
  language: string
  filePath: string
  selectedText?: string
  fullText?: string
  cursorPosition?: {
    line: number
    column: number
  }
  projectStructure?: string[]
  recentChanges?: string[]
}

export interface GenerateCodeRequest {
  prompt: string
  context: CodeContext
  maxTokens?: number
  temperature?: number
}

export interface GenerateCodeResponse {
  code: string
  explanation?: string
  confidence: number
  suggestions?: string[]
}

export interface ChatRequest {
  message: string
  context: CodeContext
  conversationHistory?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export interface ChatResponse {
  message: string
  codeBlocks?: Array<{
    language: string
    code: string
    explanation?: string
  }>
  actions?: Array<{
    type: 'refactor' | 'test' | 'explain' | 'optimize'
    target: string
    description: string
  }>
}

export interface CodeAnalysisRequest {
  code: string
  language: string
  analysisType: 'review' | 'debug' | 'optimize' | 'explain' | 'test'
}

export interface CodeAnalysisResponse {
  analysis: string
  issues?: Array<{
    line: number
    severity: 'error' | 'warning' | 'info'
    message: string
    suggestion?: string
  }>
  improvements?: string[]
  testSuggestions?: string[]
}

export class ClaudeCodeSDK {
  private anthropic: Anthropic
  private baseSystemPrompt: string
  private defaultModel: string
  private maxTokens: number
  private temperature: number

  constructor(config: {
    apiKey?: string
    baseURL?: string
    model?: string
    maxTokens?: number
    temperature?: number
  }) {
    this.anthropic = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: config.baseURL
    })
    
    this.defaultModel = config.model || 'claude-3-5-sonnet-20241022'
    this.maxTokens = config.maxTokens || 4096
    this.temperature = config.temperature || 0.1
    
    this.baseSystemPrompt = `You are Claude Code, an AI assistant specialized in software development. You help developers write, debug, optimize, and understand code across multiple programming languages.

Key capabilities:
- Generate clean, efficient, and well-documented code
- Explain complex code concepts clearly
- Debug issues and suggest fixes
- Optimize code for performance and readability
- Write comprehensive tests
- Perform code reviews
- Refactor code following best practices

Always provide:
1. Clear, concise explanations
2. Production-ready code
3. Relevant examples
4. Security considerations when applicable
5. Performance implications
6. Testing suggestions

Be precise, helpful, and focus on practical solutions that work in real development environments.`
  }

  /**
   * Generate code based on a prompt and context
   */
  async generateCode(request: GenerateCodeRequest): Promise<GenerateCodeResponse> {
    try {
      const contextPrompt = this.buildContextPrompt(request.context)
      const systemPrompt = `${this.baseSystemPrompt}

Current Context:
${contextPrompt}

Generate code that:
- Follows best practices for ${request.context.language}
- Integrates well with the existing codebase
- Is production-ready and well-documented
- Considers security and performance implications`

      const response = await this.anthropic.messages.create({
        model: this.defaultModel,
        max_tokens: request.maxTokens || this.maxTokens,
        temperature: request.temperature || this.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Generate code for the following request:

${request.prompt}

Please provide:
1. The complete code solution
2. A brief explanation of the implementation
3. Any important considerations or assumptions`
          }
        ]
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      // Parse the response to extract code and explanation
      const { code, explanation } = this.parseCodeResponse(content.text)
      
      return {
        code,
        explanation,
        confidence: this.calculateConfidence(content.text),
        suggestions: this.extractSuggestions(content.text)
      }
    } catch (error) {
      console.error('Claude Code generation failed:', error)
      throw new Error(`Failed to generate code: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Interactive chat with code context
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const contextPrompt = this.buildContextPrompt(request.context)
      const systemPrompt = `${this.baseSystemPrompt}

Current Context:
${contextPrompt}

You are in an interactive conversation helping the developer with their code. Provide helpful, actionable responses.`

      const messages: Array<{ role: 'user' | 'assistant', content: string }> = [
        ...(request.conversationHistory || []),
        {
          role: 'user',
          content: request.message
        }
      ]

      const response = await this.anthropic.messages.create({
        model: this.defaultModel,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: systemPrompt,
        messages
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      return this.parseChatResponse(content.text)
    } catch (error) {
      console.error('Claude Code chat failed:', error)
      throw new Error(`Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze code for issues, improvements, or explanations
   */
  async analyzeCode(request: CodeAnalysisRequest): Promise<CodeAnalysisResponse> {
    try {
      const analysisPrompts = {
        review: 'Perform a comprehensive code review, identifying potential issues, improvements, and best practices.',
        debug: 'Analyze this code for bugs, errors, and potential runtime issues. Provide specific fixes.',
        optimize: 'Analyze this code for performance improvements and optimization opportunities.',
        explain: 'Explain how this code works, including its purpose, logic flow, and key concepts.',
        test: 'Generate comprehensive test cases for this code, including edge cases and error scenarios.'
      }

      const systemPrompt = `${this.baseSystemPrompt}

You are performing a ${request.analysisType} analysis of ${request.language} code.

${analysisPrompts[request.analysisType]}

Provide structured feedback with:
- Line-specific issues (if applicable)
- Overall analysis
- Actionable recommendations
- Code examples for improvements`

      const response = await this.anthropic.messages.create({
        model: this.defaultModel,
        max_tokens: this.maxTokens,
        temperature: 0.1, // Lower temperature for analysis
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analyze this ${request.language} code:

\`\`\`${request.language}
${request.code}
\`\`\``
          }
        ]
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      return this.parseAnalysisResponse(content.text)
    } catch (error) {
      console.error('Claude Code analysis failed:', error)
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Build context prompt from code context
   */
  private buildContextPrompt(context: CodeContext): string {
    let prompt = `Language: ${context.language}\n`
    
    if (context.filePath) {
      prompt += `File: ${context.filePath}\n`
    }
    
    if (context.selectedText) {
      prompt += `Selected Code:\n\`\`\`${context.language}\n${context.selectedText}\n\`\`\`\n`
    }
    
    if (context.fullText && context.fullText !== context.selectedText) {
      prompt += `Full File Content:\n\`\`\`${context.language}\n${context.fullText}\n\`\`\`\n`
    }
    
    if (context.projectStructure?.length) {
      prompt += `Project Structure:\n${context.projectStructure.join('\n')}\n`
    }
    
    if (context.recentChanges?.length) {
      prompt += `Recent Changes:\n${context.recentChanges.join('\n')}\n`
    }
    
    if (context.cursorPosition) {
      prompt += `Cursor Position: Line ${context.cursorPosition.line}, Column ${context.cursorPosition.column}\n`
    }
    
    return prompt
  }

  /**
   * Parse code generation response
   */
  private parseCodeResponse(response: string): { code: string; explanation: string } {
    // Extract code blocks
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g
    const codeBlocks = []
    let match
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      codeBlocks.push(match[1].trim())
    }
    
    // Use the largest code block as the main code
    const code = codeBlocks.length > 0 
      ? codeBlocks.reduce((a, b) => a.length > b.length ? a : b)
      : ''
    
    // Extract explanation (text outside code blocks)
    const explanation = response
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim()
    
    return { code, explanation }
  }

  /**
   * Parse chat response
   */
  private parseChatResponse(response: string): ChatResponse {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    const codeBlocks: Array<{ language: string; code: string }> = []
    let match
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      })
    }
    
    // Extract main message (text outside code blocks)
    const message = response
      .replace(/```[\s\S]*?```/g, '[CODE_BLOCK]')
      .replace(/\[CODE_BLOCK\]\s*\[CODE_BLOCK\]/g, '[CODE_BLOCK]')
      .trim()
    
    return {
      message,
      codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined
    }
  }

  /**
   * Parse analysis response
   */
  private parseAnalysisResponse(response: string): CodeAnalysisResponse {
    // Extract issues if mentioned with line numbers
    const issueRegex = /line (\d+)[:\s]+(error|warning|info)[:\s]+(.+)/gi
    const issues: Array<{
      line: number
      severity: 'error' | 'warning' | 'info'
      message: string
    }> = []
    
    let match
    while ((match = issueRegex.exec(response)) !== null) {
      issues.push({
        line: parseInt(match[1]),
        severity: match[2].toLowerCase() as 'error' | 'warning' | 'info',
        message: match[3].trim()
      })
    }
    
    // Extract improvements (lines starting with bullet points or numbers)
    const improvementRegex = /(?:^|\n)[•\-\*]?\s*(?:\d+\.?\s*)?([^:\n]+(?:improvement|optimize|refactor|enhance)[^:\n]*)/gim
    const improvements: string[] = []
    
    while ((match = improvementRegex.exec(response)) !== null) {
      improvements.push(match[1].trim())
    }
    
    return {
      analysis: response,
      issues: issues.length > 0 ? issues : undefined,
      improvements: improvements.length > 0 ? improvements : undefined
    }
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  private calculateConfidence(response: string): number {
    let confidence = 0.5 // Base confidence
    
    // Higher confidence for responses with code blocks
    if (response.includes('```')) confidence += 0.2
    
    // Higher confidence for detailed explanations
    if (response.length > 500) confidence += 0.1
    
    // Higher confidence for structured responses
    if (response.includes('1.') || response.includes('- ')) confidence += 0.1
    
    // Lower confidence for uncertain language
    if (response.includes('might') || response.includes('could') || response.includes('possibly')) {
      confidence -= 0.1
    }
    
    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Extract suggestions from response
   */
  private extractSuggestions(response: string): string[] {
    const suggestionRegex = /(?:consider|suggest|recommend|try)[:\s]+([^.\n]+)/gi
    const suggestions: string[] = []
    let match
    
    while ((match = suggestionRegex.exec(response)) !== null) {
      suggestions.push(match[1].trim())
    }
    
    return suggestions.slice(0, 3) // Limit to top 3 suggestions
  }
}

// Global SDK instance
export const claudeCodeSDK = new ClaudeCodeSDK({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
})