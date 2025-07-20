import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { tools } from '@/lib/tools';

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge';

export default async function handler(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-4o'),
    system:
      'You are a helpful assistant. When asked about a GitHub repository, use the getGithubRepoInfo tool to provide information.',
    messages,
    tools,
  });

  return result.toDataStreamResponse();
}
