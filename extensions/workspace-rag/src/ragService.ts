// src/ragService.ts
import { Logger } from './logger';
import { PgvectorClient } from './pgvectorClient';
import { MLXEmbeddingService } from './mlxEmbeddingService';
import { OpenAI } from 'openai';
import { getTracingManager } from './tracing';
import * as vscode from 'vscode';

export class RagService {
    private logger: Logger;
    private embeddingService: MLXEmbeddingService;
    private openai: OpenAI | null = null;

    constructor(logger: Logger) {
        this.logger = logger;
        this.embeddingService = new MLXEmbeddingService(logger);
    }

    public async initialize(context: vscode.ExtensionContext): Promise<void> {
        await this.embeddingService.initialize(context);
        
        // Initialize OpenAI client for chat completion
        const apiKey = await context.secrets.get('openaiApiKey');
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }
    }

    public async processQuery(
        workspaceId: string,
        query: string,
        dbConfig: any,
        context?: vscode.ExtensionContext
    ): Promise<{ answer: string; sources: string[]; metadata: any }> {
        const tracing = getTracingManager(this.logger);

        return tracing.trace('rag.process_query', async (span) => {
            span.setTag('workspace.id', workspaceId);
            span.setTag('query.length', query.length);
            span.setTag('query.content', query.substring(0, 100)); // Sample first 100 chars

            try {
                // Step 1: Generate query embedding
                if (!this.embeddingService) {
                    if (!context) {
                        throw new Error('Extension context required for initialization');
                    }
                    await this.initialize(context);
                }

                const queryEmbedding = await this.generateQueryEmbedding(query, span);
                
                // Step 2: Retrieve relevant documents
                const documents = await this.retrieveDocuments(workspaceId, queryEmbedding, dbConfig, span);
                
                // Step 3: Generate response
                const response = await this.generateResponse(query, documents, span);
                
                // Step 4: Log metrics
                this.logMetrics(query, documents, response, span);
                
                return response;

            } catch (error: any) {
                span.setTag('error', true);
                span.setTag('error.msg', error.message);
                span.setTag('error.stack', error.stack);
                this.logger.error('RAG query processing failed', error);
                throw error;
            }
        });
    }

    private async generateQueryEmbedding(query: string, parentSpan: any): Promise<number[]> {
        const tracing = getTracingManager(this.logger);
        return tracing.trace('rag.generate_query_embedding', async (span) => {
            span.setTag('step', 'embedding_generation');
            
            const embedding = await this.embeddingService.generateEmbedding(query);
            span.setTag('embedding.dimension', embedding.length);
            
            return embedding;
        }, {}, parentSpan);
    }

    private async retrieveDocuments(
        workspaceId: string, 
        queryEmbedding: number[], 
        dbConfig: any,
        parentSpan: any
    ): Promise<any[]> {
        const tracing = getTracingManager(this.logger);
        return tracing.trace('rag.retrieve_documents', async (span) => {
            span.setTag('step', 'document_retrieval');
            span.setTag('workspace.id', workspaceId);
            span.setTag('query_embedding.dimension', queryEmbedding.length);

            const config = vscode.workspace.getConfiguration('workspaceRag');
            const retrievalLimit = config.get<number>('retrievalLimit', 5);

            const dbClient = new PgvectorClient(dbConfig, this.logger);
            
            try {
                await dbClient.connect();
                const documents = await dbClient.search(workspaceId, queryEmbedding, retrievalLimit);
                
                span.setTag('retrieval.document_count', documents.length);
                if (documents.length > 0) {
                    span.setTag('retrieval.best_similarity', documents[0].similarity);
                    span.setTag('retrieval.worst_similarity', documents[documents.length - 1].similarity);
                }
                
                this.logger.debug('Documents retrieved', {
                    count: documents.length,
                    bestSimilarity: documents[0]?.similarity
                });
                
                return documents;
                
            } finally {
                await dbClient.close();
            }
        }, {}, parentSpan);
    }

    private async generateResponse(
        query: string, 
        documents: any[], 
        parentSpan: any
    ): Promise<{ answer: string; sources: string[]; metadata: any }> {
        const tracing = getTracingManager(this.logger);
        return tracing.trace('rag.generate_response', async (span) => {
            span.setTag('step', 'response_generation');
            span.setTag('input_documents.count', documents.length);

            if (documents.length === 0) {
                return {
                    answer: "I couldn't find any relevant information in your workspace to answer this question.",
                    sources: [],
                    metadata: { retrieved_documents: 0 }
                };
            }

            // Build context from documents
            const context = this.buildContext(documents);
            span.setTag('context.length', context.length);

            const start = Date.now();
            
            // Generate answer using LLM
            const answer = await this.callLanguageModel(query, context, span);
            
            span.setTag('generation.duration_ms', Date.now() - start);
            span.setTag('answer.length', answer.length);

            const sources = documents.map(doc => doc.filepath);
            const metadata = {
                retrieved_documents: documents.length,
                best_similarity: documents[0]?.similarity,
                answer_length: answer.length
            };

            return { answer, sources, metadata };
        }, {}, parentSpan);
    }

    private async callLanguageModel(query: string, context: string, span: any): Promise<string> {
        const tracing = getTracingManager(this.logger);
        return tracing.trace('rag.llm_inference', async (llmSpan) => {
            llmSpan.setTag('llm.operation', 'completion');
            llmSpan.setTag('query.length', query.length);
            llmSpan.setTag('context.length', context.length);

            if (!this.openai) {
                throw new Error('OpenAI client not initialized. Please set your API key.');
            }

            const config = vscode.workspace.getConfiguration('workspaceRag');
            const chatModel = config.get<string>('chatModel', 'gpt-4o-mini');

            const prompt = `You are an expert developer familiar with the codebase. 
Answer the question based only on the provided context. 
If the context doesn't contain the answer, say "I don't know."
Be concise and specific. Include relevant code snippets if helpful.

Context:
${context}

Question: ${query}`;

            try {
                const completionResponse = await this.openai.chat.completions.create({
                    model: chatModel,
                    messages: [
                        { 
                            role: 'system', 
                            content: 'You are a helpful assistant that answers questions about codebases.' 
                        },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2
                });

                llmSpan.setTag('llm.model', chatModel);
                llmSpan.setTag('llm.tokens', completionResponse.usage?.total_tokens || 0);

                return completionResponse.choices[0].message.content || "I don't have enough information to answer that question.";

            } catch (error: any) {
                llmSpan.setTag('error', true);
                llmSpan.setTag('error.msg', error.message);
                throw error;
            }
        }, {}, span);
    }

    private buildContext(documents: any[]): string {
        return documents.map(doc => 
            `File: ${doc.filepath}\nSimilarity: ${doc.similarity.toFixed(3)}\nContent: ${doc.content}\n---`
        ).join('\n');
    }

    private logMetrics(query: string, documents: any[], response: any, span: any): void {
        const metrics = {
            query_length: query.length,
            documents_retrieved: documents.length,
            best_similarity: documents[0]?.similarity || 0,
            answer_length: response.answer.length,
            sources_count: response.sources.length
        };

        // Log to span
        Object.entries(metrics).forEach(([key, value]) => {
            span.setTag(`metrics.${key}`, value);
        });

        // Log to application logs
        this.logger.info('RAG query metrics', metrics);
    }
}

