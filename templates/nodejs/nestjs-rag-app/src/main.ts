import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log(`\n🚀 Application is running on: http://localhost:3000`);
  console.log(`💬 Query the RAG API at: http://localhost:3000/query?q=YOUR_QUESTION`);
}
bootstrap();
