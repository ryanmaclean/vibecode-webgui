/**
 * AI CLI Tools Installation API
 * Handles installation of various AI coding CLI tools
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import { prisma } from '@/lib/prisma'

const execAsync = promisify(exec)

// Supported AI CLI tools
const SUPPORTED_TOOLS = {
  'gemini-cli': {
    name: 'Google Gemini CLI',
    description: 'Command-line interface for Google\'s Gemini AI models',
    license: 'Apache 2.0',
    version: '1.0.0',
    installationScript: 'scripts/install-gemini-cli.sh',
    dependencies: ['python3', 'pip3'] as string[],
    models: ['gemini-pro', 'gemini-1.5-pro']
  },
  'opencode': {
    name: 'OpenCode',
    description: 'Open-source AI coding assistant',
    license: 'MIT',
    version: '1.0.0',
    installationScript: 'scripts/install-opencode.sh',
    dependencies: ['node', 'npm'] as string[],
    models: ['local', 'openai', 'anthropic']
  },
  'codex-cli': {
    name: 'OpenAI Codex CLI',
    description: 'Enterprise AI coding with OpenAI Codex',
    license: 'Apache 2.0',
    version: '1.0.0',
    installationScript: 'scripts/install-codex-cli.sh',
    dependencies: ['python3', 'pip3'] as string[],
    models: ['code-davinci-002', 'code-cushman-001']
  },
  'aider': {
    name: 'Aider',
    description: 'Collaborative AI coding with Git integration',
    license: 'Apache 2.0',
    version: '1.0.0',
    installationScript: 'scripts/install-aider.sh',
    dependencies: ['python3', 'pip3', 'git'] as string[],
    models: ['openai', 'anthropic', 'local']
  }
} as const

type SupportedTool = keyof typeof SUPPORTED_TOOLS

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { toolId, options = {} } = body

    // Validate tool ID
    if (!toolId || !SUPPORTED_TOOLS[toolId as SupportedTool]) {
      return NextResponse.json(
        { error: `Unsupported tool: ${toolId}` },
        { status: 400 }
      )
    }

    const tool = SUPPORTED_TOOLS[toolId as SupportedTool]

    // Check if tool is already installed
    const existingInstallation = await prisma.toolInstallation.findFirst({
      where: {
        toolId,
        userId: session.user.id,
        status: 'installed'
      }
    })

    if (existingInstallation) {
      return NextResponse.json(
        { error: `${tool.name} is already installed` },
        { status: 409 }
      )
    }

    // Create installation record
    const installation = await prisma.toolInstallation.create({
      data: {
        toolId,
        userId: session.user.id,
        workspaceId: options.workspaceId || null,
        status: 'installing',
        configuration: options.configuration || {}
      }
    })

    try {
      // Check dependencies
      await checkDependencies(tool.dependencies)

      // Run installation script
      await installTool(toolId, options)

      // Update installation status
      await prisma.toolInstallation.update({
        where: { id: installation.id },
        data: {
          status: 'installed',
          configuration: {
            ...options.configuration,
            installedAt: new Date().toISOString(),
            version: tool.version
          }
        }
      })

      // Log installation
      await prisma.toolUsage.create({
        data: {
          toolId,
          userId: session.user.id,
          workspaceId: options.workspaceId || null,
          action: 'install',
          metadata: {
            version: tool.version,
            options
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: `${tool.name} installed successfully`,
        installation: {
          id: installation.id,
          toolId,
          status: 'installed',
          version: tool.version
        }
      })

    } catch (error) {
      // Update installation status to failed
      await prisma.toolInstallation.update({
        where: { id: installation.id },
        data: {
          status: 'error',
          configuration: {
            ...options.configuration,
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date().toISOString()
          }
        }
      })

      throw error
    }

  } catch (error) {
    console.error('AI CLI tool installation error:', error)
    
    return NextResponse.json(
      { 
        error: 'Installation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const toolId = searchParams.get('toolId')

    if (toolId) {
      // Get specific tool installation status
      const installation = await prisma.toolInstallation.findFirst({
        where: {
          toolId,
          userId: session.user.id
        },
        orderBy: { installedAt: 'desc' }
      })

      const tool = SUPPORTED_TOOLS[toolId as SupportedTool]
      if (!tool) {
        return NextResponse.json({ error: 'Tool not found' }, { status: 404 })
      }

      return NextResponse.json({
        tool: {
          id: toolId,
          name: tool.name,
          description: tool.description,
          license: tool.license,
          version: tool.version,
          models: tool.models
        },
        installation: installation ? {
          id: installation.id,
          status: installation.status,
          installedAt: installation.installedAt,
          configuration: installation.configuration
        } : null
      })
    } else {
      // Get all available tools and installation status
      const installations = await prisma.toolInstallation.findMany({
        where: { userId: session.user.id },
        orderBy: { installedAt: 'desc' }
      })

      const tools = Object.entries(SUPPORTED_TOOLS).map(([id, tool]) => {
        const installation = installations.find((inst: any) => inst.toolId === id)
        return {
          id,
          name: tool.name,
          description: tool.description,
          license: tool.license,
          version: tool.version,
          models: tool.models,
          installed: installation?.status === 'installed',
          installation: installation ? {
            id: installation.id,
            status: installation.status,
            installedAt: installation.installedAt,
            configuration: installation.configuration
          } : null
        }
      })

      return NextResponse.json({ tools })
    }

  } catch (error) {
    console.error('AI CLI tools status error:', error)
    
    return NextResponse.json(
      { error: 'Failed to get tools status' },
      { status: 500 }
    )
  }
}

/**
 * Check if required dependencies are installed
 */
async function checkDependencies(dependencies: string[]): Promise<void> {
  const missing: string[] = []

  for (const dep of dependencies) {
    try {
      await execAsync(`which ${dep}`)
    } catch {
      missing.push(dep)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing dependencies: ${missing.join(', ')}`)
  }
}

/**
 * Install a specific tool
 */
async function installTool(toolId: string, options: any): Promise<void> {
  const tool = SUPPORTED_TOOLS[toolId as SupportedTool]
  if (!tool) {
    throw new Error(`Unknown tool: ${toolId}`)
  }

  const scriptPath = tool.installationScript
  
  try {
    // Make script executable
    await execAsync(`chmod +x ${scriptPath}`)
    
    // Run installation script
    const { stdout, stderr } = await execAsync(`sudo bash ${scriptPath}`, {
      timeout: 300000, // 5 minutes
      env: {
        ...process.env,
        ...options.environment
      }
    })

    if (stderr && !stderr.includes('WARNING')) {
      throw new Error(stderr)
    }

    console.log(`Installation output for ${toolId}:`, stdout)
  } catch (error) {
    throw new Error(`Installation script failed: ${error}`)
  }
} 