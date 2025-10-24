/**
 * OpenRouter API Client
 * 
 * Provides interface to OpenRouter API for accessing multiple AI models
 * including Claude, GPT-4, and other language models through a unified API.
 */

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export interface OpenRouterResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouter {
  private apiKey: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createChatCompletion(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    // In test environment, return mock response
    if (process.env.NODE_ENV === 'test' || this.apiKey === 'mock-key-for-testing') {
      return this.createMockResponse(request);
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'VibeCode Multimodal AI',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('OpenRouter API call failed:', error);
      throw error;
    }
  }

  private createMockResponse(request: OpenRouterRequest): OpenRouterResponse {
    // Generate mock response based on the request
    let mockContent = 'This is a mock response from OpenRouter.';
    
    // Customize response based on the prompt
    const prompt = request.messages[request.messages.length - 1]?.content || '';
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('react') || promptLower.includes('component')) {
      mockContent = `Here's a React component based on your request:

\`\`\`typescript
import React from 'react';

interface Props {
  title: string;
  onClick: () => void;
}

export function MockComponent({ title, onClick }: Props) {
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">{title}</h3>
      <button 
        onClick={onClick}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Click me
      </button>
    </div>
  );
}
\`\`\`

This component includes TypeScript types, proper styling with Tailwind CSS, and follows React best practices.`;
    } else if (promptLower.includes('todo') || promptLower.includes('list')) {
      mockContent = `Here's a todo list implementation:

\`\`\`typescript
import React, { useState } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputText, setInputText] = useState('');

  const addTodo = () => {
    if (inputText.trim()) {
      setTodos([...todos, {
        id: Date.now(),
        text: inputText,
        completed: false
      }]);
      setInputText('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 px-3 py-2 border rounded"
          placeholder="Add a todo..."
        />
        <button
          onClick={addTodo}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Add
        </button>
      </div>
      
      <ul className="space-y-2">
        {todos.map(todo => (
          <li
            key={todo.id}
            className="flex items-center gap-2 p-2 border rounded"
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span className={todo.completed ? 'line-through' : ''}>
              {todo.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
\`\`\``;
    } else if (promptLower.includes('api') || promptLower.includes('endpoint')) {
      mockContent = `Here's an API endpoint implementation:

\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server';

interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

const todos: TodoItem[] = [];

export async function GET() {
  return NextResponse.json(todos);
}

export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json();
    
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const newTodo: TodoItem = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    todos.push(newTodo);

    return NextResponse.json(newTodo, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
\`\`\``;
    } else if (promptLower.includes('analyze') || promptLower.includes('review')) {
      mockContent = `Based on my analysis of your code, here are my recommendations:

## Code Quality Assessment

✅ **Strengths:**
- Good TypeScript usage with proper type definitions
- Clean component structure
- Proper separation of concerns

⚠️ **Areas for Improvement:**
1. **Error Handling**: Add try-catch blocks for async operations
2. **Accessibility**: Include ARIA labels and semantic HTML
3. **Performance**: Consider memoization for expensive calculations
4. **Testing**: Add unit tests for critical functions

## Specific Recommendations:

### 1. Add Error Boundaries
\`\`\`typescript
import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children;
  }
}
\`\`\`

### 2. Improve Accessibility
- Add proper ARIA labels
- Ensure keyboard navigation works
- Use semantic HTML elements
- Provide alt text for images

### 3. Add Input Validation
Use a schema validation library like Zod for robust input validation.`;
    } else if (promptLower.includes('voice') || promptLower.includes('audio')) {
      mockContent = `I understand you're working with voice input. Here's what I can help with:

🎤 **Voice Features Processed:**
- Speech recognition and transcription
- Voice commands for code generation
- Audio input processing
- Text-to-speech output

The voice input has been transcribed and I'm ready to help you build whatever you described. Whether it's creating components, writing functions, or building full applications, I can assist with the implementation.

Would you like me to proceed with generating code based on your voice request?`;
    } else if (promptLower.includes('image') || promptLower.includes('design')) {
      mockContent = `Based on the image/design you've shared, I can help convert it to code:

🎨 **Vision Analysis Complete:**
- UI elements detected and analyzed
- Layout structure identified  
- Color scheme and styling noted
- Interactive elements mapped

I can generate:
- React components with exact styling
- Responsive CSS/Tailwind classes
- Interactive functionality
- Accessibility features

Would you like me to create the component code for the design you've shared?`;
    } else if (promptLower.includes('file') || promptLower.includes('codebase')) {
      mockContent = `I've analyzed your files and codebase. Here's my assessment:

📁 **Project Analysis:**
- File structure and organization
- Code quality and patterns
- Potential improvements
- Security considerations
- Performance optimizations

**Recommendations:**
1. Add TypeScript if not already using it
2. Implement proper error handling
3. Add comprehensive testing
4. Consider code splitting for better performance
5. Ensure accessibility compliance

I can help implement any of these improvements or answer specific questions about your codebase.`;
    }

    const estimatedTokens = mockContent.length / 4; // Rough estimate

    return {
      id: `mock-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: mockContent,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: Math.ceil(prompt.length / 4),
        completion_tokens: Math.ceil(estimatedTokens),
        total_tokens: Math.ceil(prompt.length / 4) + Math.ceil(estimatedTokens),
      },
    };
  }

  // Helper method to get available models
  async getModels(): Promise<string[]> {
    if (process.env.NODE_ENV === 'test') {
      return [
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-haiku',
        'openai/gpt-4o-mini',
        'openai/gpt-4o',
      ];
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.data.map((model: any) => model.id);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
  }

  // Helper method to estimate cost
  estimateCost(tokens: number, model: string): number {
    const costPer1KTokens = {
      'anthropic/claude-3.5-sonnet': 0.015,
      'anthropic/claude-3-haiku': 0.0025,
      'openai/gpt-4o-mini': 0.0015,
      'openai/gpt-4o': 0.030,
    };

    const cost = costPer1KTokens[model as keyof typeof costPer1KTokens] || 0.01;
    return (tokens / 1000) * cost;
  }
} 