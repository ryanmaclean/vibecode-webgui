import path from 'path';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { LLMApplication, LLMApplicationBuilder, TextLoader } from '@llmembed/embedjs';
import { LanceDb } from '@llmembed/embedjs/databases/lance';
import * as dotenv from 'dotenv';

@Injectable()
export class RagService implements OnModuleInit {
    private llmApplication: LLMApplication;

    constructor() {
        dotenv.config();
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set in the .env file.');
        }
    }

    async onModuleInit() {
        console.log('\nInitializing RAG service and building embeddings index...');
        console.log('This may take a moment on the first run.\n');

        this.llmApplication = await new LLMApplicationBuilder()
            .setTemperature(0.2)
            .addLoader(new TextLoader({ filePath: path.resolve('./data.md') }))
            .setVectorDb(new LanceDb({ path: path.resolve('./db') }))
            .build();
        
        console.log('\n✅ RAG service initialized successfully.');
    }

    public async query(query: string): Promise<string> {
        try {
            return await this.llmApplication.query(query);
        } catch (error) {
            console.error('Error during query:', error);
            return 'An error occurred while processing your question.';
        }
    }
}
