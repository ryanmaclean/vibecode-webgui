/**
 * Self-Consistent Reasoning API Endpoint
 * Provides access to Chain-of-Thought with Self-Consistency functionality
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SelfConsistentReasoning } from '@/lib/ai/self-consistent-reasoning'
import { ModelOrchestrator, TaskType } from '@/lib/ai/model-orchestration'
import { z } from 'zod'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Request validation schema
const SelfConsistentReasoningRequestSchema = z.object({
  prompt: z.string().min(10).max(5000),
  config: z.object({
    numPaths: z.number().min(1).max(10).optional(),
    maxThoughtsPerPath: z.number().min(1).max(20).optional(),
    minConsensusThreshold: z.number().min(0).max(1).optional(),
    useModelDiversity: z.boolean().optional(),
    confidenceWeighting: z.boolean().optional(),
    extractAnswerPattern: z.string().optional() // Regex pattern as string
  }).optional(),
  context: z.object({
    taskType: z.enum(['code_generation', 'code_review', 'debugging', 'documentation', 'explanation', 'planning', 'creative_writing', 'data_analysis', 'general_chat', 'function_calling', 'json_generation', 'multimodal']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    expectedTokens: z.number().min(100).max(8000).optional(),
    workspaceId: z.string().optional()
  }).optional()
})

type SelfConsistentReasoningRequest = z.infer<typeof SelfConsistentReasoningRequestSchema>

// Initialize model orchestrator with default configuration
const modelOrchestrator = new ModelOrchestrator()
const reasoningEngine = new SelfConsistentReasoning(modelOrchestrator)

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse and validate request
    const body = await request.json()
    const validatedRequest = SelfConsistentReasoningRequestSchema.parse(body)

    // Build request context
    const context = {
      taskType: validatedRequest.context?.taskType ? 
        TaskType[validatedRequest.context.taskType.toUpperCase() as keyof typeof TaskType] : 
        TaskType.PLANNING,
      priority: validatedRequest.context?.priority || 'medium' as const,
      expectedTokens: validatedRequest.context?.expectedTokens || 2000,
      requiresStreaming: false,
      requiresJsonMode: false,
      requiresFunctionCalling: false,
      requiresMultimodal: false,
      userId: session.user.email || session.user.id
    }

    // Prepare configuration
    const config = {
      ...validatedRequest.config,
      // Convert regex pattern string to RegExp if provided
      extractAnswerPattern: validatedRequest.config?.extractAnswerPattern ? 
        new RegExp(validatedRequest.config.extractAnswerPattern, 'i') : 
        undefined
    }

    console.log(`🧠 Starting self-consistent reasoning for user: ${session.user.email}`)
    console.log(`📝 Prompt: ${validatedRequest.prompt.substring(0, 100)}...`)
    console.log(`⚙️ Config: ${JSON.stringify(config)}`)

    // Execute self-consistent reasoning
    const startTime = Date.now()
    const result = await reasoningEngine.selfConsistentReasoning(
      validatedRequest.prompt,
      context,
      config
    )
    const processingTime = Date.now() - startTime

    console.log(`✅ Reasoning completed in ${processingTime}ms`)
    console.log(`🎯 Consensus: ${result.consensusAnswer}`)
    console.log(`📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`)
    console.log(`🛤️ Paths: ${result.paths.length}, Success rate: ${(result.successRate * 100).toFixed(1)}%`)

    // Return results
    return NextResponse.json({
      success: true,
      result: {
        consensusAnswer: result.consensusAnswer,
        confidence: result.confidence,
        reasoning: result.reasoning,
        paths: result.paths.map(path => ({
          id: path.id,
          model: path.model,
          finalAnswer: path.finalAnswer,
          confidence: path.confidence,
          thoughtsCount: path.thoughts.length,
          summary: path.reasoning.substring(0, 200) + (path.reasoning.length > 200 ? '...' : '')
        })),
        answerComparison: {
          consensus: result.answerComparison.consensus,
          agreementRatio: result.answerComparison.agreementRatio,
          answerGroups: result.answerComparison.answerGroups.map(group => ({
            answer: group.answer,
            frequency: group.frequency,
            avgConfidence: group.avgConfidence
          }))
        },
        metrics: {
          totalTime: result.totalTime,
          successRate: result.successRate,
          pathsGenerated: result.paths.length,
          configUsed: result.config
        }
      },
      timestamp: new Date().toISOString(),
      processingTime
    })

  } catch (error) {
    console.error('❌ Self-consistent reasoning failed:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Return API documentation and examples
    return NextResponse.json({
      name: 'Self-Consistent Reasoning API',
      description: 'Chain-of-Thought with Self-Consistency for improved AI reasoning',
      version: '1.0.0',
      endpoints: {
        POST: {
          description: 'Execute self-consistent reasoning',
          parameters: {
            prompt: 'string (required) - The reasoning question or problem',
            config: {
              numPaths: 'number (optional, 1-10) - Number of reasoning paths',
              maxThoughtsPerPath: 'number (optional, 1-20) - Max thoughts per path',
              minConsensusThreshold: 'number (optional, 0-1) - Consensus threshold',
              useModelDiversity: 'boolean (optional) - Use different models',
              confidenceWeighting: 'boolean (optional) - Weight by confidence',
              extractAnswerPattern: 'string (optional) - Regex pattern for answers'
            },
            context: {
              taskType: 'string (optional) - Type of reasoning task',
              priority: 'string (optional) - low/medium/high priority',
              expectedTokens: 'number (optional) - Expected token count',
              workspaceId: 'string (optional) - Workspace identifier'
            }
          }
        }
      },
      examples: {
        basicMath: {
          prompt: 'If a train travels 60 miles in 45 minutes, what is its speed in mph?',
          config: {
            numPaths: 3,
            minConsensusThreshold: 0.67
          }
        },
        logicProblem: {
          prompt: 'All cats are mammals. Some mammals fly. Do some cats fly?',
          config: {
            numPaths: 5,
            maxThoughtsPerPath: 6,
            useModelDiversity: true
          }
        },
        customPattern: {
          prompt: 'Solve: 2 + 2 = ? Format as ANSWER: [result]',
          config: {
            extractAnswerPattern: 'ANSWER:\\s*(\\d+)'
          }
        }
      },
      supportedTaskTypes: Object.values(TaskType),
      defaultConfig: {
        numPaths: 5,
        maxThoughtsPerPath: 10,
        minConsensusThreshold: 0.6,
        useModelDiversity: true,
        confidenceWeighting: true
      }
    })

  } catch (error) {
    console.error('❌ Failed to get API info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}