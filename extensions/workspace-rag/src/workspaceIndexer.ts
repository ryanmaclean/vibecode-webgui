// src/workspaceIndexer.ts
import * as vscode from 'vscode';
import { PgvectorClient } from './pgvectorClient';
import { MLXEmbeddingService } from './mlxEmbeddingService';
import { TextSplitter } from './textSplitter';
import { Logger } from './logger';
import { getWorkspaceId } from './utils';
import { getTracingManager } from './tracing';

export class WorkspaceIndexer {
    private logger: Logger;
    private embeddingService: MLXEmbeddingService;
    private isIndexing = false;

    constructor(logger: Logger) {
        this.logger = logger;
        this.embeddingService = new MLXEmbeddingService(logger);
    }

    public async indexWorkspace(context: vscode.ExtensionContext): Promise<void> {
        if (this.isIndexing) {
            vscode.window.showWarningMessage('Indexing is already in progress');
            return;
        }

        this.isIndexing = true;
        const workspaceId = getWorkspaceId();
        
        if (!workspaceId) {
            vscode.window.showErrorMessage('No workspace found');
            this.isIndexing = false;
            return;
        }

        const tracing = getTracingManager(this.logger);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "MLX-Powered Workspace Indexing",
                cancellable: true
            }, async (progress, token) => {
                return tracing.trace('workspace.index', async (span) => {
                    span.setTag('workspace.id', workspaceId);

                    // Initialize services
                    await this.embeddingService.initialize(context);
                    const modelInfo = this.embeddingService.getCurrentModelInfo();
                    
                    span.setTag('model.name', modelInfo.name);
                    span.setTag('model.type', modelInfo.type);
                    
                    const config = vscode.workspace.getConfiguration('workspaceRag');
                    const pgClient = new PgvectorClient({
                        host: config.get('pgHost'),
                        port: config.get('pgPort'),
                        user: config.get('pgUser'),
                        password: config.get('pgPassword'),
                        database: config.get('pgDatabase'),
                    }, this.logger);

                    await pgClient.connect();
                    await pgClient.initializeDatabase();

                    // Show model information
                    progress.report({ 
                        increment: 0, 
                        message: `Using ${modelInfo.type === 'local' ? 'local MLX' : 'cloud'} model: ${modelInfo.name}` 
                    });

                    // Get files to index
                    const includeGlob = config.get('includeGlob') as string;
                    const excludeGlob = config.get('excludeGlob') as string;
                    const files = await vscode.workspace.findFiles(includeGlob, excludeGlob);

                    span.setTag('files.total', files.length);

                    progress.report({ 
                        increment: 10, 
                        message: `Found ${files.length} files to process` 
                    });

                    // Get existing files in database for this workspace
                    const existingFiles = await pgClient.getWorkspaceFiles(workspaceId);
                    const existingFileMap = new Map(
                        existingFiles.map(file => [file.filepath, file.last_modified])
                    );

                    // Filter files that need updating
                    const filesToProcess: vscode.Uri[] = [];

                    for (const file of files) {
                        if (token.isCancellationRequested) {
                            this.logger.info('Indexing cancelled by user');
                            break;
                        }

                        const fileStats = await vscode.workspace.fs.stat(file);
                        const lastModified = new Date(fileStats.mtime);
                        const existingLastModified = existingFileMap.get(file.fsPath);
                        
                        // Process if new or modified
                        if (!existingLastModified || lastModified > existingLastModified) {
                            filesToProcess.push(file);
                        }
                    }

                    if (filesToProcess.length === 0) {
                        vscode.window.showInformationMessage('Workspace is already up to date. No files need indexing.');
                        return;
                    }

                    // Clear workspace if it's the first time indexing
                    if (existingFiles.length === 0) {
                        await pgClient.clearWorkspace(workspaceId);
                        this.logger.info('Cleared workspace as it was empty');
                    }

                    this.logger.info(`Found ${filesToProcess.length} files that need indexing`);
                    progress.report({ increment: 10, message: `Found ${filesToProcess.length} files to index` });

                    // Process files in batches
                    const batchSize = 10;
                    const chunkSize = config.get<number>('chunkSize', 1000);
                    const splitter = new TextSplitter(chunkSize, Math.floor(chunkSize * 0.1));

                    for (let i = 0; i < filesToProcess.length; i += batchSize) {
                        if (token.isCancellationRequested) {
                            this.logger.info('Indexing cancelled by user');
                            break;
                        }

                        const batch = filesToProcess.slice(i, i + batchSize);
                        await this.processFileBatch(
                            batch,
                            workspaceId,
                            pgClient,
                            splitter,
                            progress,
                            i,
                            filesToProcess.length
                        );
                    }

                    const finalCount = await pgClient.getDocumentCount(workspaceId);
                    span.setTag('documents.indexed', finalCount);
                    this.logger.info(`Indexing completed: ${finalCount} chunks processed`);
                    
                    await pgClient.close();

                    vscode.window.showInformationMessage(
                        `Successfully indexed ${filesToProcess.length} files (${finalCount} chunks).`
                    );
                });
            });

        } catch (error: any) {
            this.logger.error('Indexing failed', error);
            vscode.window.showErrorMessage(`Indexing failed: ${error.message}`);
        } finally {
            this.isIndexing = false;
        }
    }

    private async processFileBatch(
        files: vscode.Uri[],
        workspaceId: string,
        pgClient: PgvectorClient,
        splitter: TextSplitter,
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        processed: number,
        total: number
    ): Promise<void> {
        const tracing = getTracingManager(this.logger);

        const promises = files.map(async (file) => {
            return tracing.trace('workspace.index_file', async (span) => {
                span.setTag('file.path', file.fsPath);
                span.setTag('workspace.id', workspaceId);

                try {
                    const content = Buffer.from(await vscode.workspace.fs.readFile(file)).toString('utf-8');
                    
                    if (!content.trim()) {
                        this.logger.debug(`Skipping empty file: ${file.fsPath}`);
                        return;
                    }

                    // Split content into chunks
                    const chunks = splitter.splitText(content);
                    span.setTag('chunks.count', chunks.length);
                    
                    for (const [chunkIndex, chunk] of chunks.entries()) {
                        // Generate embedding using MLX service
                        const embedding = await this.embeddingService.generateEmbedding(chunk);
                        await pgClient.insertDocument(workspaceId, file.fsPath, chunk, embedding);
                    }

                    this.logger.debug(`Processed file: ${file.fsPath} (${chunks.length} chunks)`);

                } catch (error) {
                    span.setTag('error', true);
                    span.setTag('error.msg', (error as Error).message);
                    this.logger.error(`Error processing file ${file.fsPath}`, error);
                }
            });
        });

        await Promise.all(promises);

        progress.report({ 
            increment: (70 / total) * files.length,
            message: `Processed ${processed + files.length}/${total} files` 
        });
    }

    public getIndexingStatus(): boolean {
        return this.isIndexing;
    }
}

