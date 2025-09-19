/**
 * AI Project Generation Page
 * Main page for Lovable.ai clone functionality
 */

import { Metadata } from 'next'
import AIProjectGenerator from '@/components/ai/AIProjectGenerator'

export const metadata: Metadata = {
  title: 'AI Project Generator | VibeCode',
  description: 'Generate complete, production-ready projects from natural language descriptions using AI. Create React, Next.js, Node.js, Python, and more projects instantly.',
  keywords: [
    'AI project generator',
    'code generation',
    'project scaffolding',
    'React generator',
    'Next.js generator',
    'Node.js generator',
    'Python generator',
    'automated development',
    'VibeCode'
  ],
  openGraph: {
    title: 'AI Project Generator | VibeCode',
    description: 'Generate complete projects from natural language using AI',
    type: 'website',
    images: [
      {
        url: '/api/og?title=AI Project Generator&description=Generate complete projects from natural language',
        width: 1200,
        height: 630,
        alt: 'VibeCode AI Project Generator'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Project Generator | VibeCode',
    description: 'Generate complete projects from natural language using AI'
  }
}

export default function GenerateProjectPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPgogICAgICA8cGF0aCBkPSJNIDIwIDAgTCAwIDAgMCAyMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjBmMGYwIiBzdHJva2Utd2lkdGg9IjEiLz4KICAgIDwvcGF0dGVybj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPgo8L3N2Zz4=')] opacity-40" />
      
      {/* Main Content */}
      <div className="relative">
        <AIProjectGenerator />
      </div>

      {/* Features Section */}
      <div className="relative max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Our AI understands your requirements and generates production-ready code 
            with best practices built in.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💭</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Describe Your Idea
            </h3>
            <p className="text-gray-600">
              Tell us what you want to build in plain English. Be as detailed as you like 
              about features, functionality, and design.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              AI Generates Code
            </h3>
            <p className="text-gray-600">
              Our AI analyzes your requirements, selects the best framework, 
              and generates a complete project structure with working code.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🚀</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Deploy & Develop
            </h3>
            <p className="text-gray-600">
              Download your project or create a live workspace on our platform. 
              Start developing immediately with all dependencies configured.
            </p>
          </div>
        </div>
      </div>

      {/* Supported Frameworks */}
      <div className="relative bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Supported Technologies
            </h2>
            <p className="text-xl text-gray-600">
              Generate projects using the latest and most popular frameworks
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6">
            {[
              { name: 'React', icon: '⚛️' },
              { name: 'Next.js', icon: '▲' },
              { name: 'Vue.js', icon: '💚' },
              { name: 'Angular', icon: '🅰️' },
              { name: 'Svelte', icon: '🔥' },
              { name: 'Node.js', icon: '💚' },
              { name: 'Python', icon: '🐍' },
              { name: 'Go', icon: '🐹' }
            ].map((framework) => (
              <div key={framework.name} className="text-center">
                <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                  <div className="text-3xl mb-2">{framework.icon}</div>
                  <div className="text-sm font-medium text-gray-900">{framework.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
