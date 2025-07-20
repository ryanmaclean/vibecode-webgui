/**
 * Templates API - Real template management
 * Provides actual project templates for quick project creation
 */

import { NextResponse } from 'next/server'

interface ProjectTemplate {
  id: string
  name: string
  description: string
  language: string
  framework: string
  tags: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: string
  features: string[]
  icon: string
  files: { [path: string]: string }
  dependencies?: { [key: string]: string }
  scripts?: { [key: string]: string }
  setupInstructions?: string[]
}

const templates: ProjectTemplate[] = [
  {
    id: 'react-todo-app',
    name: 'React Todo App',
    description: 'A modern todo application with TypeScript, Tailwind CSS, and local storage persistence',
    language: 'typescript',
    framework: 'react',
    tags: ['frontend', 'beginner-friendly', 'responsive'],
    difficulty: 'beginner',
    estimatedTime: '30 minutes',
    features: ['Add/remove todos', 'Mark as complete', 'Filter by status', 'Responsive design'],
    icon: '📝',
    files: {
      'package.json': JSON.stringify({
        name: 'react-todo-app',
        version: '0.1.0',
        private: true,
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
          'typescript': '^5.0.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0'
        },
        scripts: {
          start: 'react-scripts start',
          build: 'react-scripts build',
          test: 'react-scripts test',
          eject: 'react-scripts eject'
        }
      }, null, 2),
      'src/App.tsx': `import React, { useState, useEffect } from 'react';
import './App.css';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Load todos from localStorage on mount
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
  }, []);

  // Save todos to localStorage whenever todos change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    if (inputValue.trim() !== '') {
      const newTodo: Todo = {
        id: Date.now(),
        text: inputValue.trim(),
        completed: false,
      };
      setTodos([...todos, newTodo]);
      setInputValue('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  return (
    <div className="app">
      <h1>Todo App</h1>
      
      <div className="input-section">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a new todo..."
          className="todo-input"
        />
        <button onClick={addTodo} className="add-button">Add</button>
      </div>

      <div className="filter-section">
        <button 
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'active' : ''}
        >
          All ({todos.length})
        </button>
        <button 
          onClick={() => setFilter('active')}
          className={filter === 'active' ? 'active' : ''}
        >
          Active ({todos.filter(t => !t.completed).length})
        </button>
        <button 
          onClick={() => setFilter('completed')}
          className={filter === 'completed' ? 'active' : ''}
        >
          Completed ({todos.filter(t => t.completed).length})
        </button>
      </div>

      <div className="todo-list">
        {filteredTodos.map(todo => (
          <div key={todo.id} className={\`todo-item \${todo.completed ? 'completed' : ''}\`}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span className="todo-text">{todo.text}</span>
            <button 
              onClick={() => deleteTodo(todo.id)}
              className="delete-button"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {filteredTodos.length === 0 && (
        <p className="empty-message">
          {filter === 'all' ? 'No todos yet. Add one above!' : 
           filter === 'active' ? 'No active todos!' : 'No completed todos!'}
        </p>
      )}
    </div>
  );
}

export default App;`,
      'src/App.css': `.app {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

.input-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.todo-input {
  flex: 1;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
}

.todo-input:focus {
  outline: none;
  border-color: #007bff;
}

.add-button {
  padding: 12px 24px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}

.add-button:hover {
  background: #0056b3;
}

.filter-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  justify-content: center;
}

.filter-section button {
  padding: 8px 16px;
  border: 2px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}

.filter-section button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.todo-list {
  space-y: 10px;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid #eee;
  border-radius: 6px;
  margin-bottom: 10px;
}

.todo-item.completed {
  opacity: 0.6;
  background: #f8f9fa;
}

.todo-item.completed .todo-text {
  text-decoration: line-through;
}

.todo-text {
  flex: 1;
  font-size: 16px;
}

.delete-button {
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.delete-button:hover {
  background: #c82333;
}

.empty-message {
  text-align: center;
  color: #666;
  font-style: italic;
  margin-top: 30px;
}`,
      'README.md': `# React Todo App

A simple, modern todo application built with React and TypeScript.

## Features

- ✅ Add new todos
- ✅ Mark todos as complete/incomplete
- ✅ Delete todos
- ✅ Filter by status (All, Active, Completed)
- ✅ Persistent storage using localStorage
- ✅ Responsive design

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm start
   \`\`\`

3. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Technologies Used

- React 18
- TypeScript
- CSS3
- localStorage for persistence

## Available Scripts

- \`npm start\` - Runs the app in development mode
- \`npm test\` - Launches the test runner
- \`npm run build\` - Builds the app for production

Enjoy coding! 🚀`
    }
  },
  {
    id: 'node-express-api',
    name: 'Express REST API',
    description: 'A complete REST API with Express.js, TypeScript, validation, and error handling',
    language: 'typescript',
    framework: 'express',
    tags: ['backend', 'api', 'intermediate'],
    difficulty: 'intermediate',
    estimatedTime: '45 minutes',
    features: ['CRUD operations', 'Input validation', 'Error handling', 'Middleware', 'TypeScript'],
    icon: '🚀',
    files: {
      'package.json': JSON.stringify({
        name: 'express-rest-api',
        version: '1.0.0',
        description: 'Express REST API with TypeScript',
        main: 'dist/index.js',
        scripts: {
          start: 'node dist/index.js',
          dev: 'tsx watch src/index.ts',
          build: 'tsc',
          test: 'jest'
        },
        dependencies: {
          express: '^4.18.2',
          cors: '^2.8.5',
          helmet: '^7.0.0',
          morgan: '^1.10.0',
          zod: '^3.22.0'
        },
        devDependencies: {
          '@types/express': '^4.17.17',
          '@types/cors': '^2.8.13',
          '@types/morgan': '^1.9.4',
          'tsx': '^3.12.0',
          'typescript': '^5.0.0'
        }
      }, null, 2),
      'src/index.ts': `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { userRoutes } from './routes/users';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Express REST API is running!' });
});

app.use('/api/users', userRoutes);

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(\`🚀 Server is running on port \${PORT}\`);
});`,
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          lib: ['ES2020'],
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
      }, null, 2)
    }
  },
  {
    id: 'next-blog',
    name: 'Next.js Blog',
    description: 'A modern blog with Next.js 14, TypeScript, Tailwind CSS, and Markdown support',
    language: 'typescript',
    framework: 'nextjs',
    tags: ['fullstack', 'blog', 'ssg', 'advanced'],
    difficulty: 'intermediate',
    estimatedTime: '60 minutes',
    features: ['Static generation', 'Markdown posts', 'SEO optimized', 'Responsive design', 'Dark mode'],
    icon: '📖',
    files: {
      'package.json': JSON.stringify({
        name: 'nextjs-blog',
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint'
        },
        dependencies: {
          'next': '14.0.0',
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
          'gray-matter': '^4.0.3',
          'remark': '^14.0.3',
          'remark-html': '^15.0.2'
        },
        devDependencies: {
          '@types/node': '^20.0.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          'eslint': '^8.0.0',
          'eslint-config-next': '14.0.0',
          'tailwindcss': '^3.3.0',
          'typescript': '^5.0.0'
        }
      }, null, 2)
    }
  },
  {
    id: 'python-fastapi',
    name: 'FastAPI Application',
    description: 'A modern Python API with FastAPI, automatic documentation, and async support',
    language: 'python',
    framework: 'fastapi',
    tags: ['backend', 'python', 'api', 'async'],
    difficulty: 'intermediate',
    estimatedTime: '40 minutes',
    features: ['Automatic OpenAPI docs', 'Async support', 'Type hints', 'Validation', 'CORS'],
    icon: '🐍',
    files: {
      'main.py': `from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(
    title="FastAPI Example",
    description="A simple FastAPI application with CRUD operations",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class Item(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    price: float
    tax: Optional[float] = None

# In-memory storage
items_db: List[Item] = []
next_id = 1

@app.get("/")
async def root():
    return {"message": "Welcome to FastAPI!"}

@app.get("/items", response_model=List[Item])
async def get_items():
    return items_db

@app.get("/items/{item_id}", response_model=Item)
async def get_item(item_id: int):
    for item in items_db:
        if item.id == item_id:
            return item
    raise HTTPException(status_code=404, detail="Item not found")

@app.post("/items", response_model=Item)
async def create_item(item: Item):
    global next_id
    item.id = next_id
    next_id += 1
    items_db.append(item)
    return item

@app.put("/items/{item_id}", response_model=Item)
async def update_item(item_id: int, updated_item: Item):
    for i, item in enumerate(items_db):
        if item.id == item_id:
            updated_item.id = item_id
            items_db[i] = updated_item
            return updated_item
    raise HTTPException(status_code=404, detail="Item not found")

@app.delete("/items/{item_id}")
async def delete_item(item_id: int):
    for i, item in enumerate(items_db):
        if item.id == item_id:
            del items_db[i]
            return {"message": "Item deleted successfully"}
    raise HTTPException(status_code=404, detail="Item not found")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)`,
      'requirements.txt': `fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0`,
      'README.md': `# FastAPI Application

A modern Python API built with FastAPI featuring automatic documentation and async support.

## Features

- 🚀 FastAPI with automatic OpenAPI documentation
- 📝 Pydantic models for data validation
- 🔄 CRUD operations
- 🌐 CORS enabled
- ⚡ Async support
- 📊 Interactive API docs

## Getting Started

1. Install dependencies:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

2. Run the application:
   \`\`\`bash
   python main.py
   \`\`\`

3. Open your browser:
   - API: http://localhost:8000
   - Interactive docs: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## API Endpoints

- \`GET /\` - Welcome message
- \`GET /items\` - Get all items
- \`GET /items/{id}\` - Get item by ID
- \`POST /items\` - Create new item
- \`PUT /items/{id}\` - Update item
- \`DELETE /items/{id}\` - Delete item

Happy coding! 🐍`
    }
  }
]

export async function GET() {
  try {
    return NextResponse.json({
      templates,
      count: templates.length,
      categories: {
        languages: [...new Set(templates.map(t => t.language))],
        frameworks: [...new Set(templates.map(t => t.framework))],
        difficulties: [...new Set(templates.map(t => t.difficulty))]
      }
    })
  } catch (error) {
    console.error('Templates API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Template creation not implemented yet' },
    { status: 501 }
  )
}