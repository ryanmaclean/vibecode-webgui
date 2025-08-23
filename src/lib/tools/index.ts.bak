import { tool } from 'ai';
import { z } from 'zod';

export const tools = {
  getGithubRepoInfo: tool({
    description: 'Get information about a GitHub repository.',
    parameters: z.object({
      repo: z.string().describe('The repository name in the format \"owner/repo\"'),
    }),
    execute: async ({ repo }) => {
      // In a real application, you would fetch this data from the GitHub API.
      // For this example, we\'ll return mock data.
      const [owner, name] = repo.split('/');
      if (!owner || !name) {
        return { error: 'Invalid repository format. Use \"owner/repo\".' };
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
  }),
};
