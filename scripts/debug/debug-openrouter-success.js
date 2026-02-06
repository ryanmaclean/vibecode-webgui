#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * Debug OpenRouter Response Structure - Success Case
 * Understand the actual response format from OpenRouter
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import OpenAI from 'openai';

console.log('🔍 Debugging Successful OpenRouter Response');
console.log('==========================================');

async function debugSuccessfulResponse() {
  try {
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'VibeCode WebGUI'
      }
    });
    
    console.log('\n🧪 Making API call...');
    
    const response = await client.embeddings.create({
      model: 'openai/text-embedding-ada-002',
      input: 'Hello world debug'
    });
    
    console.log('\n📋 Complete Response Structure:');
    console.log('==============================');
    console.log('Type of response:', typeof response);
    console.log('Response keys:', Object.keys(response));
    
    // Check specific properties
    console.log('\n🔍 Property Analysis:');
    console.log('response.data:', !!response.data ? 'EXISTS' : 'MISSING');
    console.log('response.embeddings:', !!response.embeddings ? 'EXISTS' : 'MISSING');  
    console.log('response.object:', response.object || 'MISSING');
    console.log('response.model:', response.model || 'MISSING');
    console.log('response.usage:', !!response.usage ? 'EXISTS' : 'MISSING');
    
    if (response.data) {
      console.log('\n📊 Data Analysis:');
      console.log('Data type:', typeof response.data);
      console.log('Data length:', response.data.length);
      if (response.data.length > 0) {
        console.log('First data item keys:', Object.keys(response.data[0]));
        console.log('First item has embedding:', !!response.data[0].embedding);
        if (response.data[0].embedding) {
          console.log('Embedding type:', typeof response.data[0].embedding);
          console.log('Embedding length:', response.data[0].embedding.length);
          console.log('First few values:', response.data[0].embedding.slice(0, 5));
        }
      }
    }
    
    if (response.usage) {
      console.log('\n💰 Usage Analysis:');
      console.log('Usage keys:', Object.keys(response.usage));
      Object.entries(response.usage).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    // Try to parse it the way our code expects
    console.log('\n🔧 Testing Current Parser Logic:');
    
    try {
      const embeddings = response.data.map((item) => item.embedding);
      console.log('✅ Current parser works!');
      console.log('Embeddings count:', embeddings.length);
      console.log('First embedding dimensions:', embeddings[0].length);
    } catch (parseError) {
      console.error('❌ Current parser failed:', parseError.message);
    }
    
    console.log('\n📝 Raw Response Sample (first 500 chars):');
    console.log(JSON.stringify(response, null, 2).substring(0, 500) + '...');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

debugSuccessfulResponse();