/**
 * Mock AI Project Generator Component for testing
 */

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
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export function AIProjectGenerator() {
  const [prompt, setPrompt] = useState('')
  const [projectName, setProjectName] = useState('')
  const [language, setLanguage] = useState('')
  const [framework, setFramework] = useState('')
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedProject, setGeneratedProject] = useState<any>(null)
  const [error, setError] = useState('')

  const router = useRouter()
  const { data: session } = useSession()

  const features = ['Authentication', 'Database', 'Real-time', 'Testing', 'API', 'UI/UX']

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev => 
      prev.includes(feature) 
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    )
  }

  const handleGenerate = async () => {
    if (!session?.user) {
      setError('Please sign in to generate projects')
      return
    }

    setIsGenerating(true)
    setError('')

    try {
      const response = await fetch('/api/ai/generate-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          projectName,
          language,
          framework,
          features: selectedFeatures,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate project')
      }

      setGeneratedProject(data)

      // Auto-redirect after 2 seconds
      setTimeout(() => {
        router.push(data.workspaceUrl)
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  if (generatedProject) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Project "{generatedProject.projectStructure.name}" generated successfully!</CardTitle>
            <CardDescription>Your project has been created and is ready for development</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong className="text-gray-700">{generatedProject.projectStructure.name}</strong>
                <p className="text-gray-600">{generatedProject.projectStructure.description}</p>
              </div>
              <div className="text-right">
                <div className="text-gray-700">{generatedProject.projectStructure.fileCount || generatedProject.projectStructure.files?.length} files</div>
                <div className="text-gray-600">{generatedProject.projectStructure.language}</div>
                <div className="text-gray-600">{generatedProject.projectStructure.framework}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => router.push(generatedProject.workspaceUrl)}>
                Open in Code Editor
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Project Generator</CardTitle>
          <CardDescription>
            Describe your project idea and let AI generate a complete, production-ready codebase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="prompt">Project Description</Label>
              <Textarea
                id="prompt"
                placeholder="Describe your project idea in detail..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  placeholder="my-awesome-project"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div>
                <Label>Preferred Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Framework</Label>
              <Select value={framework} onValueChange={setFramework}>
                <SelectTrigger>
                  <SelectValue placeholder="Select framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="react">React</SelectItem>
                  <SelectItem value="express">Express</SelectItem>
                  <SelectItem value="fastapi">FastAPI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Features to Include</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {features.map((feature) => (
                  <Badge
                    key={feature}
                    variant={selectedFeatures.includes(feature) ? 'default' : 'outline'}
                    className={`cursor-pointer ${
                      selectedFeatures.includes(feature) 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleFeature(feature)}
                  >
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>

            {isGenerating && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span>Generating Project...</span>
                </div>
                <Progress className="w-full" />
                <p className="text-sm text-gray-600">Generating project...</p>
              </div>
            )}

            <Button 
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="w-full"
            >
              {isGenerating ? 'Generating Project...' : 'Generate Project'}
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Example Project Ideas:</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>"Create a task management app with drag-and-drop functionality"</p>
              <p>"Build a real-time chat application with user authentication"</p>
              <p>"Generate a blog platform with markdown support and comments"</p>
              <p>"Create an e-commerce site with product catalog and payment integration"</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}