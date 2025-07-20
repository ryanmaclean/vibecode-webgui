import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { RagService } from './rag.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [RagService],
})
export class AppModule {}
