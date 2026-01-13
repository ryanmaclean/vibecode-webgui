import { ChatInterface } from '@/components/ai/ChatInterface'

export default function ChatPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AI Chat</h1>
      <ChatInterface />
    </div>
  )
}
