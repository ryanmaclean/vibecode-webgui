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