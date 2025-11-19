import { OpenAI } from 'openai';

async function main() {
  const baseURL = process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1';
  const model = process.env.LM_STUDIO_EMBEDDING_MODEL || 'gpotoss';
  const apiKey = process.env.LM_STUDIO_API_KEY || 'lm-studio';

  console.log('🔍 LM Studio Embedding Test');
  console.log('Configuration:', { baseURL, model, apiKeyPresent: !!process.env.LM_STUDIO_API_KEY });

  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  const input = 'Hello from the LM Studio embedding test for workspace-rag.';

  try {
    const start = Date.now();
    const response = await client.embeddings.create({
      model,
      input,
    });
    const duration = Date.now() - start;

    const embedding = response.data[0]?.embedding;
    if (!embedding || !Array.isArray(embedding)) {
      console.error('❌ No embedding returned from LM Studio');
      process.exit(1);
    }

    console.log('✅ Embedding call succeeded');
    console.log('  Dimension:', embedding.length);
    console.log('  Duration (ms):', duration);
    console.log('  Sample values:', embedding.slice(0, 5));
  } catch (error: any) {
    console.error('❌ LM Studio embedding call failed');
    console.error(error?.response?.data || error?.message || error);
    process.exit(1);
  }
}

main().then(() => {
  console.log('✨ LM Studio embedding test completed');
}).catch((err) => {
  console.error('❌ Unexpected error in LM Studio embedding test', err);
  process.exit(1);
});
