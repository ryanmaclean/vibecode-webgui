import { useChat } from 'ai/react';
import { GithubRepo } from '@/components/github-repo';

export default function GenerativeUIChat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
    tools: {
      getGithubRepoInfo: {
        render: props => <GithubRepo {...props} />,
      },
    },
  });

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto py-12">
      <div className="space-y-4">
        {messages.map(m => (
          <div key={m.id} className="whitespace-pre-wrap">
            <strong className='capitalize'>{m.role === 'user' ? 'You: ' : 'AI: '}</strong>
            {m.content}
            {m.toolInvocations?.map(toolInvocation => (
              <div key={toolInvocation.toolCallId} className="mt-2">
                {toolInvocation.result ? (
                  <div className="bg-gray-200 p-4 rounded-lg">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(toolInvocation.result, null, 2)}</pre>
                  </div>
                ) : (
                  <div className="animate-pulse">Loading tool output...</div>
                )}
              </div>
            ))}
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
