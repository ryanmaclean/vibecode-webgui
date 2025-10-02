import type { MCPServer } from '../types';

export const MCP_SERVERS: MCPServer[] = [
  {
    id: 'filesystem',
    name: 'File System',
    description: 'Read and write files in workspace',
    status: 'connected',
    tools: ['read_file', 'write_file', 'list_directory', 'create_file'],
    url: 'http://localhost:3001'
  },
  {
    id: 'database',
    name: 'Database',
    description: 'Query and modify database',
    status: 'connected',
    tools: ['execute_query', 'get_schema', 'insert_data'],
    url: 'http://localhost:3002'
  },
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web for information',
    status: 'connected',
    tools: ['search_web', 'fetch_url', 'extract_content'],
    url: 'http://localhost:3003'
  },
  {
    id: 'voice-processor',
    name: 'Voice Processor',
    description: 'Transcribe audio files and voice input via Docker Model Runner',
    status: 'connected',
    tools: ['transcribe_audio', 'voice_to_text', 'speech_analysis'],
    url: 'http://localhost:3004'
  },
  {
    id: 'model-runner',
    name: 'Docker Model Runner',
    description: 'Local LLM inference with Docker AI',
    status: 'connected',
    tools: ['text_generation', 'code_completion', 'local_inference'],
    url: 'http://localhost:12434'
  }
];
