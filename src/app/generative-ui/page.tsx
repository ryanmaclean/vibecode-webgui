'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { z } from '@/lib/zod-compat';

const chatInputSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Please enter a message before submitting')
    .max(2000, 'Message is too long'),
});

export default function GenerativeUIChat() {
  const { messages, input, handleInputChange, handleSubmit: submitChat } = useChat({
    api: '/api/chat',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validation = chatInputSchema.safeParse({ message: input });
    if (!validation.success) {
      const [issue] = validation.error.issues;
      setFormError(issue?.message ?? 'Invalid input');
      return;
    }

    setFormError(null);
    submitChat(event);
  };

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

      <form onSubmit={handleSubmit} className="mt-8 space-y-2">
        <input
          className="w-full p-2 border border-gray-300 rounded shadow-sm"
          value={input}
          placeholder="Ask about a GitHub repo, e.g., 'vercel/ai'"
          onChange={handleInputChange}
          aria-invalid={formError ? 'true' : 'false'}
          aria-describedby={formError ? 'generative-ui-error' : undefined}
        />
        {formError && (
          <p id="generative-ui-error" className="text-sm text-red-600">
            {formError}
          </p>
        )}
      </form>
    </div>
  );
}
