'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectTemplates } from '@/components/projects/ProjectTemplates'
import { ProjectScaffolder } from '@/components/projects/ProjectScaffolder'
import {
  FolderPlus,
  Sparkles,
  Download,
  ExternalLink,
  Rocket,
  Code,
  Zap,
  Shield
} from 'lucide-react'
import { ProjectTemplate } from '@/lib/project-templates'

export default function ProjectsPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null)
  const [projectName, setProjectName] = useState('')
  const [activeTab, setActiveTab] = useState('templates')

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplate(template)
  }

  const handleCreateProject = (template: ProjectTemplate, name: string) => {
    setSelectedTemplate(template)
    setProjectName(name)
    setActiveTab('scaffolder')
  }

  const handleDownloadProject = (projectData: any) => {
    // Create a download bundle
    const projectFiles = projectData.files
    const zipContent = createProjectZip(projectFiles, projectData.name)

    // Trigger download
    const blob = new Blob([zipContent], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectData.name}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="border-b bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-3">
              AI-Powered Project Builder
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Create production-ready projects in minutes with our intelligent templates and scaffolding system.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <Card>
              <CardContent className="flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">15+</div>
                  <div className="text-sm text-gray-600">Templates</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">10+</div>
                  <div className="text-sm text-gray-600">Languages</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">5min</div>
                  <div className="text-sm text-gray-600">Setup Time</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">100%</div>
                  <div className="text-sm text-gray-600">Production Ready</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FolderPlus className="w-4 h-4" />
              Browse Templates
            </TabsTrigger>
            <TabsTrigger value="scaffolder" className="flex items-center gap-2" disabled={!selectedTemplate}>
              <Sparkles className="w-4 h-4" />
              AI Scaffolder
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            {!selectedTemplate ? (
              <>
                {/* Features Overview */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Rocket className="w-5 h-5 text-blue-500" />
                        Instant Setup
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600">
                        Get from idea to running code in minutes with our pre-configured templates and automated setup.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Code className="w-5 h-5 text-green-500" />
                        Best Practices
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600">
                        Every template follows industry best practices with proper structure, security, and performance optimizations.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        AI-Enhanced
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600">
                        Intelligent code generation and customization powered by advanced AI to match your specific needs.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <ProjectTemplates
                  onTemplateSelect={handleTemplateSelect}
                  onCreateProject={handleCreateProject}
                />
              </>
            ) : (
              <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedTemplate(null)}
                    className="mb-4"
                  >
                    ← Back to Templates
                  </Button>

                  <Card>
                    <CardHeader>
                      <CardTitle>{selectedTemplate.name}</CardTitle>
                      <CardDescription>{selectedTemplate.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-semibold mb-3">Features</h4>
                          <ul className="space-y-1 text-sm">
                            {selectedTemplate.features.map((feature, index) => (
                              <li key={index} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-3">Tech Stack</h4>
                          <div className="space-y-2 text-sm">
                            <div><strong>Language:</strong> {selectedTemplate.language}</div>
                            {selectedTemplate.framework && (
                              <div><strong>Framework:</strong> {selectedTemplate.framework}</div>
                            )}
                            <div><strong>Category:</strong> {selectedTemplate.category}</div>
                            <div><strong>Difficulty:</strong> {selectedTemplate.difficulty}</div>
                            <div><strong>Estimated Time:</strong> {selectedTemplate.estimatedTime}</div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t">
                        <div className="flex gap-4">
                          <Button
                            onClick={() => {
                              setProjectName(selectedTemplate.name.toLowerCase().replace(/\s+/g, '-'))
                              setActiveTab('scaffolder')
                            }}
                            className="flex items-center gap-2"
                          >
                            <Sparkles className="w-4 h-4" />
                            Start Building
                          </Button>

                          <Button variant="outline" className="flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" />
                            View Demo
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="scaffolder">
            {selectedTemplate && (
              <ProjectScaffolder
                template={selectedTemplate}
                projectName={projectName || selectedTemplate.name.toLowerCase().replace(/\s+/g, '-')}
                onDownload={handleDownloadProject}
              />
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
            <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100">
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
    zipContent += `## ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n\n`
  })

  return zipContent
}
