/**
 * AI Chat API endpoint for VibeCode WebGUI
 * Handles AI-powered code assistance using Vercel AI SDK
 */

import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Initialize OpenAI provider (fallback to a demo provider for development)
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'demo-key',
  baseURL: process.env.OPENAI_BASE_URL,
})

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { messages, workspaceId, codeContext } = await request.json()

    // Validate request
    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 })
    }

    // Build system prompt with code context
    const systemPrompt = `You are an expert AI coding assistant for VibeCode WebGUI, a web-based development platform.

Your role is to help developers with:
- Code explanations and debugging
- Code generation and completion
- Best practices and optimization suggestions
- Architecture guidance
- Testing strategies
- Security considerations

Current context:
- Workspace: ${workspaceId}
- User: ${session.user.name || session.user.email}
${codeContext?.fileName ? `- Current file: ${codeContext.fileName}` : ''}
${codeContext?.language ? `- Language: ${codeContext.language}` : ''}
${codeContext?.selectedCode ? `- Selected code available for analysis` : ''}

Guidelines:
- Provide concise, actionable advice
- Include code examples when helpful
- Consider security and performance implications
- Follow modern development best practices
- Be encouraging and supportive
- If you see potential issues, suggest improvements
- Format code blocks with appropriate syntax highlighting

Remember: You're working within a web-based VS Code environment, so suggestions should be compatible with this setup.`

    // Prepare messages with system prompt
    const messagesWithSystem = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ]

    // For development, provide a mock response if no OpenAI key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
      // Return a streaming mock response
      const mockResponse = `I'm a demo AI assistant for your VibeCode workspace!

${codeContext?.selectedCode ?
  `I can see you've selected some ${codeContext.language || 'code'}. Here's what I notice:

\`\`\`${codeContext.language || ''}
${codeContext.selectedCode}
\`\`\`

This looks like ${codeContext.language || 'code'} that ${getDemoInsight(codeContext.selectedCode)}.` :
  'I can help you with code explanations, debugging, optimization, and more!'
}

💡 **Available features:**
- Explain code functionality
- Suggest optimizations
- Help debug issues
- Write test cases
- Architecture guidance

*Note: This is a demo response. Configure OPENAI_API_KEY for full AI capabilities.*`

      return new Response(
        new ReadableStream({
          start(controller) {
            const words = mockResponse.split(' ')
            let index = 0

            const sendNextWord = () => {
              if (index < words.length) {
                const chunk = words[index] + ' '
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
                index++
                setTimeout(sendNextWord, 50) // Simulate typing
              } else {
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
                controller.close()
              }
            }

            sendNextWord()
          }
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    // Use Vercel AI SDK for real OpenAI streaming
    const result = await streamText({
      model: openai('gpt-4-turbo-preview'),
      messages: messagesWithSystem,
      temperature: 0.7,
      maxTokens: 1000,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('AI Chat API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

// Helper function to provide demo insights
function getDemoInsight(code?: string): string {
  if (!code) return 'appears to be well-structured'

  const lowerCode = code.toLowerCase()

  if (lowerCode.includes('function')) {
    return 'defines a function that could benefit from TypeScript typing'
  } else if (lowerCode.includes('const') || lowerCode.includes('let')) {
    return 'declares variables that follow modern JavaScript conventions'
  } else if (lowerCode.includes('import') || lowerCode.includes('export')) {
    return 'uses ES6 modules which is great for maintainability'
  } else if (lowerCode.includes('class')) {
    return 'defines a class that could benefit from proper encapsulation'
  } else {
    return 'follows good coding practices'
  }
}
