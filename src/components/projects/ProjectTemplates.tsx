'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Clock, Star, Code, Zap, Download, ExternalLink } from 'lucide-react'
import { 
  PROJECT_TEMPLATES, 
  ProjectTemplate, 
  TEMPLATE_CATEGORIES, 
  TEMPLATE_LANGUAGES,
  TEMPLATE_FRAMEWORKS,
  getTemplatesByCategory,
  getPopularTemplates,
  searchTemplates
} from '@/lib/project-templates'

interface ProjectTemplatesProps {
  onTemplateSelect?: (template: ProjectTemplate) => void
  onCreateProject?: (template: ProjectTemplate, projectName: string) => void
}

export function ProjectTemplates({ onTemplateSelect, onCreateProject }: ProjectTemplatesProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all')
  const [selectedFramework, setSelectedFramework] = useState<string>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null)
  const [projectName, setProjectName] = useState('')

  const filteredTemplates = useMemo(() => {
    let templates = Object.values(PROJECT_TEMPLATES)

    if (searchQuery) {
      templates = searchTemplates(searchQuery)
    }

    if (selectedCategory !== 'all') {
      templates = templates.filter(template => template.category === selectedCategory)
    }

    if (selectedLanguage !== 'all') {
      templates = templates.filter(template => template.language === selectedLanguage)
    }

    if (selectedFramework !== 'all') {
      templates = templates.filter(template => template.framework === selectedFramework)
    }

    return templates
  }, [searchQuery, selectedCategory, selectedLanguage, selectedFramework])

  const popularTemplates = getPopularTemplates()

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplate(template)
    onTemplateSelect?.(template)
  }

  const handleCreateProject = () => {
    if (selectedTemplate && projectName.trim()) {
      onCreateProject?.(selectedTemplate, projectName.trim())
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Project Templates</h1>
        <p className="text-gray-600">
          Choose from our curated collection of project templates to kickstart your development.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {TEMPLATE_CATEGORIES.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              {TEMPLATE_LANGUAGES.map(language => (
                <SelectItem key={language} value={language}>{language}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedFramework} onValueChange={setSelectedFramework}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Framework" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frameworks</SelectItem>
              {TEMPLATE_FRAMEWORKS.map(framework => (
                <SelectItem key={framework} value={framework}>{framework}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Templates</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => handleTemplateSelect(template)}
                isSelected={selectedTemplate?.id === template.id}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="popular" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {popularTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => handleTemplateSelect(template)}
                isSelected={selectedTemplate?.id === template.id}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <div className="space-y-8">
            {TEMPLATE_CATEGORIES.map(category => {
              const categoryTemplates = getTemplatesByCategory(category)
              if (categoryTemplates.length === 0) return null

              return (
                <div key={category}>
                  <h3 className="text-xl font-semibold mb-4">{category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryTemplates.map(template => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={() => handleTemplateSelect(template)}
                        isSelected={selectedTemplate?.id === template.id}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Selected Template Details */}
      {selectedTemplate && (
        <div className="mt-8 p-6 border rounded-lg bg-gray-50">
          <div className="mb-4">
            <h3 className="text-xl font-semibold mb-2">Create New Project</h3>
            <p className="text-gray-600 mb-4">
              Selected template: <strong>{selectedTemplate.name}</strong>
            </p>
            
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Project Name</label>
                <Input
                  placeholder="my-awesome-project"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleCreateProject}
                disabled={!projectName.trim()}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Create Project
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Features</h4>
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
              <h4 className="font-semibold mb-2">Setup Instructions</h4>
              <ol className="space-y-1 text-sm">
                {selectedTemplate.setupInstructions.map((instruction, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-gray-500">{index + 1}.</span>
                    {instruction}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface TemplateCardProps {
  template: ProjectTemplate
  onSelect: () => void
  isSelected: boolean
}

function TemplateCard({ template, onSelect, isSelected }: TemplateCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{template.name}</CardTitle>
            {template.popular && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
          </div>
          <Badge className={getDifficultyColor(template.difficulty)}>
            {template.difficulty}
          </Badge>
        </div>
        <CardDescription className="text-sm">
          {template.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Code className="w-4 h-4" />
            {template.language}
          </div>
          {template.framework && (
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4" />
              {template.framework}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {template.estimatedTime}
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {template.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {template.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{template.tags.length - 3}
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button variant="outline" size="sm" className="w-full">
          <ExternalLink className="w-4 h-4 mr-2" />
          Select Template
        </Button>
      </CardFooter>
    </Card>
  )
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case 'beginner': return 'bg-green-100 text-green-800'
    case 'intermediate': return 'bg-yellow-100 text-yellow-800'
    case 'advanced': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}