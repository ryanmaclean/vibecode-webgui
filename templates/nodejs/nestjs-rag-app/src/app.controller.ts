import { Controller, Get, Query } from '@nestjs/common';
import { RagService } from './rag.service';

@Controller()
export class AppController {
  constructor(private readonly ragService: RagService) {}

  @Get('query')
  async getAnswer(@Query('q') query: string): Promise<{ answer: string }> {
    if (!query) {
      return { answer: 'Please provide a question with the ?q= parameter.' };
    }
    const answer = await this.ragService.query(query);
    return { answer };
  }
}
