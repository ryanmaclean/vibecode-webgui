import supertest from 'supertest';
import { createServer } from 'http';
import { apiResolver } from 'next/dist/server/api-utils/node';
import { POST } from '@/app/api/ai/chat/stream/route';

// Mock the AI provider
jest.mock('@/lib/ai/provider', () => ({
  getAIProvider: jest.fn(() => ({
    createChatCompletion: jest.fn().mockResolvedValue(new ReadableStream({
      start(controller) {
        controller.enqueue('Hello');
        controller.enqueue(' World');
        controller.close();
      }
    }))
  }))
}));

describe('Integration: /api/ai/chat/stream', () => {
  let server: ReturnType<typeof createServer>;
  let request: supertest.SuperTest<supertest.Test>;

  beforeAll((done) => {
    const handler = (req: any, res: any) => {
      return apiResolver(req, res, undefined, POST, undefined, {trustHost: true});
    };

    server = createServer(handler);
    server.listen(done);
    request = supertest(server) as unknown as supertest.SuperTest<supertest.Test>;
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should return a 200 OK and stream back SSE events', async () => {
    const response = await request
      .post('/api/ai/chat/stream')
      .send({
        messages: [{ role: 'user', content: 'Hello' }]
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/event-stream; charset=utf-8');

    // Accumulate the streamed data
    let streamedData = '';
    await new Promise((resolve) => {
      response.on('data', (chunk) => {
        streamedData += chunk.toString();
      });
      response.on('end', resolve);
    });

    expect(streamedData).toContain('data: Hello');
    expect(streamedData).toContain('data:  World');
  });
});
