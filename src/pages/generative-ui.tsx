import { useChat } from 'ai/react';

export default function GenerativeUIChat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto py-12">
      <div className="space-y-4">
        {messages.map(m => (
          <div key={m.id} className="whitespace-pre-wrap">
            <strong className='capitalize'>{m.role === 'user' ? 'You: ' : 'AI: '}</strong>
            {m.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-8">
        <input
          className="w-full p-2 border border-gray-300 rounded shadow-sm"
          value={input}
          placeholder="Ask about a GitHub repo, e.g., 'vercel/ai'"
          onChange={handleInputChange}
        />
      </form>
    </div>
  );
}
