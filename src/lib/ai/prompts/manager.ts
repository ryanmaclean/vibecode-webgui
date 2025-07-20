import { z } from 'zod';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';

const PromptSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  template: z.string(),
  tags: z.array(z.string()),
  version: z.string().default('1.0.0'),
  metadata: z.record(z.any()).optional(),
});

type Prompt = z.infer<typeof PromptSchema>;

export class PromptManager {
  private retriever: VectorStoreRetriever;
  private prompts: Map<string, Prompt> = new Map();

  constructor(retriever: VectorStoreRetriever) {
    this.retriever = retriever;
  }

  async addPrompt(promptData: Omit<Prompt, 'id'> & { id?: string }): Promise<string> {
    const validated = PromptSchema.parse({
      ...promptData,
      id: promptData.id || crypto.randomUUID(),
    });
    
    this.prompts.set(validated.id, validated);
    
    await this.retriever.addDocuments([{
      pageContent: `${validated.name}\n\n${validated.description}\n\n${validated.template}`,
      metadata: {
        type: 'prompt',
        ...validated,
      },
    }]);
    
    return validated.id;
  }

  async findRelevantPrompts(query: string, limit = 5) {
    const docs = await this.retriever.getRelevantDocuments(query, limit);
    return docs.map(doc => doc.metadata);
  }

  getPrompt(id: string): Prompt | undefined {
    return this.prompts.get(id);
  }

  listPrompts(): Prompt[] {
    return Array.from(this.prompts.values());
  }

  async updatePrompt(id: string, updates: Partial<Omit<Prompt, 'id'>>): Promise<boolean> {
    const existing = this.prompts.get(id);
    if (!existing) return false;
    
    const updated = { ...existing, ...updates };
    this.prompts.set(id, updated);
    
    // Re-index the updated prompt
    await this.addPrompt(updated);
    return true;
  }

  deletePrompt(id: string): boolean {
    return this.prompts.delete(id);
    // Note: You might want to also remove from the vector store
  }
}
