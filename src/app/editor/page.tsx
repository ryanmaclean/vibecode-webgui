/**
 * Agent-Powered Code Editor Demo Page
 *
 * Demonstrates Monaco Editor with Agent API integration
 * Shows real-time AI assistance, completions, and diagnostics
 */

'use client'

import { useState, useEffect } from 'react'
import { AgentMonacoEditor, useAgentAPI } from '@/components/editor/AgentMonacoEditor'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Zap, Code, FileCode, Terminal } from 'lucide-react'
// import { logger } from '@/lib/logger';

const SAMPLE_CODE = {
  typescript: `import React, { useState, useEffect } from 'react'

interface User {
  id: number
  name: string
  email: string
}

export function UserList() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Users</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {users.map(user => (
            <li key={user.id}>
              {user.name} - {user.email}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}`,
  python: `import numpy as np
from typing import List, Optional

class DataProcessor:
    def __init__(self, data: List[float]):
        self.data = np.array(data)

    def normalize(self) -> np.ndarray:
        """Normalize data to [0, 1] range"""
        min_val = self.data.min()
        max_val = self.data.max()
        return (self.data - min_val) / (max_val - min_val)

    def standardize(self) -> np.ndarray:
        """Standardize data to mean=0, std=1"""
        mean = self.data.mean()
        std = self.data.std()
        return (self.data - mean) / std

    def outliers(self, threshold: float = 2.0) -> np.ndarray:
        """Detect outliers using z-score"""
        z_scores = np.abs(self.standardize())
        return self.data[z_scores > threshold]

# Example usage
processor = DataProcessor([1, 2, 3, 100, 4, 5])
normalized = processor.normalize()
outliers = processor.outliers()
print(f"Outliers: {outliers}")`,
  javascript: `// E-commerce Shopping Cart
class ShoppingCart {
  constructor() {
    this.items = []
    this.discount = 0
  }

  addItem(product, quantity = 1) {
    const existing = this.items.find(item => item.product.id === product.id)

    if (existing) {
      existing.quantity += quantity
    } else {
      this.items.push({ product, quantity })
    }

    return this
  }

  removeItem(productId) {
    this.items = this.items.filter(item => item.product.id !== productId)
    return this
  }

  applyDiscount(percentage) {
    this.discount = Math.min(Math.max(percentage, 0), 100)
    return this
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity)
    }, 0)
  }

  getTotal() {
    const subtotal = this.getSubtotal()
    return subtotal - (subtotal * this.discount / 100)
  }

  getItemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0)
  }
}

// Usage
const cart = new ShoppingCart()
cart
  .addItem({ id: 1, name: 'Laptop', price: 999.99 })
  .addItem({ id: 2, name: 'Mouse', price: 29.99 }, 2)
  .applyDiscount(10)

console.info('Total:', cart.getTotal())`,
}

export default function EditorPage() {
  const [code, setCode] = useState(SAMPLE_CODE.typescript)
  const [language, setLanguage] = useState<'typescript' | 'python' | 'javascript'>('typescript')
  const [theme, setTheme] = useState<'vs-dark' | 'vs-light'>('vs-dark')
  const [agentEnabled, setAgentEnabled] = useState(true)
  const [stats, setStats] = useState({
    completions: 0,
    hovers: 0,
    codeActions: 0,
  })

  const handleLanguageChange = (newLanguage: 'typescript' | 'python' | 'javascript') => {
    setLanguage(newLanguage)
    setCode(SAMPLE_CODE[newLanguage])
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Agent-Powered Code Editor</h1>
          <p className="text-muted-foreground">
            Experience AI-powered code editing with real-time completions, explanations, and diagnostics
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agent Status</CardTitle>
              <Zap className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {agentEnabled ? (
                  <Badge className="bg-green-500">Connected</Badge>
                ) : (
                  <Badge variant="secondary">Disabled</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completions</CardTitle>
              <Code className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hovers</CardTitle>
              <FileCode className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.hovers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Code Actions</CardTitle>
              <Terminal className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.codeActions}</div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Editor Controls</CardTitle>
            <CardDescription>Customize your coding experience</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Language:</label>
                <Select value={language} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Theme:</label>
                <Select value={theme} onValueChange={(v) => setTheme(v as any)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vs-dark">Dark</SelectItem>
                    <SelectItem value="vs-light">Light</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant={agentEnabled ? 'default' : 'outline'}
                onClick={() => setAgentEnabled(!agentEnabled)}
              >
                {agentEnabled ? 'Disable Agent' : 'Enable Agent'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Agent Features Info */}
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription>
            <strong>AI Features Active:</strong> Press <kbd>Ctrl/Cmd+Space</kbd> for completions,{' '}
            <kbd>Ctrl/Cmd+K Ctrl/Cmd+I</kbd> for explanations, <kbd>Ctrl/Cmd+.</kbd> for quick fixes
          </AlertDescription>
        </Alert>

        {/* Editor */}
        <Card>
          <CardHeader>
            <CardTitle>Code Editor</CardTitle>
            <CardDescription>
              Write code with AI-powered assistance. Try triggering completions or hovering over code!
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <AgentMonacoEditor
              value={code}
              language={language}
              theme={theme}
              height="600px"
              enableAgent={agentEnabled}
              agentConfig={{
                baseUrl: '/api/agents',
                wsUrl: '/api/agents/ws',
                model: 'claude-3-5-sonnet-20241022',
                enableInlineSuggestions: true,
                enableDiagnostics: true,
              }}
              onChange={(newCode) => setCode(newCode || '')}
              className="rounded-lg overflow-hidden"
            />
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>What you can do with Agent-Powered Editor</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="completions">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="completions">Completions</TabsTrigger>
                <TabsTrigger value="hover">Hover Info</TabsTrigger>
                <TabsTrigger value="actions">Code Actions</TabsTrigger>
                <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
              </TabsList>

              <TabsContent value="completions" className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">AI-Powered Completions</h3>
                  <p className="text-sm text-muted-foreground">
                    Get intelligent code suggestions as you type. The AI understands your context
                    and provides relevant completions with &lt;300ms latency.
</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Context-aware suggestions based on surrounding code</li>
                    <li>Import statements and dependencies</li>
                    <li>Function signatures and parameters</li>
                    <li>Type-safe completions for TypeScript</li>
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="hover" className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Hover Information</h3>
                  <p className="text-sm text-muted-foreground">
                    Hover over any code element to get AI-generated explanations, type information,
                    and documentation.
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Variable types and values</li>
                    <li>Function signatures and return types</li>
                    <li>Class and interface definitions</li>
                    <li>AI-generated explanations</li>
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="actions" className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Code Actions</h3>
                  <p className="text-sm text-muted-foreground">
                    Get quick fixes, refactorings, and improvements suggested by the AI agent.
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Extract function/variable</li>
                    <li>Rename symbol</li>
                    <li>Add missing imports</li>
                    <li>Fix type errors</li>
                    <li>Optimize code</li>
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="diagnostics" className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Real-time Diagnostics</h3>
                  <p className="text-sm text-muted-foreground">
                    The AI agent continuously analyzes your code and provides diagnostics with
                    suggested fixes.
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Syntax errors</li>
                    <li>Type errors</li>
                    <li>Best practice violations</li>
                    <li>Performance issues</li>
                    <li>Security vulnerabilities</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
            <CardDescription>Learn more about the Agent API integration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a
                href="/api/docs/agent-api"
                className="text-blue-500 hover:underline block"
              >
                Agent API Documentation
              </a>
              <a
                href="/api/docs/monaco-integration"
                className="text-blue-500 hover:underline block"
              >
                Monaco Integration Guide
              </a>
              <a
                href="/api/docs/vscode-extension"
                className="text-blue-500 hover:underline block"
              >
                VS Code Extension Guide
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
