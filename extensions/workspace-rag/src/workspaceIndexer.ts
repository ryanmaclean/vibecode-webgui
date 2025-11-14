// src/workspaceIndexer.ts
import * as vscode from 'vscode';
import { Logger } from './logger';
import { TracingManager } from './tracing';
import { PgvectorClient } from './pgvectorClient';
import { MLXEmbeddingService } from './mlxEmbeddingService';
import { getWorkspaceId } from './utils';
import * as path from 'path';

/**
 * Advanced text splitter with multiple strategies
 */
export class TextSplitter {
    private chunkSize: number;
    private chunkOverlap: number;

    constructor(chunkSize: number = 1000, chunkOverlap: number = 100) {
        this.chunkSize = chunkSize;
        this.chunkOverlap = chunkOverlap;
    }

    public splitText(text: string): string[] {
        if (text.length <= this.chunkSize) {
            return [text];
        }

        // Try to split by code structure first (functions, classes)
        if (this.looksLikeCode(text)) {
            return this.splitByCodeStructure(text);
        }

        // For markdown or documentation, split by sections
        if (this.looksLikeMarkdown(text)) {
            return this.splitByMarkdownSections(text);
        }

        // Default: split by paragraphs and sentences
        return this.splitByParagraphs(text);
    }

    private looksLikeCode(text: string): boolean {
        const codePatterns = [
            /function\s+\w+\s*\(/,
            /class\s+\w+/,
            /def\s+\w+\s*\(/,
            /const\s+\w+\s*=/,
            /public\s+\w+/,
            /private\s+\w+/
        ];
        return codePatterns.some(pattern => pattern.test(text));
    }

    private looksLikeMarkdown(text: string): boolean {
        return /^#{1,6}\s+/.test(text) || /\[.*?\]\(.*?\)/.test(text);
    }

    private splitByCodeStructure(text: string): string[] {
        const chunks: string[] = [];
        const lines = text.split('\n');
        let currentChunk = '';
        let braceDepth = 0;

        for (const line of lines) {
            // Track brace depth to avoid splitting inside functions/classes
            braceDepth += (line.match(/{/g) || []).length;
            braceDepth -= (line.match(/}/g) || []).length;

            if (currentChunk.length + line.length > this.chunkSize && braceDepth === 0) {
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = line;
            } else {
                currentChunk += (currentChunk ? '\n' : '') + line;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks.length > 0 ? chunks : [text];
    }

    private splitByMarkdownSections(text: string): string[] {
        const chunks: string[] = [];
        const sections = text.split(/(?=^#{1,6}\s+)/m);

        let currentChunk = '';

        for (const section of sections) {
            if (currentChunk.length + section.length > this.chunkSize) {
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = section;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + section;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks.length > 0 ? chunks : [text];
    }

    private splitByParagraphs(text: string): string[] {
        const chunks: string[] = [];
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

        let currentChunk = '';

        for (const paragraph of paragraphs) {
            if (currentChunk.length + paragraph.length + 2 <= this.chunkSize) {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            } else {
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                    // Add overlap
                    const overlapText = currentChunk.slice(-this.chunkOverlap);
                    currentChunk = overlapText + '\n\n' + paragraph;
                } else {
                    currentChunk = paragraph;
                }
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks.length > 0 ? chunks : [text];
    }
}

export class WorkspaceIndexer {
    private logger: Logger;
    private tracing: TracingManager;
    private embeddingService: MLXEmbeddingService;
    private isIndexing = false;

    constructor(logger: Logger, tracing: TracingManager, embeddingService: MLXEmbeddingService) {
        this.logger = logger;
        this.tracing = tracing;
        this.embeddingService = embeddingService;
    }

    public async indexWorkspace(context: vscode.ExtensionContext): Promise<void> {
        if (this.isIndexing) {
            vscode.window.showWarningMessage('Indexing is already in progress');
            return;
        }

        return this.tracing.trace('workspace.index', async (span) => {
            this.isIndexing = true;
            const workspaceId = getWorkspaceId();
            
            if (!workspaceId) {
                vscode.window.showErrorMessage('No workspace found. Please open a workspace and try again.');
                this.isIndexing = false;
                return;
            }

            span.setTag('workspace.id', workspaceId);

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Indexing Workspace for RAG",
                    cancellable: true
                }, async (progress, token) => {
                    // Initialize services
                    await this.embeddingService.initialize(context);
                    const modelInfo = this.embeddingService.getCurrentModelInfo();
                    
                    progress.report({ 
                        increment: 5, 
                        message: `Using ${modelInfo.type === 'local' ? 'local MLX' : 'OpenAI'} model: ${modelInfo.name}` 
                    });

                    // Setup database
                    const config = vscode.workspace.getConfiguration('workspaceRag');
                    const pgClient = new PgvectorClient({
                        host: config.get('pgHost'),
                        port: config.get('pgPort'),
                        user: config.get('pgUser'),
                        password: config.get('pgPassword'),
                        database: config.get('pgDatabase'),
                    }, this.logger, this.tracing);

                    await pgClient.connect();
                    await pgClient.initializeDatabase();

                    // Get existing files for incremental indexing
                    const existingFiles = await pgClient.getWorkspaceFiles(workspaceId);
                    const existingFileMap = new Map(
                        existingFiles.map(file => [file.filepath, file.last_modified])
                    );

                    // Find files to index
                    const includeGlob = config.get('includeGlob') as string;
                    const excludeGlob = config.get('excludeGlob') as string;
                    const files = await vscode.workspace.findFiles(includeGlob, excludeGlob);

                    progress.report({ 
                        increment: 5, 
                        message: `Found ${files.length} files` 
                    });

                    // Determine which files need indexing
                    const filesToProcess: vscode.Uri[] = [];
                    for (const file of files) {
                        if (token.isCancellationRequested) break;

                        try {
                            const fileStats = await vscode.workspace.fs.stat(file);
                            const lastModified = new Date(fileStats.mtime);
                            const existingLastModified = existingFileMap.get(file.fsPath);

                            if (!existingLastModified || lastModified > existingLastModified) {
                                filesToProcess.push(file);
                            }
                        } catch (error) {
                            this.logger.debug(`Skipping file ${file.fsPath}: ${error}`);
                        }
                    }

                    if (filesToProcess.length === 0) {
                        vscode.window.showInformationMessage('Workspace is already up to date.');
                        await pgClient.close();
                        return;
                    }

                    span.setTag('files.total', files.length);
                    span.setTag('files.to_process', filesToProcess.length);

                    progress.report({ 
                        increment: 5, 
                        message: `Processing ${filesToProcess.length} new or modified files` 
                    });

                    // Process files
                    const chunkSize = config.get('chunkSize', 1000);
                    const chunkOverlap = config.get('chunkOverlap', 100);
                    const splitter = new TextSplitter(chunkSize, chunkOverlap);

                    let processedFiles = 0;
                    let totalChunks = 0;

                    for (const file of filesToProcess) {
                        if (token.isCancellationRequested) {
                            this.logger.info('Indexing cancelled by user');
                            break;
                        }

                        try {
                            const content = Buffer.from(
                                await vscode.workspace.fs.readFile(file)
                            ).toString('utf-8');

                            if (!content.trim()) {
                                continue;
                            }

                            const chunks = splitter.splitText(content);
                            totalChunks += chunks.length;

                            progress.report({ 
                                increment: (80 / filesToProcess.length), 
                                message: `Embedding ${path.basename(file.fsPath)} (${processedFiles + 1}/${filesToProcess.length})` 
                            });

                            for (const chunk of chunks) {
                                const embedding = await this.embeddingService.generateEmbedding(chunk);
                                await pgClient.insertDocument(workspaceId, file.fsPath, chunk, embedding);
                            }

                            processedFiles++;
                        } catch (error) {
                            this.logger.error(`Failed to process file ${file.fsPath}`, error);
                        }
                    }

                    const finalCount = await pgClient.getDocumentCount(workspaceId);
                    span.setTag('chunks.total', finalCount);
                    span.setTag('files.processed', processedFiles);

                    progress.report({ increment: 5, message: 'Indexing complete!' });

                    await pgClient.close();

                    vscode.window.showInformationMessage(
                        `Successfully indexed ${processedFiles} files (${totalChunks} chunks)`
                    );
                });

            } catch (error: any) {
                span.setTag('error', true);
                span.setTag('error.msg', error.message);
                this.logger.error('Indexing failed', error);
                vscode.window.showErrorMessage(`Indexing failed: ${error.message}`);
            } finally {
                this.isIndexing = false;
            }
        });
    }

    public isCurrentlyIndexing(): boolean {
        return this.isIndexing;
    }
}

