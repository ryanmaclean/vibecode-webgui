'use client'

import { MessageSquare } from 'lucide-react'
import { ChatInterface } from '@/components/ai/ChatInterface'

export default function AIChatPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">AI Chat</h1>
        </div>
        <p className="text-gray-600">
          Chat with AI models using streaming responses
        </p>
      </div>

      {/* Chat Interface */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[calc(100vh-280px)] min-h-[500px]">
        <ChatInterface />
      </div>
    </div>
  )
}
