/**
 * Code generation tools for MCP
 * Integrated with LiteLLM for real AI code generation
 */

import { litellmClient } from '../../lib/ai/litellm-client.js';
// import { logger } from '../../lib/logger.js';
import type { GenerateCodeArgs } from '../types.js';

/**
 * Generate code using AI via LiteLLM
 *
 * Supports multiple models through LiteLLM proxy including:
 * - GPT-4, GPT-4o, GPT-3.5
 * - Claude 3.5 Sonnet, Claude 3 Haiku
 * - Code-specialized models
 */
export async function generateCode(args: GenerateCodeArgs) {
  const { prompt, language, context } = args;
  const startTime = Date.now();

  // Validate inputs
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: 'Prompt is required and must be a non-empty string',
              prompt,
              language,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  if (!language || typeof language !== 'string') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: 'Language is required and must be a string',
              prompt,
              language,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  try {
    // Select appropriate model based on use case
    // Claude 3.5 Haiku is fast and cost-effective for code generation
    const model = process.env.CODE_GENERATION_MODEL || 'claude-3.5-haiku';

    // Build system prompt optimized for code generation
    const systemPrompt = `You are an expert software engineer specializing in ${language} development.
Generate clean, production-ready code that follows best practices and industry standards.
Include helpful comments explaining complex logic.
Focus on clarity, maintainability, and correctness.`;

    // Build user prompt with context if provided
    let userPrompt = prompt;
    if (context) {
      userPrompt += `\n\nAdditional context:\n${JSON.stringify(context, null, 2)}`;
    }

    console.log('Code generation request', {
      language,
      promptLength: prompt.length,
      hasContext: !!context,
      model,
    });

    // Call LiteLLM for code generation
    const response = await litellmClient.chatCompletion(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more deterministic code
        max_tokens: 4000,
      },
      'mcp-user', // User ID for tracking
      undefined // No project ID in MCP context
    );

    const generatedCode = response.choices[0]?.message?.content || '';
    const duration = Date.now() - startTime;

    // Extract code blocks if present in markdown format
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
    const codeBlocks = Array.from(generatedCode.matchAll(codeBlockRegex));
    const extractedCode = codeBlocks.length > 0
      ? codeBlocks.map(match => match[1]).join('\n\n')
      : generatedCode;

    // Separate explanation from code
    const explanation = generatedCode.replace(/```[\w]*\n[\s\S]*?```/g, '').trim();

    console.log('Code generation completed', {
      language,
      durationMs: duration,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      cost: response.cost,
      model: response.model,
      codeLength: extractedCode.length,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              prompt,
              language,
              context,
              code: extractedCode,
              explanation: explanation || 'Code generated successfully',
              metadata: {
                model: response.model,
                tokens: {
                  input: response.usage.prompt_tokens,
                  output: response.usage.completion_tokens,
                  total: response.usage.total_tokens,
                },
                cost: response.cost,
                durationMs: duration,
                finishReason: response.choices[0]?.finish_reason,
              },
            },
            null,
            2
          ),
        },
      ],
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('Code generation failed', {
      error: errorMessage,
      language,
      promptLength: prompt.length,
      durationMs: duration,
    });

    // Handle specific error types
    let userFriendlyError = errorMessage;
    if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
      userFriendlyError = 'AI service is unavailable. Please check LiteLLM proxy configuration.';
    } else if (errorMessage.includes('token')) {
      userFriendlyError = 'Request exceeded token limit. Please reduce prompt size or context.';
    } else if (errorMessage.includes('rate limit')) {
      userFriendlyError = 'Rate limit exceeded. Please try again in a few moments.';
    } else if (errorMessage.includes('API key')) {
      userFriendlyError = 'AI service authentication failed. Please check API key configuration.';
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: userFriendlyError,
              technicalError: errorMessage,
              prompt,
              language,
              metadata: {
                durationMs: duration,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
