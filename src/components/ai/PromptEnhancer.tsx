/**
 * Prompt Enhancer Component
 * Automatically improves user prompts using AI-powered suggestions
 */

'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Wand2,
  ArrowRight,
  Check,
  X,
  Lightbulb,
  Target,
  Brain,
  Zap
} from 'lucide-react'

// Prompt enhancement patterns and rules
const ENHANCEMENT_RULES = {
  clarity: {
    name: 'Clarity',
    icon: Target,
    rules: [
      {
        pattern: /^(.{1,20})$/,
        suggestion: 'Consider adding more context and specific details to your request.',
        enhance: (prompt: string) => `Please help me with the following task: ${prompt}\n\nAdditional context:\n- What I'm trying to achieve: [Please specify]\n- Current situation: [Please describe]\n- Specific requirements: [Please list]`
      },
      {
        pattern: /\b(help|do|make|create|fix)\b/i,
        suggestion: 'Specify exactly what kind of help, creation, or fixing you need.',
        enhance: (prompt: string) => prompt.replace(
          /\b(help|do|make|create|fix)\b/gi,
          (match) => `${match} specifically`
        )
      }
    ]
  },
  context: {
    name: 'Context',
    icon: Brain,
    rules: [
      {
        pattern: /code|programming|software/i,
        suggestion: 'Add programming language, framework, and tech stack details.',
        enhance: (prompt: string) => `${prompt}\n\nTechnical context:\n- Programming language: [Please specify]\n- Framework/Library: [Please specify]\n- Environment: [Please specify]\n- Current tech stack: [Please specify]`
      },
      {
        pattern: /error|bug|issue|problem/i,
        suggestion: 'Include error messages, expected vs actual behavior, and reproduction steps.',
        enhance: (prompt: string) => `${prompt}\n\nDebugging context:\n- Error message: [Please include full error]\n- Expected behavior: [Please describe]\n- Actual behavior: [Please describe]\n- Steps to reproduce: [Please list]\n- Environment details: [Please specify]`
      }
    ]
  },
  specificity: {
    name: 'Specificity',
    icon: Zap,
    rules: [
      {
        pattern: /best|good|better/i,
        suggestion: 'Define specific criteria for "best" or "good" in your context.',
        enhance: (prompt: string) => `${prompt}\n\nEvaluation criteria:\n- Performance requirements: [Please specify]\n- Constraints: [Please list]\n- Success metrics: [Please define]\n- Priority factors: [Please rank]`
      },
      {
        pattern: /how to|how do/i,
        suggestion: 'Specify your current knowledge level and learning goals.',
        enhance: (prompt: string) => `${prompt}\n\nLearning context:\n- My current experience level: [Beginner/Intermediate/Advanced]\n- What I already know: [Please describe]\n- Specific learning goals: [Please list]\n- Preferred explanation style: [Please specify]`
      }
    ]
  },
  format: {
    name: 'Output Format',
    icon: Lightbulb,
    rules: [
      {
        pattern: /.*/,
        suggestion: 'Specify desired output format (code examples, step-by-step guide, comparison table, etc.)',
        enhance: (prompt: string) => `${prompt}\n\nDesired output format:\n- [ ] Code examples with comments\n- [ ] Step-by-step instructions\n- [ ] Comparison table\n- [ ] Pros and cons list\n- [ ] Visual diagrams/flowcharts\n- [ ] Practical examples\n- [ ] Best practices summary\n\nPlease select the formats you prefer above.`
      }
    ]
  }
}

interface Enhancement {
  category: string
  rule: any
  applied: boolean
}

interface PromptEnhancerProps {
  originalPrompt: string
  onEnhancedPrompt: (prompt: string) => void
  className?: string
}

export default function PromptEnhancer({
  originalPrompt,
  onEnhancedPrompt,
  className = ''
}: PromptEnhancerProps) {
  const [enhancements, setEnhancements] = useState<Enhancement[]>([])
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const analyzePrompt = async () => {
    setIsAnalyzing(true)

    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    const foundEnhancements: Enhancement[] = []

    // Check against all enhancement rules
    Object.entries(ENHANCEMENT_RULES).forEach(([category, ruleGroup]) => {
      ruleGroup.rules.forEach(rule => {
        if (rule.pattern.test(originalPrompt)) {
          foundEnhancements.push({
            category,
            rule,
            applied: false
          })
        }
      })
    })

    setEnhancements(foundEnhancements)
    setIsAnalyzing(false)
  }

  const applyEnhancement = (index: number) => {
    const newEnhancements = [...enhancements]
    newEnhancements[index].applied = !newEnhancements[index].applied
    setEnhancements(newEnhancements)

    // Generate enhanced prompt
    let enhanced = originalPrompt
    newEnhancements.forEach(enhancement => {
      if (enhancement.applied) {
        enhanced = enhancement.rule.enhance(enhanced)
      }
    })

    setEnhancedPrompt(enhanced)
  }

  const applyAllEnhancements = () => {
    const newEnhancements = enhancements.map(e => ({ ...e, applied: true }))
    setEnhancements(newEnhancements)

    let enhanced = originalPrompt
    newEnhancements.forEach(enhancement => {
      enhanced = enhancement.rule.enhance(enhanced)
    })

    setEnhancedPrompt(enhanced)
  }

  const useEnhancedPrompt = () => {
    onEnhancedPrompt(enhancedPrompt)
  }

  // Auto-analyze when prompt changes
  React.useEffect(() => {
    if (originalPrompt.trim()) {
      analyzePrompt()
    }
  }, [originalPrompt])

  if (!originalPrompt.trim()) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <Wand2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            Enter a prompt above to get AI-powered enhancement suggestions
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wand2 className="h-5 w-5" />
            <span>Prompt Enhancer</span>
            {isAnalyzing && (
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            AI-powered suggestions to improve your prompt clarity and effectiveness
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Original Prompt */}
          <div>
            <h4 className="font-medium mb-2">Original Prompt:</h4>
            <div className="bg-gray-50 p-3 rounded-md text-sm border">
              {originalPrompt}
            </div>
          </div>

          {/* Enhancement Suggestions */}
          {enhancements.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Enhancement Suggestions:</h4>
                <Button size="sm" onClick={applyAllEnhancements}>
                  Apply All
                </Button>
              </div>

              <div className="space-y-3">
                {enhancements.map((enhancement, index) => {
                  const categoryData = ENHANCEMENT_RULES[enhancement.category as keyof typeof ENHANCEMENT_RULES]
                  const IconComponent = categoryData.icon

                  return (
                    <div
                      key={index}
                      className={`border rounded-lg p-3 transition-all ${
                        enhancement.applied ? 'border-green-500 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <IconComponent className="h-4 w-4 text-blue-600" />
                            <Badge variant="outline" className="text-xs">
                              {categoryData.name}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            {enhancement.rule.suggestion}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant={enhancement.applied ? "default" : "outline"}
                          onClick={() => applyEnhancement(index)}
                          className="ml-3"
                        >
                          {enhancement.applied ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Enhanced Prompt Preview */}
          {enhancedPrompt && (
            <div>
              <h4 className="font-medium mb-2 flex items-center space-x-2">
                <span>Enhanced Prompt:</span>
                <ArrowRight className="h-4 w-4 text-green-600" />
              </h4>
              <div className="bg-green-50 p-3 rounded-md text-sm border border-green-200 max-h-64 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {enhancedPrompt}
                </pre>
              </div>

              <div className="flex justify-end mt-3">
                <Button onClick={useEnhancedPrompt}>
                  Use Enhanced Prompt
                </Button>
              </div>
            </div>
          )}

          {/* No Enhancements Found */}
          {!isAnalyzing && enhancements.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <Check className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p>Your prompt looks great! No obvious improvements needed.</p>
              <p className="text-xs mt-1">
                Consider adding more context if you want more specific results.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
