/**
 * Project Templates and AI-Powered Scaffolding System
 * Provides pre-configured project templates with intelligent code generation
 */

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: string
  language: string
  framework?: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  features: string[]
  fileStructure: FileTemplate[]
  dependencies: Record<string, string>
  devDependencies?: Record<string, string>
  scripts: Record<string, string>
  envVars?: EnvVariable[]
  setupInstructions: string[]
  aiPrompts: AIPrompt[]
  estimatedTime: string
  popular: boolean
}

export interface FileTemplate {
  path: string
  content: string
  isTemplate: boolean
  variables?: string[]
}

export interface EnvVariable {
  name: string
  description: string
  required: boolean
  defaultValue?: string
  example?: string
}

export interface AIPrompt {
  trigger: string
  prompt: string
  context: string[]
}

export const PROJECT_TEMPLATES: Record<string, ProjectTemplate> = {
  'nextjs-saas': {
    id: 'nextjs-saas',
    name: 'Next.js SaaS Starter',
    description: 'Full-stack SaaS application with authentication, payments, and dashboard',
    category: 'Web Application',
    language: 'TypeScript',
    framework: 'Next.js',
    difficulty: 'intermediate',
    tags: ['saas', 'auth', 'payments', 'dashboard', 'prisma'],
    features: [
      'Next.js 15 with App Router',
      'TypeScript',
      'Tailwind CSS',
      'Prisma ORM',
      'NextAuth.js authentication',
      'Stripe payments integration',
      'Admin dashboard',
      'User management',
      'Email templates',
      'SEO optimization'
    ],
    fileStructure: [
      {
        path: 'src/app/layout.tsx',
        content: `import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: '{{projectName}} - Modern SaaS Platform',
  description: 'Build and scale your business with our powerful SaaS platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}`,
        isTemplate: true,
        variables: ['projectName']
      },
      {
        path: 'src/app/page.tsx',
        content: `import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <nav className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{{projectName}}</h1>
            <div className="space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h2 className="text-5xl font-bold mb-6">
            Build Something Amazing
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            The fastest way to build and deploy your SaaS application with modern tools and best practices.
          </p>
          <div className="space-x-4">
            <Button size="lg" asChild>
              <Link href="/signup">Start Free Trial</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/demo">View Demo</Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-3">Lightning Fast</h3>
            <p className="text-gray-600">Built with Next.js 15 and optimized for performance.</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-3">Secure by Default</h3>
            <p className="text-gray-600">Enterprise-grade security with built-in authentication.</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-3">Scale with Ease</h3>
            <p className="text-gray-600">From MVP to millions of users, we've got you covered.</p>
          </Card>
        </div>
      </main>
    </div>
  )
}`,
        isTemplate: true,
        variables: ['projectName']
      },
      {
        path: 'src/app/api/auth/[...nextauth]/route.ts',
        content: `import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }`,
        isTemplate: false
      }
    ],
    dependencies: {
      'next': '^15.0.0',
      'react': '^18.0.0',
      'react-dom': '^18.0.0',
      'next-auth': '^4.24.0',
      '@prisma/client': '^5.0.0',
      'stripe': '^14.0.0',
      'tailwindcss': '^3.4.0',
      'typescript': '^5.0.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      '@types/react': '^18.0.0',
      '@types/react-dom': '^18.0.0',
      'prisma': '^5.0.0',
      'eslint': '^8.0.0',
      'eslint-config-next': '^15.0.0'
    },
    scripts: {
      'dev': 'next dev',
      'build': 'next build',
      'start': 'next start',
      'lint': 'next lint',
      'db:push': 'prisma db push',
      'db:studio': 'prisma studio'
    },
    envVars: [
      {
        name: 'NEXTAUTH_SECRET',
        description: 'Secret for NextAuth.js encryption',
        required: true,
        example: 'your-secret-here'
      },
      {
        name: 'NEXTAUTH_URL',
        description: 'Base URL of your application',
        required: true,
        example: 'http://localhost:3000'
      },
      {
        name: 'DATABASE_URL',
        description: 'Database connection string',
        required: true,
        example: 'postgresql://user:password@localhost:5432/mydb'
      },
      {
        name: 'STRIPE_SECRET_KEY',
        description: 'Stripe secret key for payments',
        required: true,
        example: 'sk_test_...'
      }
    ],
    setupInstructions: [
      'Install dependencies with npm install',
      'Copy .env.example to .env.local and fill in your values',
      'Set up your database with npx prisma db push',
      'Run the development server with npm run dev',
      'Configure your Stripe webhook endpoints'
    ],
    aiPrompts: [
      {
        trigger: 'add authentication',
        prompt: 'Add user authentication with NextAuth.js including Google and GitHub providers',
        context: ['nextauth', 'providers', 'session management']
      },
      {
        trigger: 'add payments',
        prompt: 'Implement Stripe payments with subscription management and billing portal',
        context: ['stripe', 'subscriptions', 'webhooks']
      },
      {
        trigger: 'add dashboard',
        prompt: 'Create an admin dashboard with user management and analytics',
        context: ['dashboard', 'charts', 'user management']
      }
    ],
    estimatedTime: '2-4 hours',
    popular: true
  },

  'react-component-library': {
    id: 'react-component-library',
    name: 'React Component Library',
    description: 'Publishable React component library with Storybook and TypeScript',
    category: 'Library',
    language: 'TypeScript',
    framework: 'React',
    difficulty: 'intermediate',
    tags: ['components', 'storybook', 'library', 'npm'],
    features: [
      'TypeScript support',
      'Storybook documentation',
      'Jest testing',
      'Rollup bundling',
      'ESLint + Prettier',
      'Automated releases',
      'NPM publishing',
      'CSS-in-JS with styled-components'
    ],
    fileStructure: [
      {
        path: 'src/components/Button/Button.tsx',
        content: `import React from 'react'
import styled from 'styled-components'

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'small' | 'medium' | 'large'
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}

const StyledButton = styled.button<ButtonProps>\`
  padding: \${props => {
    switch (props.size) {
      case 'small': return '8px 16px'
      case 'large': return '16px 32px'
      default: return '12px 24px'
    }
  }};

  background-color: \${props => {
    switch (props.variant) {
      case 'secondary': return '#6b7280'
      case 'outline': return 'transparent'
      default: return '#3b82f6'
    }
  }};

  color: \${props => props.variant === 'outline' ? '#3b82f6' : 'white'};
  border: \${props => props.variant === 'outline' ? '2px solid #3b82f6' : 'none'};
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
\`

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  children,
  ...props
}) => {
  return (
    <StyledButton variant={variant} size={size} {...props}>
      {children}
    </StyledButton>
  )
}`,
        isTemplate: false
      }
    ],
    dependencies: {
      'react': '^18.0.0',
      'react-dom': '^18.0.0',
      'styled-components': '^6.0.0'
    },
    devDependencies: {
      '@types/react': '^18.0.0',
      '@types/react-dom': '^18.0.0',
      '@types/styled-components': '^5.1.0',
      '@storybook/react': '^7.0.0',
      '@storybook/addon-essentials': '^7.0.0',
      'rollup': '^4.0.0',
      'typescript': '^5.0.0',
      'jest': '^29.0.0',
      '@testing-library/react': '^14.0.0'
    },
    scripts: {
      'build': 'rollup -c',
      'dev': 'rollup -c -w',
      'test': 'jest',
      'storybook': 'storybook dev -p 6006',
      'build-storybook': 'storybook build'
    },
    envVars: [],
    setupInstructions: [
      'Install dependencies with npm install',
      'Start Storybook with npm run storybook',
      'Build library with npm run build',
      'Run tests with npm test',
      'Publish to NPM with npm publish'
    ],
    aiPrompts: [
      {
        trigger: 'add component',
        prompt: 'Create a new reusable component with TypeScript, tests, and Storybook stories',
        context: ['react', 'typescript', 'storybook', 'testing']
      },
      {
        trigger: 'add theming',
        prompt: 'Implement a theming system with design tokens and theme provider',
        context: ['theming', 'design-tokens', 'styled-components']
      }
    ],
    estimatedTime: '3-5 hours',
    popular: true
  },

  'python-fastapi': {
    id: 'python-fastapi',
    name: 'FastAPI Backend',
    description: 'Modern Python API with FastAPI, SQLAlchemy, and async support',
    category: 'Backend API',
    language: 'Python',
    framework: 'FastAPI',
    difficulty: 'intermediate',
    tags: ['api', 'python', 'async', 'database', 'auth'],
    features: [
      'FastAPI framework',
      'SQLAlchemy ORM',
      'Async/await support',
      'JWT authentication',
      'Pydantic validation',
      'OpenAPI docs',
      'PostgreSQL database',
      'Docker support',
      'pytest testing',
      'Alembic migrations'
    ],
    fileStructure: [
      {
        path: 'main.py',
        content: `from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas, crud
from .database import SessionLocal, engine
from .auth import get_current_user

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="{{projectName}} API",
    description="A modern FastAPI backend service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
async def root():
    return {"message": "Welcome to {{projectName}} API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "{{projectName}}"}

@app.post("/users/", response_model=schemas.User)
async def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@app.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)`,
        isTemplate: true,
        variables: ['projectName']
      },
      {
        path: 'requirements.txt',
        content: `fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
pytest==7.4.3
pytest-asyncio==0.21.1
alembic==1.13.0
pydantic==2.5.0`,
        isTemplate: false
      }
    ],
    dependencies: {},
    scripts: {
      'start': 'uvicorn main:app --reload',
      'test': 'pytest',
      'migrate': 'alembic upgrade head'
    },
    envVars: [
      {
        name: 'DATABASE_URL',
        description: 'PostgreSQL database URL',
        required: true,
        example: 'postgresql://user:password@localhost:5432/dbname'
      },
      {
        name: 'SECRET_KEY',
        description: 'JWT secret key',
        required: true,
        example: 'your-secret-key-here'
      }
    ],
    setupInstructions: [
      'Create virtual environment: python -m venv venv',
      'Activate: source venv/bin/activate (Linux/Mac) or venv\\Scripts\\activate (Windows)',
      'Install dependencies: pip install -r requirements.txt',
      'Set up environment variables in .env file',
      'Run migrations: alembic upgrade head',
      'Start server: uvicorn main:app --reload'
    ],
    aiPrompts: [
      {
        trigger: 'add authentication',
        prompt: 'Implement JWT authentication with login, registration, and password reset',
        context: ['jwt', 'auth', 'security']
      },
      {
        trigger: 'add database model',
        prompt: 'Create a new SQLAlchemy model with CRUD operations and API endpoints',
        context: ['sqlalchemy', 'crud', 'api-endpoints']
      }
    ],
    estimatedTime: '4-6 hours',
    popular: true
  },

  'vue-pwa': {
    id: 'vue-pwa',
    name: 'Vue.js PWA',
    description: 'Progressive Web App with Vue 3, Composition API, and offline support',
    category: 'Web Application',
    language: 'TypeScript',
    framework: 'Vue.js',
    difficulty: 'intermediate',
    tags: ['pwa', 'vue', 'offline', 'mobile', 'composition-api'],
    features: [
      'Vue 3 with Composition API',
      'TypeScript support',
      'PWA capabilities',
      'Offline support',
      'Push notifications',
      'Vuetify UI components',
      'Pinia state management',
      'Service worker',
      'App manifest',
      'Workbox integration'
    ],
    fileStructure: [
      {
        path: 'src/main.ts',
        content: `import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import { registerSW } from 'virtual:pwa-register'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

app.mount('#app')

// Register service worker
registerSW({
  onNeedRefresh() {
    // Show update available notification
  },
  onOfflineReady() {
    // Show app ready to work offline
  },
})`,
        isTemplate: false
      }
    ],
    dependencies: {
      'vue': '^3.3.0',
      'vue-router': '^4.2.0',
      'pinia': '^2.1.0',
      'vuetify': '^3.4.0',
      '@mdi/font': '^7.3.0'
    },
    devDependencies: {
      '@vitejs/plugin-vue': '^4.4.0',
      'vite': '^4.5.0',
      'vite-plugin-pwa': '^0.17.0',
      'typescript': '^5.2.0',
      'workbox-window': '^7.0.0'
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview'
    },
    envVars: [],
    setupInstructions: [
      'Install dependencies with npm install',
      'Run development server with npm run dev',
      'Build for production with npm run build',
      'Test PWA features with npm run preview'
    ],
    aiPrompts: [
      {
        trigger: 'add offline feature',
        prompt: 'Implement offline functionality with data caching and sync',
        context: ['offline', 'caching', 'sync']
      },
      {
        trigger: 'add push notifications',
        prompt: 'Set up push notifications with service worker and notification API',
        context: ['push-notifications', 'service-worker']
      }
    ],
    estimatedTime: '3-5 hours',
    popular: false
  },

  'gradio-chatbot': {
    id: 'gradio-chatbot',
    name: 'Gradio AI Chatbot',
    description: 'Interactive AI chatbot interface with Gradio and multiple LLM providers',
    category: 'AI Application',
    language: 'Python',
    framework: 'Gradio',
    difficulty: 'intermediate',
    tags: ['gradio', 'chatbot', 'ai', 'llm', 'interface'],
    features: [
      'Interactive chat interface',
      'Multiple AI model support',
      'Chat history management',
      'Custom styling and themes',
      'File upload capabilities',
      'Response streaming',
      'User session management',
      'Export conversations'
    ],
    fileStructure: [
      {
        path: 'app.py',
        content: `import gradio as gr
import openai
from typing import List, Tuple
import json
import os
from datetime import datetime

class ChatBot:
    def __init__(self):
        self.conversation_history = []
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        
    def chat_response(self, message: str, history: List[Tuple[str, str]]) -> Tuple[str, List[Tuple[str, str]]]:
        """Generate AI response and update chat history"""
        try:
            # Prepare conversation context
            messages = [{"role": "system", "content": "You are a helpful AI assistant."}]
            
            # Add history to context
            for user_msg, assistant_msg in history:
                messages.append({"role": "user", "content": user_msg})
                messages.append({"role": "assistant", "content": assistant_msg})
            
            # Add current message
            messages.append({"role": "user", "content": message})
            
            # Generate response
            client = openai.OpenAI(api_key=self.api_key)
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                max_tokens=500,
                temperature=0.7
            )
            
            ai_response = response.choices[0].message.content
            
            # Update history
            history.append((message, ai_response))
            
            return "", history
            
        except Exception as e:
            error_msg = f"Error: {str(e)}"
            history.append((message, error_msg))
            return "", history
    
    def clear_history(self):
        """Clear chat history"""
        return []
    
    def export_conversation(self, history: List[Tuple[str, str]]) -> str:
        """Export conversation to JSON"""
        export_data = {
            "timestamp": datetime.now().isoformat(),
            "conversation": [
                {"user": user_msg, "assistant": ai_msg} 
                for user_msg, ai_msg in history
            ]
        }
        return json.dumps(export_data, indent=2)

# Initialize chatbot
chatbot = ChatBot()

# Custom CSS
css = """
.gradio-container {
    font-family: 'Arial', sans-serif;
}
.chat-message {
    padding: 10px;
    margin: 5px 0;
    border-radius: 10px;
}
"""

# Create Gradio interface
with gr.Blocks(css=css, title="AI Chatbot Assistant") as demo:
    gr.Markdown("# 🤖 AI Chatbot Assistant")
    gr.Markdown("Chat with an AI assistant powered by OpenAI's GPT models.")
    
    with gr.Row():
        with gr.Column(scale=4):
            chatbot_interface = gr.Chatbot(
                label="Conversation",
                height=400,
                show_label=True
            )
            
            with gr.Row():
                msg_input = gr.Textbox(
                    placeholder="Type your message here...",
                    label="Message",
                    scale=4
                )
                send_btn = gr.Button("Send", scale=1, variant="primary")
            
            with gr.Row():
                clear_btn = gr.Button("Clear Chat", variant="secondary")
                export_btn = gr.Button("Export Conversation", variant="secondary")
        
        with gr.Column(scale=1):
            gr.Markdown("### Settings")
            api_key_input = gr.Textbox(
                label="OpenAI API Key",
                type="password",
                placeholder="sk-..."
            )
            
            model_choice = gr.Dropdown(
                choices=["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo-preview"],
                value="gpt-3.5-turbo",
                label="Model"
            )
            
            temperature_slider = gr.Slider(
                minimum=0.0,
                maximum=2.0,
                value=0.7,
                step=0.1,
                label="Temperature"
            )
    
    # Output for exported conversation
    export_output = gr.Textbox(
        label="Exported Conversation",
        visible=False,
        max_lines=10
    )
    
    # Event handlers
    send_btn.click(
        chatbot.chat_response,
        inputs=[msg_input, chatbot_interface],
        outputs=[msg_input, chatbot_interface]
    )
    
    msg_input.submit(
        chatbot.chat_response,
        inputs=[msg_input, chatbot_interface],
        outputs=[msg_input, chatbot_interface]
    )
    
    clear_btn.click(
        chatbot.clear_history,
        outputs=chatbot_interface
    )
    
    export_btn.click(
        chatbot.export_conversation,
        inputs=chatbot_interface,
        outputs=export_output
    ).then(
        lambda: gr.update(visible=True),
        outputs=export_output
    )

if __name__ == "__main__":
    demo.launch(share=True, server_name="0.0.0.0")`,
        isTemplate: true,
        variables: ['projectName']
      },
      {
        path: 'requirements.txt',
        content: `gradio>=4.0.0
openai>=1.0.0
python-dotenv>=1.0.0
requests>=2.31.0`,
        isTemplate: false
      },
      {
        path: '.env.example',
        content: `OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
HUGGINGFACE_API_TOKEN=your_huggingface_token_here`,
        isTemplate: false
      }
    ],
    dependencies: {
      'gradio': '>=4.0.0',
      'openai': '>=1.0.0',
      'python-dotenv': '>=1.0.0',
      'requests': '>=2.31.0'
    },
    scripts: {
      'start': 'python app.py',
      'dev': 'gradio app.py',
      'install': 'pip install -r requirements.txt'
    },
    envVars: [
      {
        name: 'OPENAI_API_KEY',
        description: 'OpenAI API key for GPT models',
        required: true,
        example: 'sk-...'
      }
    ],
    setupInstructions: [
      'Install Python 3.8 or higher',
      'Install dependencies: pip install -r requirements.txt',
      'Copy .env.example to .env and add your API keys',
      'Run the application: python app.py',
      'Open the provided URL in your browser'
    ],
    aiPrompts: [
      {
        trigger: 'enhance chatbot',
        prompt: 'Add advanced features to this Gradio chatbot including voice input, image uploads, and conversation memory',
        context: ['gradio', 'chatbot', 'multimodal']
      }
    ],
    estimatedTime: '2-3 hours',
    popular: true
  },

  'gradio-image-analyzer': {
    id: 'gradio-image-analyzer',
    name: 'Gradio Image Analysis Tool',
    description: 'Advanced image processing and analysis interface with multiple AI models',
    category: 'AI Application',
    language: 'Python',
    framework: 'Gradio',
    difficulty: 'intermediate',
    tags: ['gradio', 'computer-vision', 'image-analysis', 'ai', 'opencv'],
    features: [
      'Image upload and preprocessing',
      'Multiple analysis models',
      'Batch processing capabilities',
      'Results visualization',
      'Export functionality',
      'Real-time image filters',
      'Object detection and classification',
      'Performance metrics display'
    ],
    fileStructure: [
      {
        path: 'app.py',
        content: `import gradio as gr
import cv2
import numpy as np
from PIL import Image, ImageEnhance
import matplotlib.pyplot as plt
import io
import base64
from typing import Tuple, List, Dict, Any
import json

class ImageAnalyzer:
    def __init__(self):
        self.analysis_history = []
    
    def analyze_image(self, image: Image.Image, analysis_type: str) -> Tuple[Image.Image, str, Dict]:
        """Perform image analysis based on selected type"""
        if image is None:
            return None, "Please upload an image first.", {}
        
        # Convert PIL to OpenCV format
        img_array = np.array(image)
        if len(img_array.shape) == 3:
            img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        else:
            img_cv = img_array
        
        result_image = image.copy()
        analysis_text = ""
        metrics = {}
        
        try:
            if analysis_type == "Basic Info":
                result_image, analysis_text, metrics = self._basic_analysis(image, img_cv)
            elif analysis_type == "Edge Detection":
                result_image, analysis_text, metrics = self._edge_detection(image, img_cv)
            elif analysis_type == "Color Analysis":
                result_image, analysis_text, metrics = self._color_analysis(image, img_cv)
            elif analysis_type == "Object Detection":
                result_image, analysis_text, metrics = self._object_detection(image, img_cv)
            elif analysis_type == "Quality Assessment":
                result_image, analysis_text, metrics = self._quality_assessment(image, img_cv)
                
        except Exception as e:
            analysis_text = f"Error during analysis: {str(e)}"
            metrics = {"error": str(e)}
        
        return result_image, analysis_text, metrics
    
    def _basic_analysis(self, image: Image.Image, img_cv: np.ndarray) -> Tuple[Image.Image, str, Dict]:
        """Basic image information analysis"""
        width, height = image.size
        channels = len(img_cv.shape) if len(img_cv.shape) == 2 else img_cv.shape[2]
        
        # Calculate file size estimation
        img_bytes = io.BytesIO()
        image.save(img_bytes, format='PNG')
        file_size = len(img_bytes.getvalue())
        
        analysis = f"""
**Image Dimensions:** {width} × {height} pixels
**Channels:** {channels}
**Estimated Size:** {file_size / 1024:.1f} KB
**Aspect Ratio:** {width/height:.2f}
**Total Pixels:** {width * height:,}
        """
        
        metrics = {
            "width": width,
            "height": height,
            "channels": channels,
            "file_size_kb": file_size / 1024,
            "aspect_ratio": width/height
        }
        
        return image, analysis, metrics
    
    def _edge_detection(self, image: Image.Image, img_cv: np.ndarray) -> Tuple[Image.Image, str, Dict]:
        """Edge detection analysis"""
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        
        # Convert back to PIL
        edge_image = Image.fromarray(edges, mode='L')
        
        # Calculate edge statistics
        edge_pixels = np.sum(edges > 0)
        total_pixels = edges.shape[0] * edges.shape[1]
        edge_density = edge_pixels / total_pixels
        
        analysis = f"""
**Edge Detection Results:**
- Edge Pixels: {edge_pixels:,}
- Edge Density: {edge_density:.1%}
- Total Pixels: {total_pixels:,}
        """
        
        metrics = {
            "edge_pixels": int(edge_pixels),
            "edge_density": float(edge_density),
            "total_pixels": int(total_pixels)
        }
        
        return edge_image, analysis, metrics
    
    def _color_analysis(self, image: Image.Image, img_cv: np.ndarray) -> Tuple[Image.Image, str, Dict]:
        """Color distribution analysis"""
        # Calculate color histograms
        hist_b = cv2.calcHist([img_cv], [0], None, [256], [0, 256])
        hist_g = cv2.calcHist([img_cv], [1], None, [256], [0, 256])
        hist_r = cv2.calcHist([img_cv], [2], None, [256], [0, 256])
        
        # Calculate dominant colors
        data = img_cv.reshape((-1, 3))
        from collections import Counter
        colors = [tuple(color) for color in data]
        color_counts = Counter(colors)
        dominant_colors = color_counts.most_common(5)
        
        # Create histogram visualization
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
        
        # Original image
        ax1.imshow(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
        ax1.set_title('Original Image')
        ax1.axis('off')
        
        # Color histogram
        ax2.plot(hist_r, color='red', alpha=0.7, label='Red')
        ax2.plot(hist_g, color='green', alpha=0.7, label='Green')
        ax2.plot(hist_b, color='blue', alpha=0.7, label='Blue')
        ax2.set_title('Color Histogram')
        ax2.set_xlabel('Pixel Intensity')
        ax2.set_ylabel('Frequency')
        ax2.legend()
        
        # Convert plot to image
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        buf.seek(0)
        result_image = Image.open(buf)
        plt.close()
        
        analysis = f"""
**Color Analysis Results:**
- Dominant Colors (BGR format):
"""
        for i, (color, count) in enumerate(dominant_colors):
            analysis += f"  {i+1}. {color} ({count:,} pixels)\\n"
        
        metrics = {
            "dominant_colors": [{"color": color, "count": int(count)} for color, count in dominant_colors],
            "total_unique_colors": len(color_counts)
        }
        
        return result_image, analysis, metrics
    
    def _object_detection(self, image: Image.Image, img_cv: np.ndarray) -> Tuple[Image.Image, str, Dict]:
        """Simple object detection using OpenCV cascades"""
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        
        # Load Haar cascade for face detection (example)
        # Note: In a real implementation, you'd want to download the cascade file
        try:
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            
            # Draw rectangles around faces
            result_cv = img_cv.copy()
            for (x, y, w, h) in faces:
                cv2.rectangle(result_cv, (x, y), (x+w, y+h), (255, 0, 0), 2)
            
            result_image = Image.fromarray(cv2.cvtColor(result_cv, cv2.COLOR_BGR2RGB))
            
            analysis = f"""
**Object Detection Results:**
- Faces Detected: {len(faces)}
- Detection Method: Haar Cascade
            """
            
            metrics = {
                "faces_detected": len(faces),
                "face_coordinates": [{"x": int(x), "y": int(y), "width": int(w), "height": int(h)} for x, y, w, h in faces]
            }
            
        except Exception as e:
            analysis = f"Object detection failed: {str(e)}"
            metrics = {"error": str(e)}
            result_image = image
        
        return result_image, analysis, metrics
    
    def _quality_assessment(self, image: Image.Image, img_cv: np.ndarray) -> Tuple[Image.Image, str, Dict]:
        """Assess image quality metrics"""
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        
        # Calculate sharpness (Laplacian variance)
        sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Calculate brightness
        brightness = np.mean(gray)
        
        # Calculate contrast
        contrast = gray.std()
        
        # Create quality visualization
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(10, 8))
        
        # Original image
        ax1.imshow(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
        ax1.set_title('Original Image')
        ax1.axis('off')
        
        # Histogram
        ax2.hist(gray.ravel(), bins=256, range=[0, 256], alpha=0.7)
        ax2.set_title('Brightness Distribution')
        ax2.set_xlabel('Pixel Intensity')
        ax2.set_ylabel('Frequency')
        
        # Quality metrics
        metrics_text = f"""
Quality Metrics:
Sharpness: {sharpness:.1f}
Brightness: {brightness:.1f}
Contrast: {contrast:.1f}
        """
        ax3.text(0.1, 0.5, metrics_text, fontsize=12, verticalalignment='center')
        ax3.set_xlim(0, 1)
        ax3.set_ylim(0, 1)
        ax3.axis('off')
        ax3.set_title('Quality Metrics')
        
        # Laplacian (sharpness visualization)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        ax4.imshow(laplacian, cmap='gray')
        ax4.set_title('Sharpness Map')
        ax4.axis('off')
        
        plt.tight_layout()
        
        # Convert plot to image
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        buf.seek(0)
        result_image = Image.open(buf)
        plt.close()
        
        analysis = f"""
**Quality Assessment Results:**
- **Sharpness Score:** {sharpness:.1f} (higher = sharper)
- **Average Brightness:** {brightness:.1f} (0-255 scale)
- **Contrast Score:** {contrast:.1f} (higher = more contrast)

**Quality Rating:**
- Sharpness: {"Good" if sharpness > 100 else "Fair" if sharpness > 50 else "Poor"}
- Brightness: {"Good" if 50 < brightness < 200 else "Needs adjustment"}
- Contrast: {"Good" if contrast > 50 else "Low contrast"}
        """
        
        metrics = {
            "sharpness": float(sharpness),
            "brightness": float(brightness),
            "contrast": float(contrast)
        }
        
        return result_image, analysis, metrics

# Initialize analyzer
analyzer = ImageAnalyzer()

# Custom CSS
css = """
.gradio-container {
    font-family: 'Arial', sans-serif;
}
.analysis-output {
    font-family: 'Courier New', monospace;
}
"""

# Create Gradio interface
with gr.Blocks(css=css, title="Image Analysis Tool") as demo:
    gr.Markdown("# 🔍 AI Image Analysis Tool")
    gr.Markdown("Upload an image and select analysis type to get detailed insights.")
    
    with gr.Row():
        with gr.Column(scale=1):
            input_image = gr.Image(
                label="Upload Image",
                type="pil",
                height=300
            )
            
            analysis_type = gr.Dropdown(
                choices=[
                    "Basic Info",
                    "Edge Detection", 
                    "Color Analysis",
                    "Object Detection",
                    "Quality Assessment"
                ],
                value="Basic Info",
                label="Analysis Type"
            )
            
            analyze_btn = gr.Button(
                "Analyze Image", 
                variant="primary",
                size="lg"
            )
        
        with gr.Column(scale=2):
            with gr.Tabs():
                with gr.Tab("Results"):
                    output_image = gr.Image(
                        label="Analysis Result",
                        height=400
                    )
                    
                    analysis_output = gr.Textbox(
                        label="Analysis Report",
                        lines=10,
                        elem_classes=["analysis-output"]
                    )
                
                with gr.Tab("Metrics"):
                    metrics_json = gr.JSON(
                        label="Detailed Metrics"
                    )
                
                with gr.Tab("Batch Processing"):
                    gr.Markdown("### Batch Processing")
                    batch_images = gr.File(
                        file_count="multiple",
                        label="Upload Multiple Images"
                    )
                    batch_process_btn = gr.Button("Process Batch")
                    batch_results = gr.Textbox(
                        label="Batch Results",
                        lines=5
                    )
    
    # Event handlers
    analyze_btn.click(
        analyzer.analyze_image,
        inputs=[input_image, analysis_type],
        outputs=[output_image, analysis_output, metrics_json]
    )
    
    # Auto-analyze when image is uploaded
    input_image.change(
        analyzer.analyze_image,
        inputs=[input_image, analysis_type],
        outputs=[output_image, analysis_output, metrics_json]
    )

if __name__ == "__main__":
    demo.launch(share=True, server_name="0.0.0.0")`,
        isTemplate: true,
        variables: ['projectName']
      },
      {
        path: 'requirements.txt',
        content: `gradio>=4.0.0
opencv-python>=4.8.0
Pillow>=10.0.0
matplotlib>=3.7.0
numpy>=1.24.0`,
        isTemplate: false
      }
    ],
    dependencies: {
      'gradio': '>=4.0.0',
      'opencv-python': '>=4.8.0',
      'Pillow': '>=10.0.0',
      'matplotlib': '>=3.7.0',
      'numpy': '>=1.24.0'
    },
    scripts: {
      'start': 'python app.py',
      'dev': 'gradio app.py',
      'install': 'pip install -r requirements.txt'
    },
    setupInstructions: [
      'Install Python 3.8 or higher',
      'Install dependencies: pip install -r requirements.txt',
      'Run the application: python app.py',
      'Upload images and select analysis types'
    ],
    aiPrompts: [
      {
        trigger: 'add ml model',
        prompt: 'Integrate a pre-trained machine learning model for image classification or object detection',
        context: ['gradio', 'computer-vision', 'machine-learning']
      }
    ],
    estimatedTime: '3-4 hours',
    popular: true
  },

  'gradio-data-dashboard': {
    id: 'gradio-data-dashboard',
    name: 'Gradio Data Analytics Dashboard',
    description: 'Interactive data visualization and analysis dashboard with real-time charts',
    category: 'AI Application',
    language: 'Python',
    framework: 'Gradio',
    difficulty: 'advanced',
    tags: ['gradio', 'data-analysis', 'visualization', 'dashboard', 'plotly'],
    features: [
      'CSV/Excel file upload',
      'Interactive data exploration',
      'Multiple chart types',
      'Statistical analysis',
      'Data filtering and sorting',
      'Export capabilities',
      'Real-time updates',
      'Custom visualizations'
    ],
    fileStructure: [
      {
        path: 'app.py',
        content: `import gradio as gr
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np
from typing import Dict, List, Tuple, Any
import io
import json

class DataDashboard:
    def __init__(self):
        self.current_data = None
        self.analysis_cache = {}
    
    def load_data(self, file) -> Tuple[pd.DataFrame, str, Dict]:
        """Load and preview uploaded data"""
        if file is None:
            return pd.DataFrame(), "Please upload a file first.", {}
        
        try:
            # Determine file type and load accordingly
            if file.name.endswith('.csv'):
                df = pd.read_csv(file.name)
            elif file.name.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(file.name)
            else:
                return pd.DataFrame(), "Unsupported file format. Please upload CSV or Excel files.", {}
            
            self.current_data = df
            
            # Generate summary statistics
            summary = self._generate_summary(df)
            
            return df.head(100), summary, self._get_column_info(df)
            
        except Exception as e:
            return pd.DataFrame(), f"Error loading file: {str(e)}", {}
    
    def _generate_summary(self, df: pd.DataFrame) -> str:
        """Generate data summary"""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        categorical_cols = df.select_dtypes(include=['object']).columns
        
        summary = f"""
**Dataset Overview:**
- **Shape:** {df.shape[0]} rows × {df.shape[1]} columns
- **Numeric Columns:** {len(numeric_cols)}
- **Categorical Columns:** {len(categorical_cols)}
- **Memory Usage:** {df.memory_usage(deep=True).sum() / 1024:.1f} KB

**Numeric Columns Summary:**
"""
        if len(numeric_cols) > 0:
            desc = df[numeric_cols].describe()
            for col in numeric_cols[:5]:  # Show first 5 columns
                summary += f"\\n**{col}:**\\n"
                summary += f"  - Mean: {desc.loc['mean', col]:.2f}\\n"
                summary += f"  - Std: {desc.loc['std', col]:.2f}\\n"
                summary += f"  - Range: {desc.loc['min', col]:.2f} to {desc.loc['max', col]:.2f}\\n"
        
        summary += f"\\n**Missing Values:**\\n"
        missing = df.isnull().sum()
        for col in missing[missing > 0].index[:5]:
            summary += f"  - {col}: {missing[col]} ({missing[col]/len(df)*100:.1f}%)\\n"
        
        return summary
    
    def _get_column_info(self, df: pd.DataFrame) -> Dict:
        """Get column information for dropdowns"""
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object']).columns.tolist()
        all_cols = df.columns.tolist()
        
        return {
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols,
            "all_columns": all_cols,
            "shape": df.shape
        }
    
    def create_visualization(self, chart_type: str, x_col: str, y_col: str, color_col: str = None) -> go.Figure:
        """Create visualization based on parameters"""
        if self.current_data is None:
            return go.Figure().add_annotation(text="No data loaded", showarrow=False)
        
        df = self.current_data
        
        try:
            if chart_type == "Scatter Plot":
                fig = px.scatter(df, x=x_col, y=y_col, color=color_col, 
                               title=f"{chart_type}: {y_col} vs {x_col}")
            
            elif chart_type == "Line Chart":
                fig = px.line(df, x=x_col, y=y_col, color=color_col,
                             title=f"{chart_type}: {y_col} over {x_col}")
            
            elif chart_type == "Bar Chart":
                if color_col:
                    fig = px.bar(df, x=x_col, y=y_col, color=color_col,
                                title=f"{chart_type}: {y_col} by {x_col}")
                else:
                    # Aggregate data for bar chart
                    if x_col in df.select_dtypes(include=['object']).columns:
                        agg_data = df.groupby(x_col)[y_col].mean().reset_index()
                        fig = px.bar(agg_data, x=x_col, y=y_col,
                                    title=f"{chart_type}: Average {y_col} by {x_col}")
                    else:
                        fig = px.histogram(df, x=x_col, title=f"Distribution of {x_col}")
            
            elif chart_type == "Histogram":
                fig = px.histogram(df, x=x_col, color=color_col,
                                 title=f"Distribution of {x_col}")
            
            elif chart_type == "Box Plot":
                fig = px.box(df, x=x_col, y=y_col, color=color_col,
                            title=f"Box Plot: {y_col} by {x_col}")
            
            elif chart_type == "Correlation Heatmap":
                numeric_df = df.select_dtypes(include=[np.number])
                if len(numeric_df.columns) > 1:
                    corr_matrix = numeric_df.corr()
                    fig = px.imshow(corr_matrix, text_auto=True, aspect="auto",
                                   title="Correlation Heatmap")
                else:
                    fig = go.Figure().add_annotation(text="Need at least 2 numeric columns", showarrow=False)
            
            else:
                fig = go.Figure().add_annotation(text="Chart type not implemented", showarrow=False)
            
            fig.update_layout(height=500)
            return fig
            
        except Exception as e:
            return go.Figure().add_annotation(text=f"Error creating chart: {str(e)}", showarrow=False)
    
    def statistical_analysis(self, analysis_type: str, column: str) -> Tuple[str, Dict]:
        """Perform statistical analysis"""
        if self.current_data is None or column not in self.current_data.columns:
            return "No data available or invalid column", {}
        
        df = self.current_data
        col_data = df[column].dropna()
        
        try:
            if analysis_type == "Descriptive Statistics":
                if pd.api.types.is_numeric_dtype(col_data):
                    stats = col_data.describe()
                    analysis = f"""
**Descriptive Statistics for {column}:**
- Count: {stats['count']:.0f}
- Mean: {stats['mean']:.4f}
- Std: {stats['std']:.4f}
- Min: {stats['min']:.4f}
- 25%: {stats['25%']:.4f}
- 50% (Median): {stats['50%']:.4f}
- 75%: {stats['75%']:.4f}
- Max: {stats['max']:.4f}

**Additional Metrics:**
- Variance: {col_data.var():.4f}
- Skewness: {col_data.skew():.4f}
- Kurtosis: {col_data.kurtosis():.4f}
                    """
                    metrics = stats.to_dict()
                    metrics.update({
                        'variance': col_data.var(),
                        'skewness': col_data.skew(),
                        'kurtosis': col_data.kurtosis()
                    })
                else:
                    value_counts = col_data.value_counts()
                    analysis = f"""
**Descriptive Statistics for {column}:**
- Count: {len(col_data)}
- Unique Values: {col_data.nunique()}
- Most Frequent: {value_counts.index[0]} ({value_counts.iloc[0]} times)
- Least Frequent: {value_counts.index[-1]} ({value_counts.iloc[-1]} times)

**Top 5 Values:**
"""
                    for i, (val, count) in enumerate(value_counts.head().items()):
                        analysis += f"{i+1}. {val}: {count} ({count/len(col_data)*100:.1f}%)\\n"
                    
                    metrics = {
                        'count': len(col_data),
                        'unique': col_data.nunique(),
                        'most_frequent': value_counts.index[0],
                        'most_frequent_count': int(value_counts.iloc[0])
                    }
            
            elif analysis_type == "Outlier Detection":
                if pd.api.types.is_numeric_dtype(col_data):
                    Q1 = col_data.quantile(0.25)
                    Q3 = col_data.quantile(0.75)
                    IQR = Q3 - Q1
                    lower_bound = Q1 - 1.5 * IQR
                    upper_bound = Q3 + 1.5 * IQR
                    
                    outliers = col_data[(col_data < lower_bound) | (col_data > upper_bound)]
                    
                    analysis = f"""
**Outlier Detection for {column}:**
- Q1 (25th percentile): {Q1:.4f}
- Q3 (75th percentile): {Q3:.4f}
- IQR: {IQR:.4f}
- Lower Bound: {lower_bound:.4f}
- Upper Bound: {upper_bound:.4f}
- Number of Outliers: {len(outliers)}
- Outlier Percentage: {len(outliers)/len(col_data)*100:.2f}%

**Outlier Values:**
{outliers.head(10).tolist() if len(outliers) > 0 else 'No outliers detected'}
                    """
                    
                    metrics = {
                        'Q1': Q1,
                        'Q3': Q3,
                        'IQR': IQR,
                        'outlier_count': len(outliers),
                        'outlier_percentage': len(outliers)/len(col_data)*100,
                        'outliers': outliers.head(10).tolist()
                    }
                else:
                    analysis = f"Outlier detection is only available for numeric columns."
                    metrics = {}
            
            elif analysis_type == "Missing Value Analysis":
                missing_count = df[column].isnull().sum()
                missing_percentage = missing_count / len(df) * 100
                
                analysis = f"""
**Missing Value Analysis for {column}:**
- Total Missing Values: {missing_count}
- Missing Percentage: {missing_percentage:.2f}%
- Valid Values: {len(df) - missing_count}
- Data Type: {df[column].dtype}

**Missing Value Pattern:**
"""
                if missing_count > 0:
                    # Analyze missing value patterns
                    missing_mask = df[column].isnull()
                    if len(df.columns) > 1:
                        other_cols = [col for col in df.columns if col != column][:3]
                        for other_col in other_cols:
                            correlation = missing_mask.corr(df[other_col].isnull() if df[other_col].dtype == 'object' else missing_mask.corr(pd.Series(df[other_col].isnull(), dtype=float)))
                            analysis += f"- Correlation with {other_col} missing: {correlation:.3f}\\n"
                
                metrics = {
                    'missing_count': int(missing_count),
                    'missing_percentage': float(missing_percentage),
                    'valid_count': int(len(df) - missing_count),
                    'data_type': str(df[column].dtype)
                }
            
            return analysis, metrics
            
        except Exception as e:
            return f"Error in analysis: {str(e)}", {}
    
    def filter_data(self, column: str, filter_type: str, filter_value: str) -> pd.DataFrame:
        """Filter data based on criteria"""
        if self.current_data is None:
            return pd.DataFrame()
        
        df = self.current_data.copy()
        
        try:
            if filter_type == "Equal to":
                if pd.api.types.is_numeric_dtype(df[column]):
                    filtered_df = df[df[column] == float(filter_value)]
                else:
                    filtered_df = df[df[column] == filter_value]
            
            elif filter_type == "Greater than":
                if pd.api.types.is_numeric_dtype(df[column]):
                    filtered_df = df[df[column] > float(filter_value)]
                else:
                    return df  # Cannot apply numeric filter to non-numeric column
            
            elif filter_type == "Less than":
                if pd.api.types.is_numeric_dtype(df[column]):
                    filtered_df = df[df[column] < float(filter_value)]
                else:
                    return df
            
            elif filter_type == "Contains":
                if pd.api.types.is_string_dtype(df[column]):
                    filtered_df = df[df[column].str.contains(filter_value, na=False)]
                else:
                    return df
            
            else:
                filtered_df = df
            
            return filtered_df
            
        except Exception:
            return df

# Initialize dashboard
dashboard = DataDashboard()

# Custom CSS
css = """
.gradio-container {
    font-family: 'Arial', sans-serif;
}
.metric-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 10px;
    margin: 10px;
}
"""

# Create Gradio interface
with gr.Blocks(css=css, title="Data Analytics Dashboard") as demo:
    gr.Markdown("# 📊 Data Analytics Dashboard")
    gr.Markdown("Upload your data file and explore with interactive visualizations and statistical analysis.")
    
    with gr.Row():
        with gr.Column(scale=1):
            # Data Upload Section
            gr.Markdown("### 📁 Data Upload")
            file_input = gr.File(
                label="Upload CSV or Excel File",
                file_types=[".csv", ".xlsx", ".xls"]
            )
            
            upload_btn = gr.Button("Load Data", variant="primary")
            
            # Data Summary
            data_summary = gr.Textbox(
                label="Data Summary",
                lines=8,
                interactive=False
            )
        
        with gr.Column(scale=2):
            # Data Preview
            gr.Markdown("### 👀 Data Preview")
            data_preview = gr.Dataframe(
                label="Data Preview (First 100 rows)",
                interactive=False,
                height=300
            )
    
    with gr.Row():
        with gr.Column():
            # Visualization Section
            gr.Markdown("### 📈 Data Visualization")
            
            with gr.Row():
                chart_type = gr.Dropdown(
                    choices=[
                        "Scatter Plot",
                        "Line Chart", 
                        "Bar Chart",
                        "Histogram",
                        "Box Plot",
                        "Correlation Heatmap"
                    ],
                    value="Scatter Plot",
                    label="Chart Type"
                )
            
            with gr.Row():
                x_column = gr.Dropdown(
                    choices=[],
                    label="X-axis Column"
                )
                y_column = gr.Dropdown(
                    choices=[],
                    label="Y-axis Column"
                )
                color_column = gr.Dropdown(
                    choices=[],
                    label="Color Column (Optional)"
                )
            
            create_chart_btn = gr.Button("Create Visualization", variant="primary")
            
            # Chart Output
            chart_output = gr.Plot(label="Visualization")
        
        with gr.Column():
            # Statistical Analysis Section
            gr.Markdown("### 🔬 Statistical Analysis")
            
            analysis_column = gr.Dropdown(
                choices=[],
                label="Select Column"
            )
            
            analysis_type = gr.Dropdown(
                choices=[
                    "Descriptive Statistics",
                    "Outlier Detection",
                    "Missing Value Analysis"
                ],
                value="Descriptive Statistics",
                label="Analysis Type"
            )
            
            analyze_btn = gr.Button("Run Analysis", variant="primary")
            
            # Analysis Output
            analysis_output = gr.Textbox(
                label="Analysis Results",
                lines=8,
                interactive=False
            )
    
    with gr.Row():
        # Data Filtering Section
        gr.Markdown("### 🔍 Data Filtering")
        
        with gr.Column():
            filter_column = gr.Dropdown(
                choices=[],
                label="Filter Column"
            )
            
            filter_type = gr.Dropdown(
                choices=["Equal to", "Greater than", "Less than", "Contains"],
                value="Equal to",
                label="Filter Type"
            )
            
            filter_value = gr.Textbox(
                label="Filter Value",
                placeholder="Enter value to filter by"
            )
            
            filter_btn = gr.Button("Apply Filter", variant="secondary")
            
            # Filtered data output
            filtered_data = gr.Dataframe(
                label="Filtered Data",
                interactive=False,
                height=200
            )
    
    # Store column info
    column_info = gr.State({})
    
    # Event handlers
    upload_btn.click(
        dashboard.load_data,
        inputs=[file_input],
        outputs=[data_preview, data_summary, column_info]
    ).then(
        lambda info: (
            gr.update(choices=info.get("all_columns", [])),
            gr.update(choices=info.get("numeric_columns", [])),
            gr.update(choices=info.get("all_columns", [])),
            gr.update(choices=info.get("all_columns", [])),
            gr.update(choices=info.get("all_columns", []))
        ),
        inputs=[column_info],
        outputs=[x_column, y_column, color_column, analysis_column, filter_column]
    )
    
    create_chart_btn.click(
        dashboard.create_visualization,
        inputs=[chart_type, x_column, y_column, color_column],
        outputs=[chart_output]
    )
    
    analyze_btn.click(
        dashboard.statistical_analysis,
        inputs=[analysis_type, analysis_column],
        outputs=[analysis_output, gr.State()]
    )
    
    filter_btn.click(
        dashboard.filter_data,
        inputs=[filter_column, filter_type, filter_value],
        outputs=[filtered_data]
    )

if __name__ == "__main__":
    demo.launch(share=True, server_name="0.0.0.0")`,
        isTemplate: true,
        variables: ['projectName']
      },
      {
        path: 'requirements.txt',
        content: `gradio>=4.0.0
pandas>=2.0.0
plotly>=5.15.0
numpy>=1.24.0
openpyxl>=3.1.0`,
        isTemplate: false
      }
    ],
    dependencies: {
      'gradio': '>=4.0.0',
      'pandas': '>=2.0.0',
      'plotly': '>=5.15.0',
      'numpy': '>=1.24.0',
      'openpyxl': '>=3.1.0'
    },
    scripts: {
      'start': 'python app.py',
      'dev': 'gradio app.py',
      'install': 'pip install -r requirements.txt'
    },
    setupInstructions: [
      'Install Python 3.8 or higher',
      'Install dependencies: pip install -r requirements.txt',
      'Prepare your CSV or Excel data files',
      'Run the application: python app.py',
      'Upload your data and start exploring'
    ],
    aiPrompts: [
      {
        trigger: 'add machine learning',
        prompt: 'Add machine learning capabilities to this dashboard including predictive modeling and feature importance analysis',
        context: ['gradio', 'data-science', 'machine-learning']
      }
    ],
    estimatedTime: '4-5 hours',
    popular: false
  }
}

export const TEMPLATE_CATEGORIES = [
  'Web Application',
  'Backend API',
  'Mobile App',
  'Library',
  'Microservice',
  'Data Science',
  'AI/ML',
  'Blockchain',
  'Game Development',
  'Desktop App'
]

export const TEMPLATE_LANGUAGES = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Go',
  'Rust',
  'Java',
  'C#',
  'Swift',
  'Kotlin',
  'Dart'
]

export const TEMPLATE_FRAMEWORKS = [
  'Next.js',
  'React',
  'Vue.js',
  'Angular',
  'Svelte',
  'FastAPI',
  'Express.js',
  'Django',
  'Flask',
  'Spring Boot'
]

export function getTemplatesByCategory(category: string): ProjectTemplate[] {
  return Object.values(PROJECT_TEMPLATES).filter(template =>
    template.category === category
  )
}

export function getPopularTemplates(): ProjectTemplate[] {
  return Object.values(PROJECT_TEMPLATES).filter(template => template.popular)
}

export function searchTemplates(query: string): ProjectTemplate[] {
  const searchTerm = query.toLowerCase()
  return Object.values(PROJECT_TEMPLATES).filter(template =>
    template.name.toLowerCase().includes(searchTerm) ||
    template.description.toLowerCase().includes(searchTerm) ||
    template.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
    template.language.toLowerCase().includes(searchTerm) ||
    template.framework?.toLowerCase().includes(searchTerm)
  )
}
