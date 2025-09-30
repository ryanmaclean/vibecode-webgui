/**
 * Self-Consistent Reasoning Demo Component
 * Demonstrates the Chain-of-Thought with Self-Consistency feature in the UI
 */

'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, Brain, CheckCircle, Clock, Target } from 'lucide-react'

interface SelfConsistentReasoningResult {
  consensusAnswer: string
  confidence: number
  reasoning: string
  paths: Array<{
    id: string
    model: string
    finalAnswer: string
    confidence: number
    thoughtsCount: number
    summary: string
  }>
  answerComparison: {
    consensus: string | null
    agreementRatio: number
    answerGroups: Array<{
      answer: string
      frequency: number
      avgConfidence: number
    }>
  }
  metrics: {
    totalTime: number
    successRate: number
    pathsGenerated: number
    configUsed: any
  }
}

export function SelfConsistentReasoningDemo() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SelfConsistentReasoningResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState({
    numPaths: 5,
    maxThoughtsPerPath: 10,
    minConsensusThreshold: 0.6,
    useModelDiversity: true,
    confidenceWeighting: true
  })

  const examplePrompts = [
    {
      title: "Mathematical Problem",
      prompt: "If a train travels 180 miles in 3 hours, what is its average speed in miles per hour? Show your work step by step."
    },
    {
      title: "Logic Problem", 
      prompt: "All roses are flowers. Some flowers are red. Some red things are beautiful. Can we conclude that some roses are beautiful? Explain your reasoning."
    },
    {
      title: "Word Problem",
      prompt: "A farmer has 17 sheep, and all but 9 die. How many sheep are left? Think through this carefully."
    }
  ]

  const handleSubmit = async () => {
    if (!prompt.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/ai/reasoning/self-consistent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          config,
          context: {
            taskType: 'planning',
            priority: 'medium',
            expectedTokens: 2000
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to process reasoning request')
      }

      const data = await response.json()
      setResult(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800'
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Brain className="h-8 w-8 text-blue-600" />
          Chain-of-Thought with Self-Consistency
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Generate multiple reasoning paths and build consensus for higher reliability.
          This advanced AI technique improves accuracy by leveraging diverse reasoning approaches.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reasoning Input</CardTitle>
          <CardDescription>
            Enter a problem or question that requires step-by-step reasoning
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Problem/Question:</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your reasoning problem here..."
              className="min-h-[100px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Example Prompts:</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {examplePrompts.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompt(example.prompt)}
                  className="text-left h-auto p-3"
                >
                  <div>
                    <div className="font-medium">{example.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {example.prompt.substring(0, 60)}...
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-4 items-end">
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !prompt.trim()}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4" />
                  Generate Reasoning
                </>
              )}
            </Button>
            
            <div className="text-sm text-gray-500">
              Paths: {config.numPaths} | Threshold: {(config.minConsensusThreshold * 100).toFixed(0)}%
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error:</span>
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-6">
          {/* Consensus Result */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Consensus Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="font-medium text-blue-900 mb-2">Final Answer:</div>
                <div className="text-lg font-semibold text-blue-800">
                  {result.consensusAnswer}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getConfidenceColor(result.confidence)}`}>
                    {(result.confidence * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">Confidence</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-700">
                    {(result.answerComparison.agreementRatio * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">Agreement</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-700">
                    {result.metrics.pathsGenerated}
                  </div>
                  <div className="text-sm text-gray-500">Paths</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-700">
                    {result.metrics.totalTime}ms
                  </div>
                  <div className="text-sm text-gray-500">Processing</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Analysis */}
          <Tabs defaultValue="reasoning" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="reasoning">Consensus Reasoning</TabsTrigger>
              <TabsTrigger value="paths">Individual Paths</TabsTrigger>
              <TabsTrigger value="analysis">Answer Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="reasoning" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Reasoning Explanation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded">
                      {result.reasoning}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="paths" className="space-y-4">
              <div className="grid gap-4">
                {result.paths.map((path, index) => (
                  <Card key={path.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">Path {index + 1}</CardTitle>
                        <div className="flex gap-2">
                          <Badge variant="outline">{path.model}</Badge>
                          <Badge className={getConfidenceBadge(path.confidence)}>
                            {(path.confidence * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <strong>Answer:</strong> {path.finalAnswer}
                        </div>
                        <div>
                          <strong>Thoughts:</strong> {path.thoughtsCount} steps
                        </div>
                        <div className="text-sm text-gray-600">
                          {path.summary}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Answer Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.answerComparison.answerGroups.map((group, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">"{group.answer}"</span>
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            {group.frequency} path{group.frequency !== 1 ? 's' : ''}
                          </Badge>
                          <Badge className={getConfidenceBadge(group.avgConfidence)}>
                            {(group.avgConfidence * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <Progress 
                        value={(group.frequency / result.metrics.pathsGenerated) * 100}
                        className="h-2"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}