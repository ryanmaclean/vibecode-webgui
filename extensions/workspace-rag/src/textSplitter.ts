// src/textSplitter.ts

// Advanced text splitter with multiple strategies
export class TextSplitter {
    private chunkSize: number;
    private chunkOverlap: number;

    constructor(chunkSize: number = 1000, chunkOverlap: number = 100) {
        this.chunkSize = chunkSize;
        this.chunkOverlap = chunkOverlap;
    }

    splitText(text: string): string[] {
        // If text is small enough, return as is
        if (text.length <= this.chunkSize) {
            return [text];
        }

        // Strategy 1: Split by paragraphs first
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        if (paragraphs.length > 1) {
            return this.splitByParagraphs(paragraphs);
        }

        // Strategy 2: Split by sentences
        const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => s.trim().length > 0);
        if (sentences.length > 1) {
            return this.splitBySentences(sentences);
        }

        // Strategy 3: Fallback to character-based splitting
        return this.splitByCharacters(text);
    }

    private splitByParagraphs(paragraphs: string[]): string[] {
        const chunks: string[] = [];
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            if (currentChunk.length + paragraph.length + 2 <= this.chunkSize) {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    // Create overlap with previous chunk
                    currentChunk = chunks[chunks.length - 1].slice(-this.chunkOverlap);
                }
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    private splitBySentences(sentences: string[]): string[] {
        const chunks: string[] = [];
        let currentChunk = '';
        let currentLength = 0;

        for (const sentence of sentences) {
            const sentenceLength = sentence.length;
            
            if (currentLength + sentenceLength <= this.chunkSize) {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
                currentLength += sentenceLength + 1; // +1 for space
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    // Create overlap
                    const overlap = Math.min(this.chunkOverlap, currentChunk.length);
                    currentChunk = currentChunk.slice(-overlap);
                    currentLength = currentChunk.length;
                }
                currentChunk += (currentChunk ? ' ' : '') + sentence;
                currentLength += sentenceLength + 1;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    private splitByCharacters(text: string): string[] {
        const chunks: string[] = [];
        let startIndex = 0;

        while (startIndex < text.length) {
            const endIndex = Math.min(startIndex + this.chunkSize, text.length);
            let chunk = text.substring(startIndex, endIndex);
            
            // If we're not at the end and we cut off in the middle of a word,
            // backtrack to the nearest space
            if (endIndex < text.length && /\w$/.test(chunk) && /^\w/.test(text.charAt(endIndex))) {
                const lastSpace = chunk.lastIndexOf(' ');
                if (lastSpace > -1) {
                    chunk = chunk.substring(0, lastSpace);
                }
            }
            
            chunks.push(chunk);
            startIndex += chunk.length;
            
            // Apply overlap
            if (this.chunkOverlap > 0 && chunks.length > 1) {
                startIndex -= this.chunkOverlap;
            }
        }

        return chunks;
    }
}

