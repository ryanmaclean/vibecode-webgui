/**
 * Production-ready project templates for VibeCode
 * Comprehensive collection of scaffolding templates for rapid development
 */

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'data' | 'infrastructure'
  tags: string[]
  language: string[]
  frameworks: string[]
  features: string[]
  complexity: 'beginner' | 'intermediate' | 'advanced'
  estimatedSetupTime: string
  files: TemplateFile[]
  dependencies: Record<string, string>
  devDependencies?: Record<string, string>
  scripts: Record<string, string>
  envVars: EnvVariable[]
  dockerSupport: boolean
  kubernetesSupport: boolean
  cicdTemplate: boolean
  testingSetup: boolean
  monitoringSetup: boolean
  thumbnail?: string
  documentation: {
    setup: string[]
    usage: string[]
    deployment: string[]
  }
}

export interface TemplateFile {
  path: string
  content: string
  type: 'file' | 'directory'
  executable?: boolean
}

export interface EnvVariable {
  name: string
  description: string
  required: boolean
  defaultValue?: string
  example?: string
}

// Template registry
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  // Frontend Templates
  {
    id: 'react-typescript-tailwind',
    name: 'React + TypeScript + Tailwind CSS',
    description: 'Modern React application with TypeScript, Tailwind CSS, and Vite',
    category: 'frontend',
    tags: ['react', 'typescript', 'tailwind', 'vite', 'modern'],
    language: ['typescript'],
    frameworks: ['react', 'vite'],
    features: ['TypeScript', 'Tailwind CSS', 'ESLint', 'Prettier', 'Hot Reload'],
    complexity: 'beginner',
    estimatedSetupTime: '5 minutes',
    files: [],
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      '@vitejs/plugin-react': '^4.0.0',
      'typescript': '^5.0.0',
      'vite': '^4.4.0',
      'tailwindcss': '^3.3.0',
      'autoprefixer': '^10.4.0',
      'postcss': '^8.4.0',
      'eslint': '^8.45.0',
      'prettier': '^3.0.0'
    },
    scripts: {
      'dev': 'vite',
      'build': 'tsc && vite build',
      'preview': 'vite preview',
      'lint': 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
      'format': 'prettier --write "src/**/*.{ts,tsx,js,jsx}"'
    },
    envVars: [
      {
        name: 'VITE_APP_TITLE',
        description: 'Application title',
        required: false,
        defaultValue: 'React App',
        example: 'My Awesome App'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: false,
    documentation: {
      setup: [
        'npm install',
        'npm run dev'
      ],
      usage: [
        'Edit src/App.tsx to start building your app',
        'Add components in src/components/',
        'Configure Tailwind in tailwind.config.js'
      ],
      deployment: [
        'npm run build',
        'Deploy dist/ directory to your hosting provider'
      ]
    }
  },

  {
    id: 'nextjs-app-router',
    name: 'Next.js 14 App Router',
    description: 'Next.js 14 with App Router, TypeScript, and Tailwind CSS',
    category: 'fullstack',
    tags: ['nextjs', 'react', 'typescript', 'app-router', 'ssr'],
    language: ['typescript'],
    frameworks: ['nextjs', 'react'],
    features: ['App Router', 'Server Components', 'TypeScript', 'Tailwind CSS', 'SEO'],
    complexity: 'intermediate',
    estimatedSetupTime: '10 minutes',
    files: [],
    dependencies: {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      'typescript': '^5.0.0',
      'tailwindcss': '^3.3.0',
      'autoprefixer': '^10.4.0',
      'postcss': '^8.4.0'
    },
    scripts: {
      'dev': 'next dev',
      'build': 'next build',
      'start': 'next start',
      'lint': 'next lint'
    },
    envVars: [
      {
        name: 'NEXT_PUBLIC_APP_URL',
        description: 'Public application URL',
        required: true,
        example: 'https://myapp.com'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'npm install',
        'npm run dev'
      ],
      usage: [
        'Create pages in app/ directory',
        'Add components in components/',
        'Configure API routes in app/api/'
      ],
      deployment: [
        'npm run build',
        'npm start or deploy to Vercel'
      ]
    }
  },

  {
    id: 'vue-composition-api',
    name: 'Vue 3 Composition API',
    description: 'Vue 3 with Composition API, TypeScript, and Vite',
    category: 'frontend',
    tags: ['vue', 'typescript', 'composition-api', 'vite'],
    language: ['typescript'],
    frameworks: ['vue', 'vite'],
    features: ['Vue 3', 'Composition API', 'TypeScript', 'Vite', 'Vue Router'],
    complexity: 'intermediate',
    estimatedSetupTime: '8 minutes',
    files: [],
    dependencies: {
      'vue': '^3.3.0',
      'vue-router': '^4.2.0',
    },
    devDependencies: {
      '@vitejs/plugin-vue': '^4.2.0',
      'typescript': '^5.0.0',
      'vite': '^4.4.0',
      'vue-tsc': '^1.8.0'
    },
    scripts: {
      'dev': 'vite',
      'build': 'vue-tsc && vite build',
      'preview': 'vite preview'
    },
    envVars: [],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: false,
    documentation: {
      setup: [
        'npm install',
        'npm run dev'
      ],
      usage: [
        'Edit src/App.vue to start building',
        'Add components in src/components/',
        'Configure routes in src/router/'
      ],
      deployment: [
        'npm run build',
        'Deploy dist/ directory'
      ]
    }
  },

  // Backend Templates
  {
    id: 'express-typescript-api',
    name: 'Express TypeScript API',
    description: 'RESTful API with Express, TypeScript, and MongoDB',
    category: 'backend',
    tags: ['express', 'typescript', 'api', 'mongodb', 'rest'],
    language: ['typescript'],
    frameworks: ['express'],
    features: ['RESTful API', 'TypeScript', 'MongoDB', 'JWT Auth', 'Validation'],
    complexity: 'intermediate',
    estimatedSetupTime: '15 minutes',
    files: [],
    dependencies: {
      'express': '^4.18.0',
      'mongoose': '^7.5.0',
      'jsonwebtoken': '^9.0.0',
      'bcryptjs': '^2.4.0',
      'joi': '^17.9.0',
      'cors': '^2.8.0',
      'helmet': '^7.0.0',
      'express-rate-limit': '^6.10.0'
    },
    devDependencies: {
      '@types/express': '^4.17.0',
      '@types/node': '^20.0.0',
      '@types/jsonwebtoken': '^9.0.0',
      '@types/bcryptjs': '^2.4.0',
      '@types/cors': '^2.8.0',
      'typescript': '^5.0.0',
      'ts-node': '^10.9.0',
      'nodemon': '^3.0.0',
      'jest': '^29.0.0',
      '@types/jest': '^29.0.0'
    },
    scripts: {
      'dev': 'nodemon src/server.ts',
      'build': 'tsc',
      'start': 'node dist/server.js',
      'test': 'jest',
      'test:watch': 'jest --watch'
    },
    envVars: [
      {
        name: 'PORT',
        description: 'Server port',
        required: false,
        defaultValue: '3000',
        example: '3000'
      },
      {
        name: 'MONGODB_URI',
        description: 'MongoDB connection string',
        required: true,
        example: 'mongodb://localhost:27017/myapp'
      },
      {
        name: 'JWT_SECRET',
        description: 'JWT signing secret',
        required: true,
        example: 'your-super-secret-jwt-key'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'npm install',
        'Copy .env.example to .env and configure',
        'Start MongoDB locally or use MongoDB Atlas',
        'npm run dev'
      ],
      usage: [
        'API endpoints available at /api/',
        'Authentication at /api/auth/',
        'Add routes in src/routes/'
      ],
      deployment: [
        'npm run build',
        'Set environment variables',
        'npm start'
      ]
    }
  },

  {
    id: 'fastapi-python',
    name: 'FastAPI Python',
    description: 'Modern Python API with FastAPI, SQLAlchemy, and PostgreSQL',
    category: 'backend',
    tags: ['python', 'fastapi', 'postgresql', 'sqlalchemy', 'async'],
    language: ['python'],
    frameworks: ['fastapi'],
    features: ['FastAPI', 'Async/Await', 'PostgreSQL', 'SQLAlchemy', 'Pydantic'],
    complexity: 'advanced',
    estimatedSetupTime: '20 minutes',
    files: [],
    dependencies: {
      'fastapi': '^0.103.0',
      'uvicorn': '^0.23.0',
      'sqlalchemy': '^2.0.0',
      'alembic': '^1.12.0',
      'psycopg2-binary': '^2.9.0',
      'pydantic': '^2.3.0',
      'python-jose': '^3.3.0',
      'passlib': '^1.7.0',
      'python-multipart': '^0.0.6'
    },
    scripts: {
      'dev': 'uvicorn main:app --reload',
      'start': 'uvicorn main:app --host 0.0.0.0 --port 8000',
      'migrate': 'alembic upgrade head',
      'test': 'pytest'
    },
    envVars: [
      {
        name: 'DATABASE_URL',
        description: 'PostgreSQL database URL',
        required: true,
        example: 'postgresql://user:password@localhost/dbname'
      },
      {
        name: 'SECRET_KEY',
        description: 'Application secret key',
        required: true,
        example: 'your-secret-key-here'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'pip install -r requirements.txt',
        'Copy .env.example to .env',
        'Configure PostgreSQL database',
        'alembic upgrade head',
        'uvicorn main:app --reload'
      ],
      usage: [
        'API documentation at /docs',
        'Add models in models/',
        'Add routes in routers/'
      ],
      deployment: [
        'Build Docker image',
        'Deploy to cloud provider'
      ]
    }
  },

  // Full-stack Templates
  {
    id: 'mern-stack',
    name: 'MERN Stack',
    description: 'MongoDB, Express, React, Node.js full-stack application',
    category: 'fullstack',
    tags: ['mern', 'mongodb', 'express', 'react', 'nodejs'],
    language: ['javascript', 'typescript'],
    frameworks: ['react', 'express', 'mongodb'],
    features: ['Full-stack', 'Authentication', 'REST API', 'Modern UI'],
    complexity: 'advanced',
    estimatedSetupTime: '30 minutes',
    files: [],
    dependencies: {
      'express': '^4.18.0',
      'mongoose': '^7.5.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    },
    scripts: {
      'dev': 'concurrently "npm run server" "npm run client"',
      'server': 'cd server && npm run dev',
      'client': 'cd client && npm start',
      'build': 'cd client && npm run build'
    },
    envVars: [
      {
        name: 'MONGODB_URI',
        description: 'MongoDB connection string',
        required: true,
        example: 'mongodb://localhost:27017/mernapp'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'npm install in root, client, and server directories',
        'Configure MongoDB',
        'npm run dev'
      ],
      usage: [
        'Frontend: React application in client/',
        'Backend: Express API in server/',
        'Shared types in shared/'
      ],
      deployment: [
        'Build client application',
        'Deploy server and client separately'
      ]
    }
  },

  {
    id: 'nextjs-supabase',
    name: 'Next.js + Supabase',
    description: 'Next.js with Supabase backend, authentication, and real-time features',
    category: 'fullstack',
    tags: ['nextjs', 'supabase', 'auth', 'realtime', 'postgresql'],
    language: ['typescript'],
    frameworks: ['nextjs', 'supabase'],
    features: ['Authentication', 'Real-time', 'PostgreSQL', 'Serverless'],
    complexity: 'intermediate',
    estimatedSetupTime: '25 minutes',
    files: [],
    dependencies: {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      '@supabase/supabase-js': '^2.38.0',
      '@supabase/auth-helpers-nextjs': '^0.8.0'
    },
    scripts: {
      'dev': 'next dev',
      'build': 'next build',
      'start': 'next start'
    },
    envVars: [
      {
        name: 'NEXT_PUBLIC_SUPABASE_URL',
        description: 'Supabase project URL',
        required: true,
        example: 'https://your-project.supabase.co'
      },
      {
        name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        description: 'Supabase anonymous key',
        required: true,
        example: 'your-anon-key'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'Create Supabase project',
        'npm install',
        'Configure environment variables',
        'npm run dev'
      ],
      usage: [
        'Authentication built-in',
        'Database queries in lib/supabase',
        'Real-time subscriptions available'
      ],
      deployment: [
        'Deploy to Vercel',
        'Configure production environment'
      ]
    }
  },

  // Mobile Templates
  {
    id: 'react-native-expo',
    name: 'React Native with Expo',
    description: 'Cross-platform mobile app with React Native and Expo',
    category: 'mobile',
    tags: ['react-native', 'expo', 'mobile', 'cross-platform'],
    language: ['typescript'],
    frameworks: ['react-native', 'expo'],
    features: ['Cross-platform', 'Native APIs', 'Hot Reload', 'OTA Updates'],
    complexity: 'intermediate',
    estimatedSetupTime: '15 minutes',
    files: [],
    dependencies: {
      'expo': '^49.0.0',
      'react': '^18.2.0',
      'react-native': '^0.72.0',
      '@expo/vector-icons': '^13.0.0',
      'expo-status-bar': '^1.6.0'
    },
    scripts: {
      'start': 'expo start',
      'android': 'expo start --android',
      'ios': 'expo start --ios',
      'web': 'expo start --web'
    },
    envVars: [],
    dockerSupport: false,
    kubernetesSupport: false,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: false,
    documentation: {
      setup: [
        'npm install',
        'Install Expo CLI globally',
        'npx expo start'
      ],
      usage: [
        'Scan QR code with Expo Go app',
        'Develop in App.tsx',
        'Add screens in screens/'
      ],
      deployment: [
        'expo build',
        'Submit to app stores'
      ]
    }
  },

  // Data & Analytics Templates
  {
    id: 'python-data-science',
    name: 'Python Data Science',
    description: 'Data science project with Jupyter, pandas, and visualization tools',
    category: 'data',
    tags: ['python', 'data-science', 'jupyter', 'pandas', 'visualization'],
    language: ['python'],
    frameworks: ['jupyter'],
    features: ['Jupyter Notebooks', 'Data Analysis', 'Visualization', 'ML Ready'],
    complexity: 'intermediate',
    estimatedSetupTime: '10 minutes',
    files: [],
    dependencies: {
      'pandas': '^2.1.0',
      'numpy': '^1.24.0',
      'matplotlib': '^3.7.0',
      'seaborn': '^0.12.0',
      'jupyter': '^1.0.0',
      'scikit-learn': '^1.3.0',
      'plotly': '^5.15.0'
    },
    scripts: {
      'notebook': 'jupyter notebook',
      'lab': 'jupyter lab'
    },
    envVars: [],
    dockerSupport: true,
    kubernetesSupport: false,
    cicdTemplate: false,
    testingSetup: true,
    monitoringSetup: false,
    documentation: {
      setup: [
        'pip install -r requirements.txt',
        'jupyter notebook'
      ],
      usage: [
        'Open notebooks/ directory',
        'Start with data_exploration.ipynb',
        'Add datasets to data/'
      ],
      deployment: [
        'Export notebooks to scripts',
        'Deploy as containerized service'
      ]
    }
  },

  // Infrastructure Templates
  {
    id: 'docker-microservices',
    name: 'Docker Microservices',
    description: 'Microservices architecture with Docker, API Gateway, and service discovery',
    category: 'infrastructure',
    tags: ['docker', 'microservices', 'kubernetes', 'nginx'],
    language: ['javascript', 'typescript'],
    frameworks: ['express', 'docker'],
    features: ['Microservices', 'Docker', 'API Gateway', 'Service Discovery'],
    complexity: 'advanced',
    estimatedSetupTime: '45 minutes',
    files: [],
    dependencies: {},
    scripts: {
      'dev': 'docker-compose up --build',
      'start': 'docker-compose up',
      'down': 'docker-compose down'
    },
    envVars: [
      {
        name: 'COMPOSE_PROJECT_NAME',
        description: 'Docker Compose project name',
        required: false,
        defaultValue: 'microservices',
        example: 'myapp'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'docker-compose up --build',
        'Services available on different ports'
      ],
      usage: [
        'API Gateway: http://localhost:8080',
        'Add services in services/',
        'Configure routing in gateway/'
      ],
      deployment: [
        'Deploy to Kubernetes',
        'Configure ingress and services'
      ]
    }
  },

  // Specialized Templates
  {
    id: 'electron-desktop',
    name: 'Electron Desktop App',
    description: 'Cross-platform desktop application with Electron and React',
    category: 'frontend',
    tags: ['electron', 'desktop', 'react', 'cross-platform'],
    language: ['typescript'],
    frameworks: ['electron', 'react'],
    features: ['Desktop App', 'Cross-platform', 'Native Menus', 'System Tray'],
    complexity: 'advanced',
    estimatedSetupTime: '20 minutes',
    files: [],
    dependencies: {
      'electron': '^26.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      'electron-builder': '^24.6.0',
      '@types/electron': '^1.6.0'
    },
    scripts: {
      'electron': 'electron .',
      'electron-dev': 'electron . --dev',
      'build': 'electron-builder',
      'dist': 'npm run build && electron-builder --publish=never'
    },
    envVars: [],
    dockerSupport: false,
    kubernetesSupport: false,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: false,
    documentation: {
      setup: [
        'npm install',
        'npm run electron-dev'
      ],
      usage: [
        'Edit src/renderer for UI',
        'Edit src/main for Electron main process',
        'Add native features in main process'
      ],
      deployment: [
        'npm run dist',
        'Distribute executables'
      ]
    }
  },

  {
    id: 'graphql-api',
    name: 'GraphQL API',
    description: 'GraphQL API with Apollo Server, TypeScript, and PostgreSQL',
    category: 'backend',
    tags: ['graphql', 'apollo', 'typescript', 'postgresql'],
    language: ['typescript'],
    frameworks: ['apollo-server'],
    features: ['GraphQL', 'Type Safety', 'Real-time', 'Database Integration'],
    complexity: 'advanced',
    estimatedSetupTime: '25 minutes',
    files: [],
    dependencies: {
      'apollo-server-express': '^3.12.0',
      'graphql': '^16.8.0',
      'express': '^4.18.0',
      'typeorm': '^0.3.17',
      'pg': '^8.11.0',
      'type-graphql': '^1.1.1'
    },
    devDependencies: {
      '@types/express': '^4.17.0',
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0'
    },
    scripts: {
      'dev': 'ts-node src/server.ts',
      'build': 'tsc',
      'start': 'node dist/server.js'
    },
    envVars: [
      {
        name: 'DATABASE_URL',
        description: 'PostgreSQL connection string',
        required: true,
        example: 'postgresql://user:password@localhost:5432/graphql_db'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'npm install',
        'Configure PostgreSQL',
        'npm run dev'
      ],
      usage: [
        'GraphQL Playground at /graphql',
        'Add resolvers in resolvers/',
        'Define entities in entities/'
      ],
      deployment: [
        'npm run build',
        'Deploy with environment variables'
      ]
    }
  },

  {
    id: 'flutter-app',
    name: 'Flutter Mobile App',
    description: 'Cross-platform mobile app with Flutter and Dart',
    category: 'mobile',
    tags: ['flutter', 'dart', 'mobile', 'cross-platform'],
    language: ['dart'],
    frameworks: ['flutter'],
    features: ['Cross-platform', 'Native Performance', 'Hot Reload', 'Material Design'],
    complexity: 'intermediate',
    estimatedSetupTime: '15 minutes',
    files: [],
    dependencies: {},
    scripts: {
      'run': 'flutter run',
      'build:android': 'flutter build apk',
      'build:ios': 'flutter build ios',
      'test': 'flutter test'
    },
    envVars: [],
    dockerSupport: false,
    kubernetesSupport: false,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: false,
    documentation: {
      setup: [
        'Install Flutter SDK',
        'flutter pub get',
        'flutter run'
      ],
      usage: [
        'Edit lib/main.dart',
        'Add screens in lib/screens/',
        'Add widgets in lib/widgets/'
      ],
      deployment: [
        'flutter build apk/ios',
        'Submit to app stores'
      ]
    }
  },

  {
    id: 'serverless-functions',
    name: 'Serverless Functions',
    description: 'Serverless functions with AWS Lambda, API Gateway, and DynamoDB',
    category: 'backend',
    tags: ['serverless', 'aws', 'lambda', 'dynamodb'],
    language: ['typescript'],
    frameworks: ['serverless'],
    features: ['Serverless', 'AWS Lambda', 'DynamoDB', 'API Gateway'],
    complexity: 'advanced',
    estimatedSetupTime: '30 minutes',
    files: [],
    dependencies: {
      'aws-lambda': '^1.0.0',
      'aws-sdk': '^2.1460.0'
    },
    devDependencies: {
      'serverless': '^3.34.0',
      'serverless-webpack': '^5.11.0',
      'webpack': '^5.88.0',
      'typescript': '^5.0.0'
    },
    scripts: {
      'deploy': 'serverless deploy',
      'invoke': 'serverless invoke -f hello',
      'logs': 'serverless logs -f hello'
    },
    envVars: [
      {
        name: 'AWS_REGION',
        description: 'AWS region',
        required: true,
        example: 'us-east-1'
      }
    ],
    dockerSupport: false,
    kubernetesSupport: false,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'Configure AWS credentials',
        'npm install',
        'serverless deploy'
      ],
      usage: [
        'Add functions in src/handlers/',
        'Configure in serverless.yml',
        'Deploy with serverless deploy'
      ],
      deployment: [
        'Automated via Serverless Framework',
        'Monitor in AWS Console'
      ]
    }
  },

  // AI/ML Templates
  {
    id: 'pytorch-ml-project',
    name: 'PyTorch ML Project',
    description: 'Complete machine learning project with PyTorch, MLflow, and experiment tracking',
    category: 'data',
    tags: ['pytorch', 'machine-learning', 'deep-learning', 'mlflow', 'jupyter'],
    language: ['python'],
    frameworks: ['pytorch', 'mlflow'],
    features: ['Deep Learning', 'Experiment Tracking', 'Model Registry', 'Jupyter Integration', 'GPU Support'],
    complexity: 'advanced',
    estimatedSetupTime: '25 minutes',
    files: [],
    dependencies: {
      'torch': '^2.1.0',
      'torchvision': '^0.16.0',
      'mlflow': '^2.8.0',
      'numpy': '^1.24.0',
      'pandas': '^2.1.0',
      'scikit-learn': '^1.3.0',
      'matplotlib': '^3.7.0',
      'seaborn': '^0.12.0',
      'jupyter': '^1.0.0',
      'tensorboard': '^2.15.0',
      'wandb': '^0.16.0'
    },
    scripts: {
      'train': 'python src/train.py',
      'evaluate': 'python src/evaluate.py',
      'serve': 'mlflow models serve -m models:/best_model/production',
      'notebook': 'jupyter notebook',
      'tensorboard': 'tensorboard --logdir=runs'
    },
    envVars: [
      {
        name: 'CUDA_VISIBLE_DEVICES',
        description: 'GPU device IDs to use',
        required: false,
        defaultValue: '0',
        example: '0,1'
      },
      {
        name: 'WANDB_API_KEY',
        description: 'Weights & Biases API key for experiment tracking',
        required: false,
        example: 'your-wandb-key'
      },
      {
        name: 'MLFLOW_TRACKING_URI',
        description: 'MLflow tracking server URI',
        required: false,
        defaultValue: 'http://localhost:5000',
        example: 'https://your-mlflow-server.com'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'pip install -r requirements.txt',
        'python -m src.data.download_data',
        'mlflow server --host 0.0.0.0 --port 5000',
        'jupyter notebook'
      ],
      usage: [
        'Prepare data in data/raw/',
        'Configure experiments in config/',
        'Train models with python src/train.py',
        'Track experiments in MLflow UI'
      ],
      deployment: [
        'Register best model in MLflow',
        'Deploy with mlflow models serve',
        'Use Docker for production deployment'
      ]
    }
  },

  {
    id: 'langchain-rag-app',
    name: 'LangChain RAG Application',
    description: 'Retrieval-Augmented Generation app with LangChain, vector database, and LLM integration',
    category: 'data',
    tags: ['langchain', 'rag', 'llm', 'vector-database', 'ai', 'chatbot'],
    language: ['python'],
    frameworks: ['langchain', 'fastapi'],
    features: ['RAG Pipeline', 'Vector Search', 'LLM Integration', 'Document Processing', 'Chat Interface'],
    complexity: 'advanced',
    estimatedSetupTime: '30 minutes',
    files: [],
    dependencies: {
      'langchain': '^0.0.350',
      'langchain-community': '^0.0.4',
      'langchain-openai': '^0.0.2',
      'fastapi': '^0.105.0',
      'uvicorn': '^0.24.0',
      'chromadb': '^0.4.18',
      'sentence-transformers': '^2.2.2',
      'pypdf2': '^3.0.1',
      'python-multipart': '^0.0.6',
      'streamlit': '^1.28.0',
      'openai': '^1.3.0',
      'tiktoken': '^0.5.1'
    },
    scripts: {
      'dev': 'uvicorn main:app --reload',
      'start': 'uvicorn main:app --host 0.0.0.0 --port 8000',
      'streamlit': 'streamlit run streamlit_app.py',
      'ingest': 'python scripts/ingest_documents.py',
      'test': 'pytest'
    },
    envVars: [
      {
        name: 'OPENAI_API_KEY',
        description: 'OpenAI API key for LLM integration',
        required: true,
        example: 'sk-...'
      },
      {
        name: 'CHROMA_DB_PATH',
        description: 'Path to ChromaDB vector database',
        required: false,
        defaultValue: './chroma_db',
        example: './data/vectordb'
      },
      {
        name: 'EMBEDDING_MODEL',
        description: 'Sentence transformer model for embeddings',
        required: false,
        defaultValue: 'all-MiniLM-L6-v2',
        example: 'all-mpnet-base-v2'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'pip install -r requirements.txt',
        'python scripts/ingest_documents.py',
        'uvicorn main:app --reload'
      ],
      usage: [
        'Add documents to data/documents/',
        'Run ingestion to create embeddings',
        'Query via API or Streamlit interface',
        'Monitor performance with built-in metrics'
      ],
      deployment: [
        'Build Docker image',
        'Deploy to cloud with persistent vector storage',
        'Set up monitoring and logging'
      ]
    }
  },

  {
    id: 'tensorflow-computer-vision',
    name: 'TensorFlow Computer Vision',
    description: 'Computer vision project with TensorFlow, object detection, and model serving',
    category: 'data',
    tags: ['tensorflow', 'computer-vision', 'object-detection', 'image-classification', 'ai'],
    language: ['python'],
    frameworks: ['tensorflow', 'keras'],
    features: ['Image Classification', 'Object Detection', 'Model Serving', 'Data Augmentation', 'Transfer Learning'],
    complexity: 'advanced',
    estimatedSetupTime: '35 minutes',
    files: [],
    dependencies: {
      'tensorflow': '^2.15.0',
      'opencv-python': '^4.8.0',
      'pillow': '^11.3.0',
      'numpy': '^1.24.0',
      'matplotlib': '^3.7.0',
      'scikit-learn': '^1.3.0',
      'tensorflow-serving-api': '^2.15.0',
      'gradio': '^4.7.0',
      'albumentations': '^1.3.0'
    },
    scripts: {
      'train': 'python src/train.py',
      'evaluate': 'python src/evaluate.py',
      'predict': 'python src/predict.py',
      'serve': 'tensorflow_model_server --model_base_path=./models --rest_api_port=8501',
      'gradio': 'python app.py'
    },
    envVars: [
      {
        name: 'CUDA_VISIBLE_DEVICES',
        description: 'GPU device IDs to use',
        required: false,
        defaultValue: '0',
        example: '0,1'
      },
      {
        name: 'MODEL_SERVING_PORT',
        description: 'Port for TensorFlow Serving',
        required: false,
        defaultValue: '8501',
        example: '8501'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'pip install -r requirements.txt',
        'python src/data/prepare_data.py',
        'python src/train.py'
      ],
      usage: [
        'Prepare images in data/raw/',
        'Train models with different architectures',
        'Evaluate on test set',
        'Deploy with TensorFlow Serving'
      ],
      deployment: [
        'Export model to SavedModel format',
        'Deploy with TensorFlow Serving',
        'Create inference API endpoint'
      ]
    }
  },

  // Advanced Enterprise Templates
  {
    id: 'enterprise-saas-platform',
    name: 'Enterprise SaaS Platform',
    description: 'Multi-tenant SaaS platform with authentication, billing, and admin dashboard',
    category: 'fullstack',
    tags: ['saas', 'multi-tenant', 'stripe', 'auth', 'dashboard', 'enterprise'],
    language: ['typescript'],
    frameworks: ['nextjs', 'prisma', 'stripe'],
    features: ['Multi-tenancy', 'Stripe Integration', 'Role-based Access', 'Admin Dashboard', 'Usage Analytics'],
    complexity: 'advanced',
    estimatedSetupTime: '45 minutes',
    files: [],
    dependencies: {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'next-auth': '^4.24.0',
      '@prisma/client': '^5.6.0',
      'stripe': '^14.5.0',
      '@stripe/stripe-js': '^2.1.0',
      'recharts': '^2.8.0',
      '@headlessui/react': '^1.7.0',
      '@heroicons/react': '^2.0.0',
      'react-hook-form': '^7.48.0',
      'zod': '^3.22.0'
    },
    devDependencies: {
      'prisma': '^5.6.0',
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0',
      'tailwindcss': '^3.3.0'
    },
    scripts: {
      'dev': 'next dev',
      'build': 'next build',
      'start': 'next start',
      'db:generate': 'prisma generate',
      'db:push': 'prisma db push',
      'db:migrate': 'prisma migrate dev',
      'db:seed': 'tsx prisma/seed.ts'
    },
    envVars: [
      {
        name: 'DATABASE_URL',
        description: 'PostgreSQL database connection string',
        required: true,
        example: 'postgresql://user:password@localhost:5432/saas_db'
      },
      {
        name: 'NEXTAUTH_SECRET',
        description: 'NextAuth.js secret for JWT signing',
        required: true,
        example: 'your-nextauth-secret'
      },
      {
        name: 'STRIPE_SECRET_KEY',
        description: 'Stripe secret key for payments',
        required: true,
        example: 'sk_test_...'
      },
      {
        name: 'STRIPE_WEBHOOK_SECRET',
        description: 'Stripe webhook secret for event verification',
        required: true,
        example: 'whsec_...'
      },
      {
        name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
        description: 'Stripe publishable key',
        required: true,
        example: 'pk_test_...'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'npm install',
        'Copy .env.example to .env.local',
        'Set up PostgreSQL database',
        'Configure Stripe account',
        'npx prisma generate',
        'npx prisma db push',
        'npm run dev'
      ],
      usage: [
        'Multi-tenant architecture with organization isolation',
        'Stripe subscription and billing management',
        'Role-based access control',
        'Admin dashboard for user management',
        'Usage analytics and reporting'
      ],
      deployment: [
        'Deploy to Vercel or similar platform',
        'Set up production database',
        'Configure Stripe webhooks',
        'Set up monitoring and logging'
      ]
    }
  },

  {
    id: 'ai-chatbot-platform',
    name: 'AI Chatbot Platform',
    description: 'Intelligent chatbot platform with multiple AI models, conversation management, and analytics',
    category: 'fullstack',
    tags: ['ai', 'chatbot', 'openai', 'anthropic', 'conversation', 'analytics'],
    language: ['typescript'],
    frameworks: ['nextjs', 'openai', 'anthropic'],
    features: ['Multi-Model Support', 'Conversation History', 'Analytics Dashboard', 'Custom Training', 'API Integration'],
    complexity: 'advanced',
    estimatedSetupTime: '35 minutes',
    files: [],
    dependencies: {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'openai': '^4.20.0',
      '@anthropic-ai/sdk': '^0.9.0',
      'langchain': '^0.0.208',
      'pinecone-client': '^1.1.0',
      '@supabase/supabase-js': '^2.38.0',
      'react-markdown': '^9.0.0',
      'react-syntax-highlighter': '^15.5.0',
      'framer-motion': '^10.16.0',
      'recharts': '^2.8.0'
    },
    scripts: {
      'dev': 'next dev',
      'build': 'next build',
      'start': 'next start',
      'train': 'node scripts/train-model.js',
      'analytics': 'node scripts/generate-analytics.js'
    },
    envVars: [
      {
        name: 'OPENAI_API_KEY',
        description: 'OpenAI API key',
        required: true,
        example: 'sk-...'
      },
      {
        name: 'ANTHROPIC_API_KEY',
        description: 'Anthropic Claude API key',
        required: false,
        example: 'sk-ant-...'
      },
      {
        name: 'PINECONE_API_KEY',
        description: 'Pinecone vector database API key',
        required: false,
        example: 'your-pinecone-key'
      },
      {
        name: 'SUPABASE_URL',
        description: 'Supabase project URL',
        required: true,
        example: 'https://your-project.supabase.co'
      },
      {
        name: 'SUPABASE_ANON_KEY',
        description: 'Supabase anonymous key',
        required: true,
        example: 'your-supabase-key'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'npm install',
        'Set up Supabase project',
        'Configure AI API keys',
        'Run database migrations',
        'npm run dev'
      ],
      usage: [
        'Create custom chatbots',
        'Train on custom datasets',
        'Monitor conversation analytics',
        'Integrate with external APIs',
        'Manage user interactions'
      ],
      deployment: [
        'Deploy to Vercel',
        'Set up vector database',
        'Configure monitoring',
        'Scale based on usage'
      ]
    }
  },

  {
    id: 'realtime-collaboration-app',
    name: 'Real-time Collaboration App',
    description: 'Real-time collaborative application with WebRTC, websockets, and shared state management',
    category: 'fullstack',
    tags: ['realtime', 'collaboration', 'webrtc', 'websocket', 'yjs', 'multiplayer'],
    language: ['typescript'],
    frameworks: ['nextjs', 'socket.io', 'yjs'],
    features: ['Real-time Sync', 'Video/Audio Calls', 'Shared Cursors', 'Document Editing', 'Presence Awareness'],
    complexity: 'advanced',
    estimatedSetupTime: '40 minutes',
    files: [],
    dependencies: {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'socket.io': '^4.7.0',
      'socket.io-client': '^4.7.0',
      'yjs': '^13.6.0',
      'y-socket.io': '^1.0.0',
      'y-prosemirror': '^1.2.0',
      'prosemirror-state': '^1.4.0',
      'prosemirror-view': '^1.32.0',
      'simple-peer': '^9.11.0',
      'zustand': '^4.4.0'
    },
    scripts: {
      'dev': 'concurrently "npm run dev:next" "npm run dev:server"',
      'dev:next': 'next dev',
      'dev:server': 'node server/index.js',
      'build': 'next build',
      'start': 'npm run start:server',
      'start:server': 'node server/index.js'
    },
    envVars: [
      {
        name: 'SOCKET_PORT',
        description: 'Socket.io server port',
        required: false,
        defaultValue: '3001',
        example: '3001'
      },
      {
        name: 'REDIS_URL',
        description: 'Redis URL for session storage',
        required: false,
        example: 'redis://localhost:6379'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'npm install',
        'Start Redis (optional for scaling)',
        'npm run dev',
        'Access app at http://localhost:3000'
      ],
      usage: [
        'Real-time document collaboration',
        'Video/audio conferencing',
        'Shared whiteboard and drawing',
        'Presence indicators',
        'Conflict-free editing'
      ],
      deployment: [
        'Deploy to cloud with WebSocket support',
        'Configure Redis for scaling',
        'Set up TURN servers for WebRTC',
        'Monitor connection health'
      ]
    }
  },

  // Specialized IoT Template
  {
    id: 'iot-edge-computing',
    name: 'IoT Edge Computing Platform',
    description: 'Edge computing platform with device management, real-time data processing, and ML inference',
    category: 'infrastructure',
    tags: ['iot', 'edge-computing', 'mqtt', 'kubernetes', 'microservices', 'ml'],
    language: ['python', 'javascript', 'go'],
    frameworks: ['kubernetes', 'mqtt', 'redis'],
    features: ['Device Management', 'Real-time Processing', 'Edge ML', 'MQTT Broker', 'Time Series DB'],
    complexity: 'advanced',
    estimatedSetupTime: '45 minutes',
    files: [],
    dependencies: {
      'paho-mqtt': '^1.6.0',
      'redis': '^5.0.0',
      'influxdb-client': '^1.33.0',
      'fastapi': '^0.105.0',
      'websockets': '^12.0.0',
      'numpy': '^1.24.0',
      'tensorflow-lite': '^2.15.0'
    },
    scripts: {
      'start:broker': 'docker run -p 1883:1883 -p 9001:9001 eclipse-mosquitto',
      'start:redis': 'docker run -p 6379:6379 redis:alpine',
      'start:influx': 'docker run -p 8086:8086 influxdb:2.0',
      'start:api': 'uvicorn main:app --reload',
      'deploy': 'kubectl apply -f k8s/',
      'dev': 'docker-compose up'
    },
    envVars: [
      {
        name: 'MQTT_BROKER_HOST',
        description: 'MQTT broker hostname',
        required: true,
        defaultValue: 'localhost',
        example: 'mqtt.example.com'
      },
      {
        name: 'REDIS_URL',
        description: 'Redis connection URL',
        required: true,
        defaultValue: 'redis://localhost:6379',
        example: 'redis://redis:6379'
      },
      {
        name: 'INFLUXDB_TOKEN',
        description: 'InfluxDB authentication token',
        required: true,
        example: 'your-influxdb-token'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'pip install -r requirements.txt',
        'docker-compose up -d',
        'python scripts/setup_influxdb.py',
        'uvicorn main:app --reload'
      ],
      usage: [
        'Register IoT devices',
        'Configure data pipelines',
        'Deploy ML models to edge',
        'Monitor device health'
      ],
      deployment: [
        'Deploy to Kubernetes cluster',
        'Configure edge nodes',
        'Set up monitoring and alerting',
        'Scale based on device load'
      ]
    }
  },

  // Advanced DevOps Template
  {
    id: 'observability-platform',
    name: 'Observability Platform',
    description: 'Complete observability stack with metrics, logs, traces, and alerting',
    category: 'infrastructure',
    tags: ['observability', 'monitoring', 'prometheus', 'grafana', 'jaeger', 'elasticsearch'],
    language: ['yaml', 'go', 'python'],
    frameworks: ['kubernetes', 'prometheus', 'grafana'],
    features: ['Metrics Collection', 'Log Aggregation', 'Distributed Tracing', 'Alerting', 'Dashboards'],
    complexity: 'advanced',
    estimatedSetupTime: '40 minutes',
    files: [],
    dependencies: {},
    scripts: {
      'deploy': 'kubectl apply -f manifests/',
      'port-forward': 'kubectl port-forward svc/grafana 3000:3000',
      'logs': 'kubectl logs -f deployment/observability-agent',
      'test': 'python tests/test_monitoring.py'
    },
    envVars: [
      {
        name: 'GRAFANA_ADMIN_PASSWORD',
        description: 'Grafana admin password',
        required: true,
        example: 'your-secure-password'
      },
      {
        name: 'SLACK_WEBHOOK_URL',
        description: 'Slack webhook for alerts',
        required: false,
        example: 'https://hooks.slack.com/services/...'
      },
      {
        name: 'ELASTICSEARCH_PASSWORD',
        description: 'Elasticsearch admin password',
        required: true,
        example: 'your-elastic-password'
      }
    ],
    dockerSupport: true,
    kubernetesSupport: true,
    cicdTemplate: true,
    testingSetup: true,
    monitoringSetup: true,
    documentation: {
      setup: [
        'kubectl create namespace observability',
        'kubectl apply -f manifests/',
        'kubectl port-forward svc/grafana 3000:3000',
        'Access Grafana at http://localhost:3000'
      ],
      usage: [
        'Import pre-built dashboards',
        'Configure alert rules',
        'Set up log parsing',
        'Monitor application metrics'
      ],
      deployment: [
        'Deploy to production cluster',
        'Configure persistent storage',
        'Set up external alerting',
        'Configure backup strategy'
      ]
    }
  }
]

export function getTemplateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find(template => template.id === id)
}

export function getTemplatesByCategory(category: ProjectTemplate['category']): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter(template => template.category === category)
}

export function getTemplatesByComplexity(complexity: ProjectTemplate['complexity']): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter(template => template.complexity === complexity)
}

export function searchTemplates(query: string): ProjectTemplate[] {
  const searchTerm = query.toLowerCase()
  return PROJECT_TEMPLATES.filter(template => 
    template.name.toLowerCase().includes(searchTerm) ||
    template.description.toLowerCase().includes(searchTerm) ||
    template.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
    template.language.some(lang => lang.toLowerCase().includes(searchTerm)) ||
    template.frameworks.some(framework => framework.toLowerCase().includes(searchTerm))
  )
}

export function getTemplateCategories(): string[] {
  return Array.from(new Set(PROJECT_TEMPLATES.map(template => template.category)))
}

export function getTemplateLanguages(): string[] {
  return Array.from(new Set(PROJECT_TEMPLATES.flatMap(template => template.language)))
}

export function getTemplateFrameworks(): string[] {
  return Array.from(new Set(PROJECT_TEMPLATES.flatMap(template => template.frameworks)))
}