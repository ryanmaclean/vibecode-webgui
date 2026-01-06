// src/ragService.ts
import * as vscode from 'vscode';
import { Logger } from './logger';
import { TracingManager } from './tracing';
import { PgvectorClient } from './pgvectorClient';
import { MLXEmbeddingService } from './mlxEmbeddingService';
import { ProviderFactory } from './providers/providerFactory';
import { SafeguardManager } from './safeguards';

export interface RagResponse {
    answer: string;
    sources: Array<{ filepath: string; similarity: number }>;
    metadata: {
        retrieved_documents: number;
        best_similarity: number;
        answer_length: number;
        model_used: string;
    };
}

export class RagService {
    private logger: Logger;
    private tracing: TracingManager;
    private embeddingService: MLXEmbeddingService;
    private providerFactory: ProviderFactory;
    private safeguards: SafeguardManager;

    constructor(
        logger: Logger, 
        tracing: TracingManager, 
        embeddingService: MLXEmbeddingService,
        context: vscode.ExtensionContext
    ) {
        this.logger = logger;
        this.tracing = tracing;
        this.embeddingService = embeddingService;
        this.providerFactory = new ProviderFactory(context, logger);
        this.safeguards = new SafeguardManager(logger);
    }

    public async initialize(context: vscode.ExtensionContext): Promise<void> {
        // No-op for now, initialization happens in constructor
    }

    public async processQuery(
        workspaceId: string,
        query: string,
        context: vscode.ExtensionContext
    ): Promise<RagResponse> {
        return this.tracing.trace('rag.processQuery', async (span) => {
            span.setTag('workspace.id', workspaceId);
            span.setTag('query.length', query.length);
            span.setTag('query.content', query.substring(0, 100));

            // Validate query
            const validation = this.safeguards.validateQuery(query);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Rate limiting
            if (!this.safeguards.checkRateLimit(workspaceId)) {
                throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
            }

            try {
                // Step 1: Generate query embedding
                this.logger.debug('Generating query embedding');
                const queryEmbedding = await this.embeddingService.generateEmbedding(query);
                span.setTag('step.1', 'embedding_generated');

                // Step 2: Retrieve relevant documents
                this.logger.debug('Retrieving relevant documents');
                const documents = await this.retrieveDocuments(workspaceId, queryEmbedding);
                span.setTag('step.2', 'documents_retrieved');
                span.setTag('documents.count', documents.length);

                if (documents.length === 0) {
                    return {
                        answer: "I couldn't find any relevant information in your workspace to answer this question. Try indexing your workspace first.",
                        sources: [],
                        metadata: {
                            retrieved_documents: 0,
                            best_similarity: 0,
                            answer_length: 0,
                            model_used: 'none'
                        }
                    };
                }

                // Step 3: Generate response
                this.logger.debug('Generating response');
                const response = await this.generateResponse(query, documents);
                span.setTag('step.3', 'response_generated');
                span.setTag('response.length', response.answer.length);

                return response;

            } catch (error: any) {
                span.setTag('error', true);
                span.setTag('error.msg', error.message);
                this.logger.error('RAG query processing failed', error);
                throw error;
            }
        });
    }

    private async retrieveDocuments(
        workspaceId: string,
        queryEmbedding: number[]
    ): Promise<Array<{ filepath: string; content: string; similarity: number }>> {
        return this.tracing.trace('rag.retrieveDocuments', async (span) => {
            const config = vscode.workspace.getConfiguration('workspaceRag');
            const limit = config.get('retrievalLimit', 5);

            const pgClient = new PgvectorClient({
                host: config.get('pgHost'),
                port: config.get('pgPort'),
                user: config.get('pgUser'),
                password: config.get('pgPassword'),
                database: config.get('pgDatabase'),
            }, this.logger, this.tracing);

            try {
                await pgClient.connect();
                const documents = await pgClient.search(workspaceId, queryEmbedding, limit);

                span.setTag('retrieval.document_count', documents.length);
                if (documents.length > 0) {
                    span.setTag('retrieval.best_similarity', documents[0].similarity);
                    span.setTag('retrieval.worst_similarity', documents[documents.length - 1].similarity);
                }

                return documents;
            } finally {
                await pgClient.close();
            }
        });
    }

    private async generateResponse(
        query: string,
        documents: Array<{ filepath: string; content: string; similarity: number }>
    ): Promise<RagResponse> {
        return this.tracing.trace('rag.generateResponse', async (span) => {
            span.setTag('input_documents.count', documents.length);

            // Build context from retrieved documents
            const context = this.buildContext(documents);
            span.setTag('context.length', context.length);

            // Generate answer
            let answer: string;
            let modelUsed: string;

            try {
                // Use configured LLM provider
                const provider = await this.providerFactory.createProvider();
                answer = await this.generateWithProvider(provider, query, context, span);
                modelUsed = `${provider.providerName}:${provider.defaultModel}`;
                span.setTag('llm.provider', provider.providerName);
            } catch (error: any) {
                this.logger.warn('LLM provider failed, falling back to simple extraction', error);
                // Fallback to simple extraction
                answer = this.generateSimpleAnswer(query, documents);
                modelUsed = 'simple-extraction';
            }

            span.setTag('answer.length', answer.length);
            span.setTag('model.used', modelUsed);

            return {
                answer,
                sources: documents.map(doc => ({
                    filepath: doc.filepath,
                    similarity: doc.similarity
                })),
                metadata: {
                    retrieved_documents: documents.length,
                    best_similarity: documents[0]?.similarity || 0,
                    answer_length: answer.length,
                    model_used: modelUsed
                }
            };
        });
    }

    private async generateWithProvider(provider: any, query: string, context: string, span: any): Promise<string> {
        return this.tracing.trace('rag.llm_inference', async (llmSpan) => {
            llmSpan.setTag('llm.provider', provider.providerName);
            llmSpan.setTag('llm.model', provider.defaultModel);

            const messages = [
                {
                    role: 'system' as const,
                    content: 'You are an expert developer assistant analyzing a codebase. Answer questions based on the provided context. Be specific and reference file names when relevant. If the context does not contain enough information, say so.'
                },
                {
                    role: 'user' as const,
                    content: `Context:\n${context}\n\nQuestion: ${query}\n\nAnswer:`
                }
            ];

            try {
                const response = await provider.generateCompletion(messages, {
                    temperature: 0.2,
                    maxTokens: 500
                });

                llmSpan.setTag('tokens.prompt', response.tokens?.prompt || 0);
                llmSpan.setTag('tokens.completion', response.tokens?.completion || 0);
                llmSpan.setTag('tokens.total', response.tokens?.total || 0);

                return response.content || 'No response generated.';
            } catch (error: any) {
                llmSpan.setTag('error', true);
                llmSpan.setTag('error.msg', error.message);
                this.logger.error(`${provider.providerName} API call failed`, error);
                throw error;
            }
        });
    }

    private generateSimpleAnswer(
        query: string,
        documents: Array<{ filepath: string; content: string; similarity: number }>
    ): string {
        // Simple fallback: return the most relevant document snippet
        const topDoc = documents[0];
        const fileName = topDoc.filepath.split('/').pop() || topDoc.filepath;
        
        return `Based on your query "${query}", I found relevant information in ${fileName}:\n\n${topDoc.content.substring(0, 300)}...\n\n(Note: Set an OpenAI API key for more detailed answers)`;
    }

    private buildContext(documents: Array<{ filepath: string; content: string; similarity: number }>): string {
        return documents.map((doc, index) => 
            `[Document ${index + 1}] File: ${doc.filepath} (Similarity: ${doc.similarity.toFixed(3)})\n${doc.content}\n---`
        ).join('\n\n');
    }
}

