import { tool, zodSchema } from 'ai';
import { z } from 'zod';

export const tools = {
  // The AI SDK currently lacks full type coverage for the `tool` helper when using
  // Zod schemas in a CommonJS/ESM mixed environment. Cast to `any` to keep the
  // configuration flexible while the upstream types catch up.
  getGithubRepoInfo: tool({
    name: 'getGithubRepoInfo',
    description: 'Get information about a GitHub repository.',
<<<<<<< HEAD
    parameters: z.object({
      repo: z.string().describe('The repository name in the format "owner/repo"'),
    }),
=======
    parameters: zodSchema(
      z.object({
        repo: z.string().describe('The repository name in the format \"owner/repo\"'),
      })
    ),
>>>>>>> merge-conflict-cleanup
    execute: async ({ repo }: { repo: string }) => {
      // In a real application, you would fetch this data from the GitHub API.
      // For this example, we'll return mock data.
      const [owner, name] = repo.split('/');
      if (!owner || !name) {
        return { error: 'Invalid repository format. Use "owner/repo".' };
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      return {
        owner,
        name,
        stars: Math.floor(Math.random() * 50000),
        url: `https://github.com/${repo}`,
        description: `This is a mock description for the ${repo} repository. It is a popular open-source project.`,
      };
    },
  } as any),
};
