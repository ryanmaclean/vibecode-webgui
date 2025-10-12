/**
 * AI Project Generator Component
 * Core UI component for Lovable.ai clone functionality
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, Code, Rocket, Download, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger';
interface ProjectTemplate {
  id: string
  name: string
  description: string
  framework: string
  features: string[]
  dependencies: string[]
  structure: Record<string, string>
  dockerfile?: string
  readme: string
}

interface GenerationResult {
  success: boolean
  project: ProjectTemplate
  metadata: {
    generationTime: number
    filesGenerated: number
    framework: string
    features: string[]
  }
}

export default function AIProjectGenerator() {
  const [prompt, setPrompt] = useState('')
  const [framework, setFramework] = useState<string>('')
  const [complexity, setComplexity] = useState<'simple' | 'moderate' | 'complex'>('moderate')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedProject, setGeneratedProject] = useState<ProjectTemplate | null>(null)
  const [generationMetadata, setGenerationMetadata] = useState<GenerationResult['metadata'] | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a project description')
      return
    }

    setIsGenerating(true)
    setGeneratedProject(null)
    setGenerationMetadata(null)

    try {
      logger.info('🚀 Starting AI project generation...')
      
      const response = await fetch('/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          framework: framework || undefined,
          complexity,
          features: [] // TODO: Add feature selection UI
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Project generation failed')
      }

      const typedResult = result as GenerationResult

      logger.info('✅ Project generated successfully:', typedResult.project.name)
      
      setGeneratedProject(typedResult.project)
      setGenerationMetadata(typedResult.metadata)
      
      toast.success(`Project "${typedResult.project.name}" generated successfully!`, {
        description: `Generated ${typedResult.metadata.filesGenerated} files in ${(typedResult.metadata.generationTime / 1000).toFixed(1)}s`
      })

    } catch (error) {
      logger.error('❌ Project generation failed:', error)
      toast.error('Failed to generate project', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadProject = () => {
    if (!generatedProject) return

    // Create a zip-like structure as JSON for now
    // TODO: Implement actual zip file generation
    const projectData = {
      name: generatedProject.name,
      structure: generatedProject.structure,
      dockerfile: generatedProject.dockerfile,
      readme: generatedProject.readme,
      dependencies: generatedProject.dependencies
    }

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { 
      type: 'application/json' 
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${generatedProject.name.toLowerCase().replace(/\s+/g, '-')}-project.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Project downloaded successfully!')
  }

  const createWorkspace = async () => {
    if (!generatedProject) return

    try {
      toast.success('Creating live workspace...', {
        description: 'This will provision a new development environment on AKS'
      })

      logger.info('🚀 Creating workspace for project:', generatedProject.name)

      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: generatedProject.id,
          projectName: generatedProject.name,
          framework: generatedProject.framework,
          files: generatedProject.structure,
          dependencies: generatedProject.dependencies,
          environment: {
            NODE_ENV: 'development',
            PROJECT_NAME: generatedProject.name,
            PROJECT_FRAMEWORK: generatedProject.framework
          }
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Workspace creation failed')
      }

      logger.info('✅ Workspace created successfully:', result.workspace)

      toast.success('Live workspace created!', {
        description: `Your ${generatedProject.framework} project is now running at ${result.workspace.url}`,
        action: {
          label: 'Open Workspace',
          onClick: () => window.open(result.workspace.url, '_blank')
        }
      })

      // Optional: Open workspace in new tab automatically
      window.open(result.workspace.url, '_blank')

    } catch (error) {
      logger.error('❌ Workspace creation failed:', error)
      
      if (error instanceof Error) {
        if (error.message.includes('not configured') || error.message.includes('not available')) {
          toast.error('Workspace service not available', {
            description: 'Please deploy the application to AKS first to enable live workspaces.'
          })
        } else if (error.message.includes('permissions')) {
          toast.error('Insufficient permissions', {
            description: 'Unable to create workspace due to permission restrictions.'
          })
        } else if (error.message.includes('resources')) {
          toast.error('Insufficient resources', {
            description: 'Cluster resources are currently unavailable. Please try again later.'
          })
        } else {
          toast.error('Failed to create workspace', {
            description: error.message
          })
        }
      } else {
        toast.error('Failed to create workspace', {
          description: 'An unknown error occurred'
        })
      }
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-8 w-8 text-purple-600" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            AI Project Generator
          </h1>
        </div>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Describe your project in natural language and watch as AI generates a complete, 
          production-ready codebase with all the files you need.
        </p>
      </div>

      {/* Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Project Description
          </CardTitle>
          <CardDescription>
            Describe what you want to build. Be as specific as possible about features and functionality.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium mb-2">
              What do you want to build? *
            </label>
            <Textarea
              id="prompt"
              placeholder="e.g., A task management app with user authentication, real-time collaboration, and a clean dashboard. Users should be able to create projects, assign tasks, and track progress."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-32 resize-none"
              disabled={isGenerating}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Framework (Optional)
              </label>
              <Select value={framework} onValueChange={setFramework} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue placeholder="Let AI choose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Let AI choose</SelectItem>
                  <SelectItem value="react">React</SelectItem>
                  <SelectItem value="nextjs">Next.js</SelectItem>
                  <SelectItem value="vue">Vue.js</SelectItem>
                  <SelectItem value="angular">Angular</SelectItem>
                  <SelectItem value="svelte">Svelte</SelectItem>
                  <SelectItem value="node">Node.js</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="go">Go</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Complexity Level
              </label>
              <Select 
                value={complexity} 
                onValueChange={(value: 'simple' | 'moderate' | 'complex') => setComplexity(value)}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple - Basic functionality</SelectItem>
                  <SelectItem value="moderate">Moderate - Full-featured app</SelectItem>
                  <SelectItem value="complex">Complex - Enterprise-grade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating Project...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Project
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Project Results */}
      {generatedProject && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-green-600" />
              {generatedProject.name}
            </CardTitle>
            <CardDescription>
              {generatedProject.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Project Metadata */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{generatedProject.framework}</Badge>
              {generatedProject.features.slice(0, 5).map((feature) => (
                <Badge key={feature} variant="outline">
                  {feature}
                </Badge>
              ))}
              {generatedProject.features.length > 5 && (
                <Badge variant="outline">
                  +{generatedProject.features.length - 5} more
                </Badge>
              )}
            </div>

            {/* Generation Stats */}
            {generationMetadata && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-gray-900">Generation Time</div>
                    <div className="text-gray-600">{(generationMetadata.generationTime / 1000).toFixed(1)}s</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Files Generated</div>
                    <div className="text-gray-600">{generationMetadata.filesGenerated}</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Dependencies</div>
                    <div className="text-gray-600">{generatedProject.dependencies.length}</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Framework</div>
                    <div className="text-gray-600">{generationMetadata.framework}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Project Files Preview */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Generated Files</h4>
              <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                <div className="space-y-1 text-sm font-mono">
                  {Object.keys(generatedProject.structure).map((filePath) => (
                    <div key={filePath} className="text-gray-700">
                      📄 {filePath}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={downloadProject} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download Project
              </Button>
              <Button onClick={createWorkspace} className="flex-1">
                <ExternalLink className="h-4 w-4 mr-2" />
                Create Live Workspace
              </Button>
            </div>

            {/* README Preview */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">README Preview</h4>
              <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                  {generatedProject.readme}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
