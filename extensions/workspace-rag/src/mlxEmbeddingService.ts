// src/mlxEmbeddingService.ts
import * as vscode from 'vscode';
import { Logger } from './logger';
import { OpenAI } from 'openai';

interface MLXModelConfig {
    name: string;
    dimension: number;
    localPath?: string;
    apiEndpoint?: string;
    type: 'local' | 'api';
    backend: 'mlx' | 'openai';
}

export class MLXEmbeddingService {
    private logger: Logger;
    private currentModel: MLXModelConfig | null = null;
    private isInitialized = false;
    private openai: OpenAI | null = null;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    public async initialize(context?: vscode.ExtensionContext): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('workspaceRag');
            const useMLX = config.get<boolean>('useMLX', true);
            
            // Check for MLX availability (Apple Silicon)
            const isMLXAvailable = useMLX && await this.checkMLXAvailability();
            
            if (isMLXAvailable) {
                // Prefer local MLX models for privacy and performance
                this.currentModel = {
                    name: 'all-MiniLM-L6-v2',
                    dimension: 384,
                    type: 'local',
                    backend: 'mlx',
                    localPath: this.getModelPath('all-MiniLM-L6-v2')
                };
                this.logger.info('MLX embedding service initialized with local model');
            } else {
                // Fallback to API-based models
                const apiKey = context ? await context.secrets.get('openaiApiKey') : undefined;
                if (!apiKey) {
                    throw new Error('OpenAI API Key not set. Please use the "Set OpenAI API Key" command.');
                }
                
                this.openai = new OpenAI({ apiKey });
                this.currentModel = {
                    name: config.get<string>('embeddingModel', 'text-embedding-3-small'),
                    dimension: 1536,
                    type: 'api',
                    backend: 'openai',
                    apiEndpoint: 'openai'
                };
                this.logger.info('MLX not available, using API-based embeddings');
            }
            
            this.isInitialized = true;
        } catch (error) {
            this.logger.error('Failed to initialize MLX embedding service', error);
            throw error;
        }
    }

    private async checkMLXAvailability(): Promise<boolean> {
        try {
            // Check if we're running on Apple Silicon
            if (process.platform !== 'darwin') {
                return false;
            }

            // Check for MLX framework availability
            const architecture = process.arch;
            return architecture === 'arm64';
        } catch (error) {
            this.logger.debug('MLX availability check failed', error);
            return false;
        }
    }

    private getModelPath(modelName: string): string {
        // In a real implementation, this would point to downloaded model files
        return `/usr/local/share/mlx-models/${modelName}`;
    }

    public async generateEmbedding(text: string): Promise<number[]> {
        if (!this.isInitialized) {
            throw new Error('Embedding service not initialized');
        }

        if (!this.currentModel) {
            throw new Error('Embedding service not properly initialized');
        }

        try {
            if (this.currentModel.type === 'local') {
                // Use local MLX model
                return await this.generateLocalEmbedding(text);
            } else {
                // Use API-based model
                return await this.generateAPIEmbedding(text);
            }
        } catch (error) {
            this.logger.error(`Failed to generate embedding for text`, error);
            throw error;
        }
    }

    private async generateLocalEmbedding(text: string): Promise<number[]> {
        // MLX-based embedding generation
        // This is a placeholder for actual MLX inference
        // In practice, you'd load the model and run inference
        
        this.logger.debug(`Generating local embedding for text length: ${text.length}`);
        
        // Simulate embedding generation (replace with actual MLX code)
        const dimension = this.currentModel?.dimension || 384;
        const embedding = new Array(dimension).fill(0).map(() => 
            Math.random() * 2 - 1 // Random values between -1 and 1
        );
        
        // Normalize the embedding
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / norm);
    }

    private async generateAPIEmbedding(text: string): Promise<number[]> {
        if (!this.openai) {
            throw new Error('OpenAI client not initialized');
        }

        const modelName = this.currentModel?.name || 'text-embedding-3-small';
        
        try {
            const response = await this.openai.embeddings.create({
                model: modelName,
                input: text,
            });
            
            return response.data[0].embedding;
        } catch (error) {
            this.logger.error('Failed to generate API embedding', error);
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
}

