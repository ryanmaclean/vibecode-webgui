'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectTemplates } from '@/components/projects/ProjectTemplates'
import { ProjectScaffolder } from '@/components/projects/ProjectScaffolder'
import { AIProjectGenerator } from '@/components/projects/AIProjectGenerator'
import {
  FolderPlus,
  Sparkles,
  Download,
  ExternalLink,
  Rocket,
  Code,
  Zap,
  Shield,
  Bot
} from 'lucide-react'
import { ProjectTemplate } from '@/lib/project-templates'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function ProjectsPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null)
  const [projectName, setProjectName] = useState('')
  const [activeTab, setActiveTab] = useState('ai-generator')
  const router = useRouter()
  const { data: session } = useSession()

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplate(template)
    setActiveTab('scaffolder')
  }

  const handleCreateProject = (template: ProjectTemplate, name: string) => {
    setSelectedTemplate(template)
    setProjectName(name)
    setActiveTab('scaffolder')
  }

  const handleCreateWorkspace = async (projectData: { files: any[]; name: string }) => {
    try {
      if (!session?.user) {
        alert('Please sign in to create workspaces')
        return
      }

      // Create code-server session
      const sessionResponse = await fetch('/api/code-server/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: `template-${Date.now()}`,
          userId: session.user.id
        })
      })

      if (!sessionResponse.ok) {
        throw new Error('Failed to create code-server session')
      }
      const { url: workspaceUrl } = await sessionResponse.json()

      // Sync files to workspace
      await fetch('/api/files/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: projectData.files,
          workspaceId: `template-${Date.now()}`,
        }),
      })

      // Redirect to the new workspace
      router.push(workspaceUrl)
    } catch (error) {
      console.error('Failed to create workspace:', error)
      alert('Error creating workspace. See console for details.')
    }
  }

  const handleDownloadProject = (projectData: { files: any[]; name: string }) => {
    const zipContent = createProjectZip(projectData.files, projectData.name)
    const blob = new Blob([zipContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectData.name}-files.txt` // Simplified download
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-gray-50 text-gray-900">
      <div className="container mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-extrabold tracking-tight mb-4">
            Create Your Next Project
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Jumpstart your development with AI-powered generation, battle-tested templates, and seamless scaffolding.
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai-generator">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Generator
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FolderPlus className="w-4 h-4 mr-2" />
              From Template
            </TabsTrigger>
            <TabsTrigger value="scaffolder">
              <Rocket className="w-4 h-4 mr-2" />
              Scaffolder
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-generator">
            <AIProjectGenerator
              onProjectGenerated={(projectData) => {
                handleCreateWorkspace(projectData)
              }}
            />
          </TabsContent>

          <TabsContent value="templates">
            <ProjectTemplates onTemplateSelect={handleTemplateSelect} onCreateProject={handleCreateProject} />
          </TabsContent>

          <TabsContent value="scaffolder">
            {selectedTemplate ? (
              <ProjectScaffolder
                template={selectedTemplate}
                projectName={projectName || selectedTemplate.name.toLowerCase().replace(/\s+/g, '-')}
                onGenerate={handleCreateWorkspace}
                onDownload={handleDownloadProject}
              />
            ) : (
                <div className="text-center py-12">
                  <Card className="max-w-lg mx-auto">
                    <CardHeader>
                      <CardTitle>Select a Template First</CardTitle>
                      <CardDescription>
                        Go to the "From Template" tab to choose a project starter.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => setActiveTab('templates')}>
                        <FolderPlus className="w-4 h-4 mr-2" />
                        Browse Templates
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer CTA */}
      <div className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold mb-4">Ready to Build Something Amazing?</h3>
          <p className="text-gray-300 mb-6">
            Join thousands of developers using VibeCode to build production-ready applications faster than ever.
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100" onClick={() => setActiveTab('templates')}>
              <FolderPlus className="w-4 h-4 mr-2" />
              Browse Templates
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-gray-900">
              <Shield className="w-4 h-4 mr-2" />
              View Documentation
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to create project zip (simplified version)
function createProjectZip(files: any[], projectName: string): string {
  // In a real implementation, you'd use a library like JSZip
  // For now, return a simple text representation
  let zipContent = `# ${projectName} Project Files\n\n`

  files.forEach(file => {
    const typedFile = file as { path?: string; content?: string }
    zipContent += `## ${typedFile.path || 'unknown'}\n\`\`\`\n${typedFile.content || ''}\n\`\`\`\n\n`
  })

  return zipContent
}
