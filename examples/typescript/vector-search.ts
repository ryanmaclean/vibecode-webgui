/**
 * Vector Search Example - TypeScript SDK
 *
 * Demonstrates semantic search and RAG:
 * - Performing vector searches
 * - Using search results with AI chat
 * - Finding similar code patterns
 * - Content-based retrieval
 */

import { createVibeCodeClient } from '@vibecode/client';

async function main() {
  const client = createVibeCodeClient({
    baseUrl: process.env.VIBECODE_API_URL || 'http://localhost:3000/api',
    token: process.env.VIBECODE_TOKEN,
  });

  await client.init();

  try {
    // Create a workspace with various files
    console.log('Creating workspace with sample code...');
    const workspace = await client.createWorkspace({
      projectId: `search-demo-${Date.now()}`,
      projectName: 'Vector Search Demo',
      framework: 'react',
      files: {
        'src/auth/login.js': `
export async function login(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const { token } = await response.json();
  localStorage.setItem('authToken', token);
  return token;
}`,
        'src/auth/logout.js': `
export function logout() {
  localStorage.removeItem('authToken');
  window.location.href = '/login';
}`,
        'src/auth/protected.js': `
export function isAuthenticated() {
  return !!localStorage.getItem('authToken');
}

export function requireAuth(Component) {
  return function AuthenticatedComponent(props) {
    if (!isAuthenticated()) {
      window.location.href = '/login';
      return null;
    }
    return <Component {...props} />;
  };
}`,
        'src/api/fetch.js': `
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('authToken');

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': token ? \`Bearer \${token}\` : '',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(\`API request failed: \${response.status}\`);
  }

  return response.json();
}`,
        'src/components/LoginForm.jsx': `
import { useState } from 'react';
import { login } from '../auth/login';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      window.location.href = '/dashboard';
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      {error && <p className="error">{error}</p>}
      <button type="submit">Login</button>
    </form>
  );
}`,
      },
    });

    console.log(`Workspace created: ${workspace.id}\n`);

    // Example 1: Search for authentication-related code
    console.log('Example 1: Searching for authentication code...');
    const authSearch = await client.vectorSearch({
      workspaceId: workspace.id,
      query: 'user authentication and login',
      maxResults: 5,
      threshold: 0.6,
    });

    console.log(`Found ${authSearch.results.length} relevant files:`);
    authSearch.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.file} (score: ${result.score.toFixed(2)})`);
      console.log(`   Preview: ${result.content.substring(0, 100)}...`);
    });

    // Example 2: Search for token management
    console.log('\n\nExample 2: Searching for token management...');
    const tokenSearch = await client.vectorSearch({
      workspaceId: workspace.id,
      query: 'JWT token storage and retrieval',
      maxResults: 3,
      threshold: 0.7,
    });

    console.log(`Found ${tokenSearch.results.length} relevant files:`);
    tokenSearch.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.file} (score: ${result.score.toFixed(2)})`);
    });

    // Example 3: Use search results with AI chat
    console.log('\n\nExample 3: Using search results with AI chat...');
    const relevantFiles = authSearch.results.slice(0, 3).map((r) => r.file);

    const aiResponse = await client.chat({
      message:
        'How is authentication implemented in this codebase? Are there any security concerns?',
      workspaceId: workspace.id,
      enableRAG: true,
      context: {
        files: relevantFiles,
      },
    });

    console.log('\nAI Analysis:');
    console.log(aiResponse.response);

    // Example 4: Search for specific patterns
    console.log('\n\nExample 4: Searching for API request patterns...');
    const apiSearch = await client.vectorSearch({
      workspaceId: workspace.id,
      query: 'making HTTP requests with fetch',
      maxResults: 5,
      threshold: 0.5,
    });

    console.log(`Found ${apiSearch.results.length} relevant code snippets:`);
    apiSearch.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.file}`);
      console.log(`   Similarity: ${(result.score * 100).toFixed(1)}%`);
      if (result.metadata) {
        console.log(`   Metadata:`, result.metadata);
      }
    });

    // Example 5: Combine multiple searches for comprehensive analysis
    console.log('\n\nExample 5: Comprehensive code analysis...');

    const searches = await Promise.all([
      client.vectorSearch({
        workspaceId: workspace.id,
        query: 'authentication',
        maxResults: 3,
      }),
      client.vectorSearch({
        workspaceId: workspace.id,
        query: 'error handling',
        maxResults: 3,
      }),
      client.vectorSearch({
        workspaceId: workspace.id,
        query: 'React components',
        maxResults: 3,
      }),
    ]);

    const allRelevantFiles = new Set(
      searches.flatMap((search) => search.results.map((r) => r.file))
    );

    console.log(`Total unique files found: ${allRelevantFiles.size}`);

    const analysisResponse = await client.chat({
      message:
        'Analyze the overall code quality, architecture, and potential improvements for this codebase.',
      workspaceId: workspace.id,
      enableRAG: true,
      context: {
        files: Array.from(allRelevantFiles),
      },
      temperature: 0.5,
    });

    console.log('\nComprehensive Analysis:');
    console.log(analysisResponse.response);

    // Clean up
    console.log('\n\nCleaning up...');
    await client.deleteWorkspace(workspace.id);
    console.log('Workspace deleted');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
