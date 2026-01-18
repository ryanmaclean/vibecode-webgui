// Types for prompt management
import { VectorStoreRetriever } from 'langchain/vectorstores/base';

interface DocumentMetadata {
  source?: string;
  type?: string;
  [key: string]: string | number | boolean | string[] | null | undefined;
}

interface PromptInput {
  name: string;
  description: string;
  template: string;
  tags: string[];
  version?: string;
  metadata?: DocumentMetadata;
}


export interface Prompt {
  id: string;
  name: string;
  description: string;
  template: string;
  tags: string[];
  version: string;
  metadata?: DocumentMetadata;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PromptManager {
  private retriever: VectorStoreRetriever;
  private prompts: Map<string, Prompt> = new Map();

  constructor(retriever: VectorStoreRetriever) {
    this.retriever = retriever;
  }

  async addPrompt(input: PromptInput): Promise<Prompt> {
    const id = crypto.randomUUID();
    const version = input.version || '1.0.0';
    const metadata = input.metadata || {};
    
    const newPrompt: Prompt = {
      id,
      name: input.name,
      description: input.description,
      template: input.template,
      tags: [...input.tags],
      version,
      metadata: { ...metadata, type: 'prompt' },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.retriever.addDocuments([{
      pageContent: input.template,
      metadata: {
        ...metadata,
        id,
        name: input.name,
        description: input.description,
        tags: input.tags.join(','), // Store tags as comma-separated string for vector search
        version,
        type: 'prompt',
        source: metadata.source || 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }]);
    
    this.prompts.set(id, newPrompt);
    return newPrompt;
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
