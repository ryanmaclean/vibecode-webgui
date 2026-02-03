// src/mlxEmbeddingService.ts
import * as vscode from 'vscode';
import { Logger } from './logger';
import { TracingManager } from './tracing';
import { isAppleSilicon } from './utils';
import { OpenAI } from 'openai';

interface ModelConfig {
    name: string;
    dimension: number;
    type: 'local' | 'api';
    backend: 'mlx' | 'openai';
}

export class MLXEmbeddingService {
    private logger: Logger;
    private tracing: TracingManager;
    private currentModel: ModelConfig | null = null;
    private isInitialized = false;
    private openaiClient: OpenAI | null = null;

    constructor(logger: Logger, tracing: TracingManager) {
        this.logger = logger;
        this.tracing = tracing;
    }

    public async initialize(context: vscode.ExtensionContext): Promise<void> {
        return this.tracing.trace('mlx.initialize', async (span) => {
            try {
                const config = vscode.workspace.getConfiguration('workspaceRag');
                const useLocalMLX = config.has('useLocalMLX')
                    ? config.get<boolean>('useLocalMLX', true)
                    : config.get<boolean>('useMLX', true);
                
                // Check for MLX availability (Apple Silicon only)
                const isMLXAvailable = useLocalMLX && isAppleSilicon();
                span.setTag('mlx.available', isMLXAvailable);
                span.setTag('platform', process.platform);
                span.setTag('arch', process.arch);

                if (isMLXAvailable) {
                    // Use local MLX model
                    this.currentModel = {
                        name: 'all-MiniLM-L6-v2',
                        dimension: 384,
                        type: 'local',
                        backend: 'mlx'
                    };
                    this.logger.info('Using local MLX model for embeddings', {
                        model: this.currentModel.name,
                        dimension: this.currentModel.dimension
                    });
                } else {
                    // Fallback to OpenAI API
                    const apiKey = await context.secrets.get('openaiApiKey');
                    if (apiKey) {
                        this.openaiClient = new OpenAI({ apiKey });
                        this.currentModel = {
                            name: config.get('embeddingModel', 'text-embedding-3-small'),
                            dimension: 1536,
                            type: 'api',
                            backend: 'openai'
                        };
                        this.logger.info('Using OpenAI API for embeddings', {
                            model: this.currentModel.name
                        });
                    } else {
                        throw new Error('No API key available and MLX not available. Please set an OpenAI API key.');
                    }
                }

                span.setTag('model.name', this.currentModel.name);
                span.setTag('model.type', this.currentModel.type);
                span.setTag('model.backend', this.currentModel.backend);
                span.setTag('model.dimension', this.currentModel.dimension);

                this.isInitialized = true;
            } catch (error: any) {
                span.setTag('error', true);
                span.setTag('error.msg', error.message);
                this.logger.error('Failed to initialize embedding service', error);
                throw error;
            }
        });
    }

    public async generateEmbedding(text: string): Promise<number[]> {
        return this.tracing.trace('mlx.generateEmbedding', async (span) => {
            if (!this.isInitialized || !this.currentModel) {
                throw new Error('Embedding service not initialized');
            }

            span.setTag('input.text_length', text.length);
            span.setTag('model.name', this.currentModel.name);
            span.setTag('model.type', this.currentModel.type);

            const start = Date.now();

            try {
                let embedding: number[];

                if (this.currentModel.type === 'local') {
                    embedding = await this.generateLocalEmbedding(text, span);
                } else {
                    embedding = await this.generateAPIEmbedding(text, span);
                }

                const duration = Date.now() - start;
                span.setTag('embedding.duration_ms', duration);
                span.setTag('embedding.dimension', embedding.length);

                this.logger.debug(`Embedding generated in ${duration}ms`, {
                    backend: this.currentModel.type,
                    dimension: embedding.length
                });

                return embedding;
            } catch (error: any) {
                span.setTag('error', true);
                span.setTag('error.msg', error.message);
                this.logger.error('Failed to generate embedding', error);
                throw error;
            }
        });
    }

    private async generateLocalEmbedding(text: string, parentSpan: any): Promise<number[]> {
        // In a real implementation, this would use MLX inference
        // For now, we'll simulate with a deterministic embedding based on text content
        // This is a placeholder - replace with actual MLX model inference
        
        this.logger.debug('Generating local MLX embedding (simulated)');
        
        const dimension = this.currentModel!.dimension;
        const embedding: number[] = new Array(dimension);
        
        // Create a deterministic "embedding" based on text hash
        // This is just for demonstration - real MLX would use actual model inference
        for (let i = 0; i < dimension; i++) {
            const seed = (text.charCodeAt(i % text.length) + i) * 0.01;
            embedding[i] = Math.sin(seed) * Math.cos(seed * 2);
        }
        
        // Normalize the embedding
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / norm);
    }

    private async generateAPIEmbedding(text: string, parentSpan: any): Promise<number[]> {
        if (!this.openaiClient) {
            throw new Error('OpenAI client not initialized');
        }

        this.logger.debug('Generating OpenAI API embedding');

        try {
            const response = await this.openaiClient.embeddings.create({
                model: this.currentModel!.name,
                input: text.substring(0, 8191), // OpenAI has a token limit
            });

            return response.data[0].embedding;
        } catch (error: any) {
            this.logger.error('OpenAI API call failed', error);
            throw error;
        }
    }

    public getCurrentModelInfo(): { name: string; type: 'local' | 'api'; dimension: number } {
        if (!this.currentModel) {
            throw new Error('Service not initialized');
        }
        
        return {
            name: this.currentModel.name,
            type: this.currentModel.type,
            dimension: this.currentModel.dimension
        };
    }

    public isUsingLocalModel(): boolean {
        return this.currentModel?.type === 'local';
    }
}
