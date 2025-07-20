/**
 * AI Project Generator Component
 * Provides the core Lovable/Replit/Bolt.diy experience
 * User describes project → AI generates → Opens in code-server
 */

'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sparkles,
  Rocket,
  Code,
  Zap,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  ExternalLink
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

interface AIProjectGeneratorProps {
  className?: string
}

export function AIProjectGenerator({ className = '' }: AIProjectGeneratorProps) {
  const [prompt, setPrompt] = useState('')
  const [projectName, setProjectName] = useState('')
  const [language, setLanguage] = useState<string>('')
  const [framework, setFramework] = useState<string>('')
  const [features, setFeatures] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [generatedProject, setGeneratedProject] = useState<any>(null)

  const router = useRouter()
  const { data: session } = useSession()

  const languageOptions = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'react', label: 'React' },
    { value: 'nextjs', label: 'Next.js' },
    { value: 'vue', label: 'Vue.js' },
    { value: 'node', label: 'Node.js' },
  ]

  const frameworkOptions = [
    { value: 'express', label: 'Express.js' },
    { value: 'fastapi', label: 'FastAPI' },
    { value: 'flask', label: 'Flask' },
    { value: 'django', label: 'Django' },
    { value: 'nextjs', label: 'Next.js' },
    { value: 'nuxt', label: 'Nuxt.js' },
    { value: 'svelte', label: 'SvelteKit' },
    { value: 'solid', label: 'SolidJS' },
  ]

  const featureOptions = [
    'Authentication',
    'Database',
    'API',
    'Real-time',
    'Testing',
    'Docker',
    'CI/CD',
    'Monitoring',
    'Documentation',
    'Responsive Design',
    'PWA',
    'Performance Optimization'
  ]

  const handleFeatureToggle = (feature: string) => {
    setFeatures(prev => 
      prev.includes(feature) 
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    )
  }

  const generateProject = async () => {
    if (!prompt.trim()) {
      setError('Please describe your project idea')
      return
    }

    if (!session?.user) {
      setError('Please sign in to generate projects')
      return
    }

    setIsGenerating(true)
    setError(null)
    setSuccess(null)
    setProgress(0)

    try {
      // Step 1: Start generation
      setProgress(25)
      const response = await fetch('/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          projectName: projectName || undefined,
          language: language || undefined,
          framework: framework || undefined,
          features: features.length > 0 ? features : undefined,
        })
      })

      setProgress(50)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate project')
      }

      setProgress(75)
      const result = await response.json()
      
      setProgress(100)
      setGeneratedProject(result)
      setSuccess(`Project "${result.projectStructure.name}" generated successfully!`)

      // Auto-redirect to workspace after 2 seconds
      setTimeout(() => {
        router.push(result.workspaceUrl)
      }, 2000)

    } catch (error) {
      console.error('Project generation error:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate project')
    } finally {
      setIsGenerating(false)
    }
  }

  const openInWorkspace = () => {
    if (generatedProject) {
      router.push(generatedProject.workspaceUrl)
    }
  }

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            AI Project Generator
          </CardTitle>
          <CardDescription>
            Describe your project idea and let AI generate a complete, production-ready codebase
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Project Description */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Project Description *</Label>
            <Textarea
              id="prompt"
              placeholder="Describe your project idea... (e.g., 'Create a todo app with user authentication and real-time updates')"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="min-h-[120px]"
            />
          </div>

          {/* Project Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name (optional)</Label>
              <Input
                id="projectName"
                placeholder="my-awesome-project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Preferred Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-detect from description" />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="framework">Framework (optional)</Label>
              <Select value={framework} onValueChange={setFramework}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-select best fit" />
                </SelectTrigger>
                <SelectContent>
                  {frameworkOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <Label>Features to Include (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {featureOptions.map(feature => (
                <Badge
                  key={feature}
                  variant={features.includes(feature) ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-blue-100"
                  onClick={() => handleFeatureToggle(feature)}
                >
                  {feature}
                </Badge>
              ))}
            </div>
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Generating project...</span>
                <span className="text-sm text-gray-500">{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success */}
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {/* Generated Project Info */}
          {generatedProject && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-blue-900">
                      {generatedProject.projectStructure.name}
                    </h3>
                    <Badge variant="secondary">
                      {generatedProject.projectStructure.fileCount} files
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-blue-800">
                    {generatedProject.projectStructure.description}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-blue-700">
                    {generatedProject.projectStructure.language && (
                      <span className="flex items-center gap-1">
                        <Code className="w-4 h-4" />
                        {generatedProject.projectStructure.language}
                      </span>
                    )}
                    {generatedProject.projectStructure.framework && (
                      <span className="flex items-center gap-1">
                        <Zap className="w-4 h-4" />
                        {generatedProject.projectStructure.framework}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={openInWorkspace} className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Open in Code Editor
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          <Button
            onClick={generateProject}
            disabled={isGenerating || !prompt.trim()}
            size="lg"
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating Project...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5 mr-2" />
                Generate Project
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>

          {/* Examples */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Example Project Ideas:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• "Create a task management app with drag-and-drop functionality"</li>
              <li>• "Build a real-time chat application with user authentication"</li>
              <li>• "Generate a blog platform with markdown support and comments"</li>
              <li>• "Create an e-commerce site with product catalog and payment integration"</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}