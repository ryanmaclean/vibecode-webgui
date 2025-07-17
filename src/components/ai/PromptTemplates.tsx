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
  Star
} from 'lucide-react'

// Pre-defined prompt templates organized by category
const PROMPT_TEMPLATES = {
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
      template: 'Please refactor this {language} code to improve:\n- Readability\n- Performance\n- Maintainability\n- Following best practices\n\nOriginal code:\n```{language}\n{code}\n```\n\nProvide the refactored version with explanations of changes made.',
      variables: ['language', 'code'],
      category: 'Code Development',
      popular: true
    }
  ],
  'Debugging': [
    {
      id: 'debug-error',
      name: 'Debug Error',
      description: 'Help diagnose and fix bugs',
      icon: Bug,
      template: 'I\'m encountering an error in my {language} code. Please help me debug it:\n\n**Error Message:**\n```\n{error}\n```\n\n**Code:**\n```{language}\n{code}\n```\n\n**Expected Behavior:**\n{expected}\n\n**Actual Behavior:**\n{actual}\n\nPlease provide:\n1. Root cause analysis\n2. Step-by-step debugging approach\n3. Fixed code solution\n4. Prevention strategies',
      variables: ['language', 'error', 'code', 'expected', 'actual'],
      category: 'Debugging',
      popular: true
    },
    {
      id: 'performance-issue',
      name: 'Performance Analysis',
      description: 'Analyze and optimize performance issues',
      icon: Search,
      template: 'My {language} application is experiencing performance issues:\n\n**Problem:**\n{problem}\n\n**Code:**\n```{language}\n{code}\n```\n\n**Performance Metrics (if available):**\n{metrics}\n\nPlease analyze and provide:\n1. Performance bottlenecks\n2. Optimization strategies\n3. Improved code implementation\n4. Monitoring recommendations',
      variables: ['language', 'problem', 'code', 'metrics'],
      category: 'Debugging'
    }
  ],
  'Architecture': [
    {
      id: 'system-design',
      name: 'System Design',
      description: 'Design scalable system architecture',
      icon: Lightbulb,
      template: 'I need to design a system for: {requirement}\n\n**Requirements:**\n- {functional_requirements}\n- Expected scale: {scale}\n- Technology constraints: {constraints}\n\nPlease provide:\n1. High-level architecture diagram description\n2. Component breakdown\n3. Technology stack recommendations\n4. Scalability considerations\n5. Security implications\n6. Implementation approach',
      variables: ['requirement', 'functional_requirements', 'scale', 'constraints'],
      category: 'Architecture'
    },
    {
      id: 'api-design',
      name: 'API Design',
      description: 'Design RESTful APIs and data models',
      icon: FileText,
      template: 'Design a {api_type} API for: {purpose}\n\n**Requirements:**\n{requirements}\n\n**Data entities:**\n{entities}\n\nPlease provide:\n1. API endpoints with HTTP methods\n2. Request/response schemas\n3. Authentication approach\n4. Error handling strategy\n5. Documentation structure\n6. Rate limiting considerations',
      variables: ['api_type', 'purpose', 'requirements', 'entities'],
      category: 'Architecture'
    }
  ],
  'Learning': [
    {
      id: 'learn-concept',
      name: 'Learn Concept',
      description: 'Learn new programming concepts with examples',
      icon: Star,
      template: 'I want to learn about {concept} in {context}.\n\nMy current experience level: {experience_level}\n\nPlease explain:\n1. What {concept} is and why it\'s important\n2. Key principles and concepts\n3. Practical examples with code\n4. Common use cases\n5. Best practices\n6. Resources for further learning',
      variables: ['concept', 'context', 'experience_level'],
      category: 'Learning'
    },
    {
      id: 'compare-technologies',
      name: 'Compare Technologies',
      description: 'Compare different technologies or approaches',
      icon: Search,
      template: 'Compare {technology_1} vs {technology_2} for {use_case}:\n\n**Project context:**\n{context}\n\n**Requirements:**\n{requirements}\n\nPlease provide:\n1. Feature comparison\n2. Pros and cons of each\n3. Performance considerations\n4. Learning curve\n5. Community and ecosystem\n6. Recommendation with reasoning',
      variables: ['technology_1', 'technology_2', 'use_case', 'context', 'requirements'],
      category: 'Learning'
    }
  ]
}

interface PromptTemplatesProps {
  onSelectTemplate: (prompt: string) => void
  className?: string
}

interface TemplateVariable {
  name: string
  value: string
}

export default function PromptTemplates({ onSelectTemplate, className = '' }: PromptTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState('Code Development')
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [variables, setVariables] = useState<TemplateVariable[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const categories = Object.keys(PROMPT_TEMPLATES)

  // Get all templates for search
  const allTemplates = Object.values(PROMPT_TEMPLATES).flat()

  // Filter templates based on search
  const filteredTemplates = searchTerm
    ? allTemplates.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : PROMPT_TEMPLATES[selectedCategory] || []

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template)
    // Initialize variables
    const templateVars = template.variables.map((varName: string) => ({
      name: varName,
      value: ''
    }))
    setVariables(templateVars)
  }

  const handleVariableChange = (varName: string, value: string) => {
    setVariables(prev => prev.map(v =>
      v.name === varName ? { ...v, value } : v
    ))
  }

  const generatePrompt = () => {
    if (!selectedTemplate) return ''

    let prompt = selectedTemplate.template
    variables.forEach(variable => {
      prompt = prompt.replace(new RegExp(`{${variable.name}}`, 'g'), variable.value)
    })

    return prompt
  }

  const handleUseTemplate = () => {
    const prompt = generatePrompt()
    onSelectTemplate(prompt)
    setSelectedTemplate(null)
    setVariables([])
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Prompt Templates</h3>
          <p className="text-sm text-muted-foreground">
            Choose from pre-built templates to enhance your AI conversations
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search templates..."
          className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Categories */}
      {!searchTerm && (
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map(template => {
          const IconComponent = template.icon
          return (
            <Card
              key={template.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleTemplateSelect(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                  </div>
                  <div className="flex items-center space-x-1">
                    {template.popular && (
                      <Badge variant="secondary" className="text-xs">
                        Popular
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(template.template)
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{template.description}</p>
              </CardHeader>
            </Card>
          )
        })}
      </div>

      {/* Template Configuration Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <selectedTemplate.icon className="h-5 w-5" />
                <span>{selectedTemplate.name}</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Variables */}
              <div className="space-y-3">
                <h4 className="font-medium">Fill in the template variables:</h4>
                {variables.map(variable => (
                  <div key={variable.name}>
                    <label className="block text-sm font-medium mb-1 capitalize">
                      {variable.name.replace(/_/g, ' ')}
                    </label>
                    <textarea
                      className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                      placeholder={`Enter ${variable.name.replace(/_/g, ' ')}`}
                      value={variable.value}
                      onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div>
                <h4 className="font-medium mb-2">Preview:</h4>
                <div className="bg-gray-50 p-3 rounded-md text-sm whitespace-pre-wrap border">
                  {generatePrompt() || 'Fill in the variables above to see the prompt preview'}
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
