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
  ],
  'AI Applications': [
    {
      id: 'gradio-chatbot',
      name: 'Gradio Chatbot Interface',
      description: 'Create interactive chatbot with Gradio UI',
      icon: MessageSquare,
      template: 'Create a Gradio chatbot application with the following features:\n\n**Chatbot Purpose:** {chatbot_purpose}\n**AI Model:** {ai_model}\n**Features:** {features}\n\nPlease provide:\n1. Complete Python code with Gradio interface\n2. Chat history management\n3. Custom CSS styling\n4. Message formatting\n5. Error handling\n6. Deployment instructions\n\nInclude proper imports, model loading, and a responsive UI design.',
      variables: ['chatbot_purpose', 'ai_model', 'features'],
      category: 'AI Applications',
      popular: true
    },
    {
      id: 'gradio-image-analyzer',
      name: 'Gradio Image Analysis Tool',
      description: 'Build image processing and analysis interface',
      icon: Search,
      template: 'Create a Gradio image analysis application for: {analysis_type}\n\n**Input:** {input_format}\n**Analysis Features:**\n{analysis_features}\n\n**Output Requirements:**\n{output_requirements}\n\nPlease provide:\n1. Complete Gradio interface with image upload\n2. Image preprocessing pipeline\n3. Analysis function implementation\n4. Results visualization\n5. Batch processing capability\n6. Export functionality\n\nInclude proper error handling and progress indicators.',
      variables: ['analysis_type', 'input_format', 'analysis_features', 'output_requirements'],
      category: 'AI Applications',
      popular: true
    },
    {
      id: 'gradio-text-processor',
      name: 'Gradio Text Processing App',
      description: 'Create text analysis and processing tools',
      icon: FileText,
      template: 'Build a Gradio text processing application for: {processing_task}\n\n**Input:** {input_type}\n**Processing Features:**\n{processing_features}\n**Model/Library:** {model_library}\n\nPlease provide:\n1. Gradio interface with text input/upload\n2. Text preprocessing functions\n3. Processing pipeline implementation\n4. Results display with formatting\n5. Download/export options\n6. Performance metrics display\n\nInclude examples and proper documentation.',
      variables: ['processing_task', 'input_type', 'processing_features', 'model_library'],
      category: 'AI Applications'
    },
    {
      id: 'gradio-data-dashboard',
      name: 'Gradio Data Dashboard',
      description: 'Interactive data visualization and analysis dashboard',
      icon: Lightbulb,
      template: 'Create a Gradio data analysis dashboard for: {data_domain}\n\n**Data Source:** {data_source}\n**Analysis Types:** {analysis_types}\n**Visualizations:** {visualizations}\n\nPlease provide:\n1. Gradio interface with file upload/data input\n2. Data validation and cleaning\n3. Interactive charts and plots\n4. Statistical analysis functions\n5. Export capabilities\n6. Real-time updates\n\nInclude proper data handling and visualization libraries (plotly, matplotlib).',
      variables: ['data_domain', 'data_source', 'analysis_types', 'visualizations'],
      category: 'AI Applications'
    },
    {
      id: 'gradio-ml-model-demo',
      name: 'Gradio ML Model Demo',
      description: 'Create interactive machine learning model demonstration',
      icon: Star,
      template: 'Build a Gradio demo for a {model_type} model that performs: {task_description}\n\n**Model Details:**\n- Model: {model_name}\n- Input: {input_format}\n- Output: {output_format}\n\n**Demo Features:**\n{demo_features}\n\nPlease provide:\n1. Complete Gradio interface\n2. Model loading and inference code\n3. Input preprocessing\n4. Output postprocessing and display\n5. Example inputs for testing\n6. Performance metrics display\n7. Model information panel\n\nMake it user-friendly with clear instructions and examples.',
      variables: ['model_type', 'task_description', 'model_name', 'input_format', 'output_format', 'demo_features'],
      category: 'AI Applications',
      popular: true
    },
    {
      id: 'gradio-multimodal-app',
      name: 'Gradio Multimodal Application',
      description: 'Create apps that handle multiple input types',
      icon: Wand2,
      template: 'Create a multimodal Gradio application that processes: {input_types}\n\n**Application Purpose:** {app_purpose}\n**Processing Pipeline:** {pipeline_description}\n**Output Format:** {output_format}\n\nPlease provide:\n1. Gradio interface with multiple input components\n2. Input validation for each modality\n3. Unified processing pipeline\n4. Cross-modal analysis functions\n5. Rich output display\n6. Comparison tools\n7. Export and sharing features\n\nEnsure seamless integration between different input types.',
      variables: ['input_types', 'app_purpose', 'pipeline_description', 'output_format'],
      category: 'AI Applications'
    },
    {
      id: 'gradio-realtime-app',
      name: 'Gradio Real-time Processing',
      description: 'Build real-time AI processing applications',
      icon: Code,
      template: 'Create a real-time Gradio application for: {realtime_task}\n\n**Input Source:** {input_source}\n**Processing Requirements:** {processing_requirements}\n**Update Frequency:** {update_frequency}\n\nPlease provide:\n1. Gradio interface with real-time components\n2. Stream processing implementation\n3. Queue management for high throughput\n4. Live visualization updates\n5. Performance monitoring\n6. Resource management\n7. Graceful error handling\n\nOptimize for low latency and high throughput.',
      variables: ['realtime_task', 'input_source', 'processing_requirements', 'update_frequency'],
      category: 'AI Applications'
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
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null)
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
    : (PROMPT_TEMPLATES[selectedCategory as keyof typeof PROMPT_TEMPLATES] || [])

  const handleTemplateSelect = (template: PromptTemplate) => {
    setSelectedTemplate(template)
    // Initialize variables
    const templateVars = template.variables.map(varName => ({
      name: varName,
      value: ''
    }))
    setVariables(templateVars)
  }

  const updateVariable = (name: string, value: string) => {
    setVariables(prev => prev.map(variable =>
      variable.name === name ? { ...variable, value } : variable
    ))
  }

  const fillTemplate = () => {
    if (!selectedTemplate) return

    let filledTemplate = selectedTemplate.template
    variables.forEach(variable => {
      const placeholder = `{${variable.name}}`
      filledTemplate = filledTemplate.replace(new RegExp(placeholder, 'g'), variable.value)
    })

    onSelectTemplate(filledTemplate)
    setSelectedTemplate(null)
    setVariables([])
  }

  const copyTemplate = (template: PromptTemplate) => {
    navigator.clipboard.writeText(template.template)
  }

  const getPreviewTemplate = () => {
    if (!selectedTemplate) return 'Fill in the variables above to see the prompt preview'

    let preview = selectedTemplate.template
    variables.forEach(variable => {
      const placeholder = `{${variable.name}}`
      preview = preview.replace(new RegExp(placeholder, 'g'), variable.value || `{${variable.name}}`)
    })

    return preview
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
                        copyTemplate(template)
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
                  onClick={fillTemplate}
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
