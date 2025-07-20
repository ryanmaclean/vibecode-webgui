/**
 * Prompt Templates Component for Enhanced Prompt Engineering
 * Provides pre-built templates and intelligent prompt enhancement
 */

'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Code,
  MessageSquare,
  FileText,
  Bug,
  Lightbulb,
  Search,
  Wand2,
  Copy,
  Star,
  Users,
  FileClock,
  ShieldCheck,
  PackageSearch
} from 'lucide-react'

// Template type definition
interface PromptTemplate {
  id: string
  name: string
  description: string
  icon: React.ComponentType<any>
  template: string
  variables: string[]
  category: string
  popular?: boolean
}

// Pre-defined prompt templates organized by category
const PROMPT_TEMPLATES: Record<string, PromptTemplate[]> = {
  'Code Development': [
    {
      id: 'code-review',
      name: 'Code Review',
      description: 'Review code for best practices, bugs, and improvements',
      icon: Code,
      template: 'Please review the following code and provide feedback on:\n1. Code quality and best practices\n2. Potential bugs or issues\n3. Performance improvements\n4. Security considerations\n5. Readability and maintainability\n\nCode:\n```{language}\n{code}\n```',
      variables: ['language', 'code'],
      category: 'Code Development',
      popular: true
    },
    {
      id: 'code-explain',
      name: 'Explain Code',
      description: 'Get detailed explanations of how code works',
      icon: MessageSquare,
      template: 'Please explain the following {language} code in detail:\n\n```{language}\n{code}\n```\n\nInclude:\n- What the code does\n- How it works step by step\n- Key concepts used\n- Any notable patterns or techniques',
      variables: ['language', 'code'],
      category: 'Code Development'
    },
    {
      id: 'refactor-code',
      name: 'Refactor Code',
      description: 'Improve code structure and maintainability',
      icon: Wand2,
      template: 'Please refactor this {language} code to improve:\n- Readability\n- Performance\n- Maintainability\n- Adherence to best practices\n\nCode:\n```{language}\n{code}\n```',
      variables: ['language', 'code'],
      category: 'Code Development'
    },
    {
      id: 'generate-docs',
      name: 'Generate Docs',
      description: 'Create documentation from code',
      icon: FileText,
      template: 'Generate documentation for the following {language} code:\n\n```{language}\n{code}\n```\n\nFocus on:\n- Function purpose\n- Parameters\n- Return values\n- Usage examples',
      variables: ['language', 'code'],
      category: 'Code Development'
    }
  ],
  'Testing & Debugging': [
    {
      id: 'find-bugs',
      name: 'Find Bugs',
      description: 'Analyze code to find potential bugs',
      icon: Bug,
      template: 'Analyze the following {language} code and identify potential bugs or errors. For each issue, explain the problem and suggest a fix.\n\nCode:\n```{language}\n{code}\n```',
      variables: ['language', 'code'],
      category: 'Testing & Debugging',
      popular: true
    },
    {
      id: 'write-tests',
      name: 'Write Unit Tests',
      description: 'Generate unit tests for a piece of code',
      icon: FileText,
      template: 'Write comprehensive unit tests for the following {language} code using the {testing_framework} framework.\n\nCode:\n```{language}\n{code}\n```\n\nEnsure tests cover:\n- Happy paths\n- Edge cases\n- Error handling',
      variables: ['language', 'code', 'testing_framework'],
      category: 'Testing & Debugging'
    }
  ],
  'Security': [
    {
      id: 'security-audit',
      name: 'Security Audit',
      description: 'Audit code for common security vulnerabilities',
      icon: ShieldCheck,
      template: 'Perform a security audit on the following {language} code. Look for common vulnerabilities such as {vulnerabilities_list} and other potential security risks.\n\nCode:\n```{language}\n{code}\n```',
      variables: ['language', 'code', 'vulnerabilities_list'],
      category: 'Security',
      popular: true
    },
    {
      id: 'dependency-check',
      name: 'Dependency Check',
      description: 'Analyze dependencies for known vulnerabilities',
      icon: PackageSearch,
      template: 'Analyze the following list of project dependencies from {package_manager_file} and check for known security vulnerabilities. Provide a summary of any found vulnerabilities and suggest remediation steps.\n\nDependencies:\n```{text}\n{dependencies}\n```',
      variables: ['package_manager_file', 'dependencies'],
      category: 'Security'
    }
  ],
  'Project Management': [
    {
      id: 'user-story',
      name: 'User Story',
      description: 'Generate user stories from a feature description',
      icon: Users,
      template: 'As a {user_role}, I want to {action} so that I can {benefit}.\n\nFeature Description:\n{feature_description}',
      variables: ['user_role', 'action', 'benefit', 'feature_description'],
      category: 'Project Management',
      popular: true
    },
    {
      id: 'release-notes',
      name: 'Release Notes',
      description: 'Draft release notes for a new version',
      icon: FileClock,
      template: 'Generate release notes for version {version_number}.\n\nNew Features:\n{new_features}\n\nBug Fixes:\n{bug_fixes}\n\nImprovements:\n{improvements}',
      variables: ['version_number', 'new_features', 'bug_fixes', 'improvements'],
      category: 'Project Management'
    }
  ],
  'General': [
    {
      id: 'brainstorm-ideas',
      name: 'Brainstorm Ideas',
      description: 'Generate creative ideas for a given topic',
      icon: Lightbulb,
      template: 'Brainstorm and list creative ideas about {topic}. Provide a diverse range of ideas, from practical to innovative.',
      variables: ['topic'],
      category: 'General'
    }
  ]
}

interface PromptTemplatesProps {
  onUseTemplate: (template: string) => void
}

export default function PromptTemplates({ onUseTemplate }: PromptTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null)
  const [variables, setVariables] = useState<{ name: string; value: string }[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  const allTemplates = Object.values(PROMPT_TEMPLATES).flat()
  const categories = ['All', 'Popular', ...Object.keys(PROMPT_TEMPLATES)]

  const filteredTemplates = allTemplates.filter(template => {
    const matchesCategory = activeCategory === 'All' || 
                            (activeCategory === 'Popular' && template.popular) || 
                            template.category === activeCategory
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          template.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleSelectTemplate = (template: PromptTemplate) => {
    setSelectedTemplate(template)
    setVariables(template.variables.map(v => ({ name: v, value: '' })))
  }

  const updateVariable = (name: string, value: string) => {
    setVariables(vars => vars.map(v => (v.name === name ? { ...v, value } : v)))
  }

  const getPreviewTemplate = () => {
    if (!selectedTemplate) return ''
    return variables.reduce((acc, v) => {
      return acc.replace(new RegExp(`{${v.name}}`, 'g'), v.value || `{${v.name}}`)
    }, selectedTemplate.template)
  }

  const handleUseTemplate = () => {
    onUseTemplate(getPreviewTemplate())
    setSelectedTemplate(null)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Search and Filter */}
      <div className="mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 border rounded-full bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <Button
              key={category}
              variant={activeCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(category)}
            >
              {category === 'Popular' && <Star className="w-4 h-4 mr-2" />} 
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <Card
            key={template.id}
            className="cursor-pointer hover:shadow-lg transition-shadow bg-card text-card-foreground"
            onClick={() => handleSelectTemplate(template)}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <template.icon className="h-8 w-8 mb-2 text-primary" />
                {template.popular && <Badge variant="secondary">Popular</Badge>}
              </div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Template Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl bg-background">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl flex items-center">
                  <selectedTemplate.icon className="h-6 w-6 mr-2" />
                  {selectedTemplate.name}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(getPreviewTemplate())}>
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{selectedTemplate.description}</p>
              
              {/* Variables */}
              <div className="space-y-3">
                {variables.map(variable => (
                  <div key={variable.name}>
                    <label className="block text-sm font-medium mb-1 capitalize">
                      {variable.name.replace(/_/g, ' ')}
                    </label>
                    <textarea
                      className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                      placeholder={`Enter ${variable.name.replace(/_/g, ' ')}`}
                      value={variable.value}
                      onChange={(e) => updateVariable(variable.name, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div>
                <h4 className="font-medium mb-2">Preview:</h4>
                <div className="bg-gray-50 p-3 rounded-md text-sm whitespace-pre-wrap border">
                  {getPreviewTemplate()}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setSelectedTemplate(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUseTemplate}
                  disabled={variables.some(v => !v.value.trim())}
                >
                  Use Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No templates found matching &quot;{searchTerm}&quot;</p>
          <p className="text-sm">Try a different search term or browse by category</p>
        </div>
      )}
    </div>
  )
}
