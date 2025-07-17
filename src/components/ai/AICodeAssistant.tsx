/**
 * AI Code Assistant Component
 *
 * Comprehensive AI-powered development assistance with code-server integration
 * Based on claude-prompt.md webview patterns for VS Code extension compatibility
 *
 * Staff Engineer Implementation - Production-ready AI code assistance
 */

'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Bot,
  Code,
  FileSearch,
  Zap,
  Bug,
  TestTube,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle
} from 'lucide-react'
import { claudeCodeSDK } from '@/lib/claude-code-sdk'
import type {
  GenerateCodeRequest,
  GenerateCodeResponse,
  CodeAnalysisRequest,
  CodeAnalysisResponse,
  CodeContext
} from '@/lib/claude-code-sdk'

interface AICodeAssistantProps {
  className?: string
  codeContext?: CodeContext
  selectedText?: string
  onCodeGenerated?: (code: string, explanation?: string) => void
  onAnalysisComplete?: (analysis: CodeAnalysisResponse) => void
}

type AssistantMode = 'generate' | 'analyze' | 'optimize' | 'debug' | 'test' | 'explain'

export default function AICodeAssistant({
  className = '',
  codeContext,
  selectedText,
  onCodeGenerated,
  onAnalysisComplete
}: AICodeAssistantProps) {
  const [mode, setMode] = useState<AssistantMode>('generate')
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<GenerateCodeResponse | CodeAnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']))
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set())

  const promptRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus prompt input when mode changes
  useEffect(() => {
    promptRef.current?.focus()
  }, [mode])

  // Update prompt based on selected text and mode
  useEffect(() => {
    if (selectedText && mode !== 'generate') {
      setPrompt(`Selected code:\n\`\`\`${codeContext?.language || 'javascript'}\n${selectedText}\n\`\`\``)
    }
  }, [selectedText, mode, codeContext?.language])

  const handleModeChange = (newMode: AssistantMode) => {
    setMode(newMode)
    setResult(null)
    setError(null)

    // Set default prompts based on mode
    const defaultPrompts = {
      generate: 'Write a function that...',
      analyze: 'Analyze this code for potential issues and improvements',
      optimize: 'Optimize this code for better performance',
      debug: 'Help me debug this code and find potential issues',
      test: 'Generate comprehensive test cases for this code',
      explain: 'Explain how this code works and what it does'
    }

    if (!selectedText) {
      setPrompt(defaultPrompts[newMode])
    }
  }

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const context: CodeContext = {
        language: codeContext?.language || 'javascript',
        filePath: codeContext?.filePath || 'untitled.js',
        selectedText,
        fullText: codeContext?.fullText,
        cursorPosition: codeContext?.cursorPosition,
        projectStructure: codeContext?.projectStructure,
        recentChanges: codeContext?.recentChanges
      }

      if (mode === 'generate') {
        const request: GenerateCodeRequest = {
          prompt,
          context,
          maxTokens: 4096,
          temperature: 0.1
        }

        const response = await claudeCodeSDK.generateCode(request)
        setResult(response)
        onCodeGenerated?.(response.code, response.explanation)
      } else {
        const request: CodeAnalysisRequest = {
          code: selectedText || codeContext?.fullText || '',
          language: context.language,
          analysisType: mode === 'analyze' ? 'review' :
                       mode === 'optimize' ? 'optimize' :
                       mode === 'debug' ? 'debug' :
                       mode === 'test' ? 'test' : 'explain'
        }

        const response = await claudeCodeSDK.analyzeCode(request)
        setResult(response)
        onAnalysisComplete?.(response)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('AI Assistant error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItems(prev => new Set(prev).add(id))
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
      }, 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const modeConfig = {
    generate: { icon: Code, label: 'Generate Code', color: 'blue' },
    analyze: { icon: FileSearch, label: 'Analyze Code', color: 'green' },
    optimize: { icon: Zap, label: 'Optimize Code', color: 'yellow' },
    debug: { icon: Bug, label: 'Debug Code', color: 'red' },
    test: { icon: TestTube, label: 'Generate Tests', color: 'purple' },
    explain: { icon: FileText, label: 'Explain Code', color: 'indigo' }
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">AI Code Assistant</h3>
        </div>
        {codeContext?.filePath && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {codeContext.filePath}
          </div>
        )}
      </div>

      {/* Mode Selector */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(modeConfig).map(([key, config]) => {
            const isActive = mode === key
            const Icon = config.icon
            return (
              <button
                key={key}
                onClick={() => handleModeChange(key as AssistantMode)}
                className={`flex items-center space-x-2 p-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? `bg-${config.color}-100 dark:bg-${config.color}-900/20 text-${config.color}-700 dark:text-${config.color}-300 border border-${config.color}-200 dark:border-${config.color}-800`
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{config.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <textarea
          ref={promptRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Enter your ${modeConfig[mode].label.toLowerCase()} request...`}
          className="w-full h-32 resize-none border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Press Ctrl+Enter to submit
          </div>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !prompt.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 text-sm"
          >
            {isLoading ? 'Processing...' : 'Submit'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Error</span>
            </div>
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {result && mode === 'generate' && (
          <GenerateCodeResult
            result={result as GenerateCodeResponse}
            expandedSections={expandedSections}
            copiedItems={copiedItems}
            onToggleSection={toggleSection}
            onCopy={copyToClipboard}
          />
        )}

        {result && mode !== 'generate' && (
          <AnalysisResult
            result={result as CodeAnalysisResponse}
            expandedSections={expandedSections}
            copiedItems={copiedItems}
            onToggleSection={toggleSection}
            onCopy={copyToClipboard}
          />
        )}

        {!result && !error && !isLoading && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Select a mode and enter your request to get AI assistance.</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface GenerateCodeResultProps {
  result: GenerateCodeResponse
  expandedSections: Set<string>
  copiedItems: Set<string>
  onToggleSection: (section: string) => void
  onCopy: (text: string, id: string) => void
}

function GenerateCodeResult({
  result,
  expandedSections,
  copiedItems,
  onToggleSection,
  onCopy
}: GenerateCodeResultProps) {
  return (
    <div className="space-y-4">
      {/* Generated Code */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => onToggleSection('code')}
          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Code className="w-4 h-4" />
            <span className="font-medium">Generated Code</span>
            <span className="text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 rounded">
              Confidence: {Math.round(result.confidence * 100)}%
            </span>
          </div>
          {expandedSections.has('code') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {expandedSections.has('code') && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-2 bg-gray-800 text-white">
              <span className="text-xs">Generated Code</span>
              <button
                onClick={() => onCopy(result.code, 'code')}
                className="flex items-center space-x-1 text-xs hover:text-gray-300 transition-colors"
              >
                {copiedItems.has('code') ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedItems.has('code') ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-3 text-sm text-gray-100 bg-gray-900 overflow-x-auto">
              <code>{result.code}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Explanation */}
      {result.explanation && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => onToggleSection('explanation')}
            className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span className="font-medium">Explanation</span>
            </div>
            {expandedSections.has('explanation') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {expandedSections.has('explanation') && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {result.explanation}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggestions */}
      {result.suggestions && result.suggestions.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => onToggleSection('suggestions')}
            className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4" />
              <span className="font-medium">Suggestions</span>
            </div>
            {expandedSections.has('suggestions') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {expandedSections.has('suggestions') && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <ul className="space-y-2">
                {result.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface AnalysisResultProps {
  result: CodeAnalysisResponse
  expandedSections: Set<string>
  copiedItems: Set<string>
  onToggleSection: (section: string) => void
  onCopy: (text: string, id: string) => void
}

function AnalysisResult({
  result,
  expandedSections,
  copiedItems,
  onToggleSection,
  onCopy
}: AnalysisResultProps) {
  return (
    <div className="space-y-4">
      {/* Analysis */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => onToggleSection('analysis')}
          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <FileSearch className="w-4 h-4" />
            <span className="font-medium">Analysis</span>
          </div>
          {expandedSections.has('analysis') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {expandedSections.has('analysis') && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {result.analysis}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Issues */}
      {result.issues && result.issues.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => onToggleSection('issues')}
            className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Bug className="w-4 h-4" />
              <span className="font-medium">Issues Found</span>
              <span className="text-xs bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-1 rounded">
                {result.issues.length} issue{result.issues.length !== 1 ? 's' : ''}
              </span>
            </div>
            {expandedSections.has('issues') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {expandedSections.has('issues') && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
              {result.issues.map((issue, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-600 rounded p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${
                      issue.severity === 'error' ? 'bg-red-500' :
                      issue.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <span className="text-sm font-medium">Line {issue.line}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      issue.severity === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                      issue.severity === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' :
                      'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    }`}>
                      {issue.severity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{issue.message}</p>
                  {issue.suggestion && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      <strong>Suggestion:</strong> {issue.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Improvements */}
      {result.improvements && result.improvements.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => onToggleSection('improvements')}
            className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span className="font-medium">Improvements</span>
            </div>
            {expandedSections.has('improvements') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {expandedSections.has('improvements') && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <ul className="space-y-2">
                {result.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                    <span>{improvement}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Test Suggestions */}
      {result.testSuggestions && result.testSuggestions.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => onToggleSection('tests')}
            className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <TestTube className="w-4 h-4" />
              <span className="font-medium">Test Suggestions</span>
            </div>
            {expandedSections.has('tests') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {expandedSections.has('tests') && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <ul className="space-y-2">
                {result.testSuggestions.map((test, index) => (
                  <li key={index} className="flex items-start space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
                    <span>{test}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
