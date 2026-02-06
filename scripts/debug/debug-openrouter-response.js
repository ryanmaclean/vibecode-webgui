#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * Debug OpenRouter Response Structure
 * Check what OpenRouter actually returns for embeddings
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import OpenAI from 'openai';

console.log('🔍 Debugging OpenRouter Response Structure');
console.log('==========================================');

async function debugOpenRouterResponse() {
  try {
    console.log('\n📡 Creating OpenRouter client...');
    
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'VibeCode WebGUI Debug'
      }
    });
    
    console.log('✅ Client created');
    
    console.log('\n🧪 Testing embedding request...');
    console.log('Input: "Hello world"');
    console.log('Model: text-embedding-ada-002');
    
    try {
      const response = await client.embeddings.create({
        model: 'text-embedding-ada-002',
        input: 'Hello world'
      });
      
      console.log('\n📋 Full Response Structure:');
      console.log('==========================');
      console.log(JSON.stringify(response, null, 2));
      
      console.log('\n📊 Response Analysis:');
      console.log(`Type of response: ${typeof response}`);
      console.log(`Has 'data' property: ${!!response.data}`);
      console.log(`Has 'embeddings' property: ${!!response.embeddings}`);
      console.log(`Has 'usage' property: ${!!response.usage}`);
      
      if (response.data) {
        console.log(`Data length: ${response.data.length}`);
        if (response.data[0]) {
          console.log(`First data item keys: ${Object.keys(response.data[0])}`);
          console.log(`Has embedding: ${!!response.data[0].embedding}`);
          if (response.data[0].embedding) {
            console.log(`Embedding dimensions: ${response.data[0].embedding.length}`);
          }
        }
      }
      
      if (response.usage) {
        console.log(`Usage keys: ${Object.keys(response.usage)}`);
      }
      
    } catch (apiError) {
      console.error('❌ API Error:', apiError.message);
      
      if (apiError.response) {
        console.log('\n📋 Error Response:');
        console.log('==================');
        console.log(`Status: ${apiError.response.status}`);
        console.log(`Headers:`, apiError.response.headers);
        console.log(`Data:`, JSON.stringify(apiError.response.data, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Setup Error:', error.message);
    console.error(error.stack);
  }
}

debugOpenRouterResponse();