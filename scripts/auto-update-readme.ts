#!/usr/bin/env npx tsx

/**
 * Automated README Generator and Updater
 * Keeps README.md synchronized with package.json and project structure
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

interface ProjectStructure {
  directories: string[];
  apiRoutes: string[];
  components: string[];
  services: string[];
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
}

class ReadmeUpdater {
  private projectRoot = process.cwd();
  private packageJson: any;
  private structure: ProjectStructure = {
    directories: [],
    apiRoutes: [],
    components: [],
    services: [],
    scripts: {},
    dependencies: [],
    devDependencies: []
  };

  async update() {
    console.log('📝 Updating README.md...');
    
    await this.loadPackageJson();
    await this.analyzeProjectStructure();
    await this.generateReadme();
    
    console.log('✅ README.md updated successfully');
  }

  private async loadPackageJson() {
    try {
      const content = await fs.readFile(
        path.join(this.projectRoot, 'package.json'),
        'utf-8'
      );
      this.packageJson = JSON.parse(content);
    } catch (error) {
      throw new Error('Failed to load package.json');
    }
  }

  private async analyzeProjectStructure() {
    // Get major directories
    this.structure.directories = await this.getMajorDirectories();
    
    // Get API routes
    this.structure.apiRoutes = await this.getApiRoutes();
    
    // Get components
    this.structure.components = await this.getComponents();
    
    // Get services
    this.structure.services = await this.getServices();
    
    // Get scripts
    this.structure.scripts = this.packageJson.scripts || {};
    
    // Get dependencies
    this.structure.dependencies = Object.keys(this.packageJson.dependencies || {});
    this.structure.devDependencies = Object.keys(this.packageJson.devDependencies || {});
  }

  private async getMajorDirectories(): Promise<string[]> {
    const ignoreDirs = ['node_modules', 'dist', 'build', '.git', '.next'];
    const dirs: string[] = [];

    try {
      const items = await fs.readdir(this.projectRoot, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory() && !ignoreDirs.includes(item.name) && !item.name.startsWith('.')) {
          dirs.push(item.name);
        }
      }
    } catch (error) {
      console.warn('Failed to read project directories');
    }

    return dirs.sort();
  }

  private async getApiRoutes(): Promise<string[]> {
    const routes = await glob('src/app/api/**/route.{ts,tsx}', {
      cwd: this.projectRoot
    });

    return routes.map(route => {
      return route
        .replace('src/app/api', '/api')
        .replace('/route.ts', '')
        .replace('/route.tsx', '');
    }).sort();
  }

  private async getComponents(): Promise<string[]> {
    const components = await glob('src/components/**/*.{ts,tsx}', {
      cwd: this.projectRoot
    });

    return components
      .map(comp => path.basename(comp, path.extname(comp)))
      .filter((comp, index, arr) => arr.indexOf(comp) === index)
      .sort();
  }

  private async getServices(): Promise<string[]> {
    const services = await glob('src/lib/**/*.{ts,tsx}', {
      cwd: this.projectRoot
    });

    return services
      .map(service => {
        const relativePath = service.replace('src/lib/', '');
        return path.dirname(relativePath) === '.' 
          ? path.basename(relativePath, path.extname(relativePath))
          : path.dirname(relativePath);
      })
      .filter((service, index, arr) => arr.indexOf(service) === index)
      .sort();
  }

  private async generateReadme() {
    let readme = '';

    // Header
    readme += this.generateHeader();
    
    // Badges
    readme += this.generateBadges();
    
    // Description
    readme += this.generateDescription();
    
    // Table of Contents
    readme += this.generateTableOfContents();
    
    // Features
    readme += this.generateFeatures();
    
    // Quick Start
    readme += this.generateQuickStart();
    
    // Project Structure
    readme += this.generateProjectStructure();
    
    // API Documentation
    readme += this.generateApiDocumentation();
    
    // Available Scripts
    readme += this.generateScripts();
    
    // Dependencies
    readme += this.generateDependencies();
    
    // Development
    readme += this.generateDevelopment();
    
    // Deployment
    readme += this.generateDeployment();
    
    // Contributing
    readme += this.generateContributing();
    
    // License
    readme += this.generateLicense();

    await fs.writeFile(path.join(this.projectRoot, 'README.md'), readme);
  }

  private generateHeader(): string {
    return `# ${this.packageJson.name || 'Project'}\n\n`;
  }

  private generateBadges(): string {
    let badges = '';
    
    if (this.packageJson.version) {
      badges += `![Version](https://img.shields.io/badge/version-${this.packageJson.version}-blue.svg)\n`;
    }
    
    if (this.packageJson.license) {
      badges += `![License](https://img.shields.io/badge/license-${this.packageJson.license}-green.svg)\n`;
    }
    
    // Node.js version from engines
    if (this.packageJson.engines?.node) {
      const nodeVersion = this.packageJson.engines.node.replace('>=', '').replace('<', '');
      badges += `![Node](https://img.shields.io/badge/node-${nodeVersion}-brightgreen.svg)\n`;
    }
    
    // Framework detection
    if (this.structure.dependencies.includes('next')) {
      badges += `![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)\n`;
    }
    
    if (this.structure.dependencies.includes('react')) {
      badges += `![React](https://img.shields.io/badge/React-19-blue.svg)\n`;
    }
    
    if (this.structure.dependencies.includes('typescript') || this.structure.devDependencies.includes('typescript')) {
      badges += `![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)\n`;
    }

    return badges ? badges + '\n' : '';
  }

  private generateDescription(): string {
    const description = this.packageJson.description || 
      'A comprehensive AI-powered development platform with advanced monitoring, security, and performance optimization.';
    
    return `${description}\n\n`;
  }

  private generateTableOfContents(): string {
    return `## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Available Scripts](#available-scripts)
- [Dependencies](#dependencies)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

`;
  }

  private generateFeatures(): string {
    const features = [
      '🚀 **Next.js 15** - Latest React framework with App Router',
      '🤖 **AI Integration** - Unified LiteLLM gateway with multiple providers',
      '🔒 **Security Hardened** - Comprehensive security middleware and monitoring',
      '📊 **Performance Monitoring** - Real-time metrics with Datadog integration',
      '💾 **Caching Layer** - Redis-based intelligent caching',
      '🗄️ **Database** - PostgreSQL with pgvector for AI embeddings',
      '🧪 **Testing** - Complete testing suite with Jest, Playwright, and TestContainers',
      '📚 **Documentation** - Auto-generated API docs and developer guides',
      '🐳 **Docker Support** - Full containerization with development environment',
      '🔧 **TypeScript** - Full type safety with strict configuration'
    ];

    return `## Features\n\n${features.join('\n')}\n\n`;
  }

  private generateQuickStart(): string {
    return `## Quick Start

### Prerequisites

- Node.js ${this.packageJson.engines?.node || '18.18+'}
- PostgreSQL 16+ with pgvector extension
- Redis 6+ (or Upstash account)
- Docker & Docker Compose (optional)

### Installation

\`\`\`bash
# Clone the repository
git clone <repository-url>
cd ${path.basename(this.projectRoot)}

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start services (optional)
docker-compose -f docker-compose.dev.yml up -d

# Initialize database
npm run db:migrate
npm run db:generate

# Start development server
npm run dev
\`\`\`

Visit [http://localhost:3000](http://localhost:3000) to see the application.

`;
  }

  private generateProjectStructure(): string {
    let structure = `## Project Structure

\`\`\`
${path.basename(this.projectRoot)}/
`;

    // Add major directories with descriptions
    const dirDescriptions = {
      'src': 'Source code',
      'docs': 'Documentation files',
      'scripts': 'Build and utility scripts',
      'tests': 'Test files and configurations',
      'public': 'Static assets',
      'database': 'Database schemas and migrations',
      'k8s': 'Kubernetes deployment manifests',
      'extensions': 'VSCode extensions and tools'
    };

    this.structure.directories.forEach(dir => {
      const description = dirDescriptions[dir] || '';
      structure += `├── ${dir}/    ${description ? `# ${description}` : ''}\n`;
    });

    structure += `└── package.json\n\`\`\`\n\n`;

    // Add key directories breakdown
    structure += `### Key Directories\n\n`;
    structure += `- **src/app/** - Next.js app router pages and API routes\n`;
    structure += `- **src/components/** - Reusable React components\n`;
    structure += `- **src/lib/** - Utility functions and shared services\n`;
    structure += `- **src/hooks/** - Custom React hooks\n`;
    structure += `- **tests/** - Test files (unit, integration, E2E)\n`;
    structure += `- **docs/** - Documentation and guides\n\n`;

    return structure;
  }

  private generateApiDocumentation(): string {
    let apiDocs = `## API Documentation

The application provides REST API endpoints for various functionalities:

### Core Endpoints

`;

    // Group API routes by category
    const groupedRoutes = this.groupApiRoutes();
    
    Object.entries(groupedRoutes).forEach(([category, routes]) => {
      apiDocs += `#### ${this.capitalize(category)}\n\n`;
      routes.forEach(route => {
        apiDocs += `- \`${route}\`\n`;
      });
      apiDocs += `\n`;
    });

    apiDocs += `For detailed API documentation, see [docs/API.md](docs/API.md) (auto-generated).\n\n`;

    return apiDocs;
  }

  private groupApiRoutes(): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};
    
    this.structure.apiRoutes.forEach(route => {
      const parts = route.split('/').filter(Boolean);
      const category = parts[1] || 'general'; // /api/[category]/...
      
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(route);
    });

    return grouped;
  }

  private generateScripts(): string {
    let scripts = `## Available Scripts

### Development
`;

    // Categorize scripts
    const categories = {
      development: ['dev', 'dev:simple', 'build', 'start', 'lint', 'type-check'],
      testing: ['test', 'test:watch', 'test:e2e', 'test:integration', 'test:security'],
      database: ['db:migrate', 'db:status', 'db:validate', 'db:setup'],
      monitoring: ['monitoring:health', 'monitoring:metrics', 'perf:monitor'],
      security: ['security:test', 'security:audit', 'security:scan'],
      ai: ['ai:status', 'ai:models', 'ai:usage', 'ai:costs'],
      documentation: ['docs:validate', 'docs:stats']
    };

    Object.entries(categories).forEach(([category, scriptNames]) => {
      const categoryScripts = scriptNames.filter(name => this.structure.scripts[name]);
      
      if (categoryScripts.length > 0) {
        scripts += `\n### ${this.capitalize(category)}\n\n`;
        
        categoryScripts.forEach(name => {
          scripts += `\`\`\`bash\nnpm run ${name}\n\`\`\`\n`;
          scripts += `${this.getScriptDescription(name)}\n\n`;
        });
      }
    });

    return scripts;
  }

  private getScriptDescription(scriptName: string): string {
    const descriptions = {
      'dev': 'Start development server with monitoring',
      'dev:simple': 'Start development server without monitoring',
      'build': 'Build production application',
      'start': 'Start production server',
      'lint': 'Run ESLint code linting',
      'type-check': 'Run TypeScript type checking',
      'test': 'Run unit tests',
      'test:e2e': 'Run end-to-end tests',
      'test:integration': 'Run integration tests',
      'test:security': 'Run security tests',
      'db:migrate': 'Deploy database migrations',
      'db:status': 'Check migration status',
      'db:validate': 'Validate database configuration',
      'monitoring:health': 'Check system health',
      'monitoring:metrics': 'View performance metrics',
      'security:test': 'Run security vulnerability scan',
      'ai:status': 'Check AI gateway status',
      'ai:models': 'List available AI models',
      'docs:validate': 'Validate documentation accuracy'
    };

    return descriptions[scriptName] || '';
  }

  private generateDependencies(): string {
    let deps = `## Dependencies

### Core Technologies

`;

    // Highlight key dependencies
    const keyDeps = {
      'next': 'React framework for production',
      'react': 'JavaScript library for user interfaces',
      'typescript': 'Typed JavaScript',
      'tailwindcss': 'Utility-first CSS framework',
      '@prisma/client': 'Type-safe database client',
      'redis': 'In-memory data structure store',
      'next-auth': 'Authentication library for Next.js',
      'openai': 'OpenAI API client',
      'dd-trace': 'Datadog tracing library'
    };

    Object.entries(keyDeps).forEach(([pkg, description]) => {
      if (this.structure.dependencies.includes(pkg)) {
        const version = this.packageJson.dependencies[pkg];
        deps += `- **${pkg}** (${version}) - ${description}\n`;
      }
    });

    deps += `\n### Development Dependencies\n\n`;
    deps += `Key development tools include Jest, Playwright, ESLint, and Prisma CLI.\n\n`;
    deps += `See [package.json](package.json) for complete dependency list.\n\n`;

    return deps;
  }

  private generateDevelopment(): string {
    return `## Development

### Environment Setup

1. Copy environment template:
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`

2. Configure required environment variables:
   - Database connection string
   - Redis connection string
   - API keys for AI services
   - Authentication secrets

3. Start development services:
   \`\`\`bash
   docker-compose -f docker-compose.dev.yml up -d
   \`\`\`

### Code Quality

- **TypeScript**: Strict mode enabled with comprehensive type checking
- **ESLint**: Code quality and consistency enforcement
- **Prettier**: Automated code formatting
- **Husky**: Git hooks for pre-commit validation

### Testing Strategy

- **Unit Tests**: Jest with React Testing Library
- **Integration Tests**: API and database integration testing
- **E2E Tests**: Playwright for browser automation
- **Security Tests**: Automated vulnerability scanning

### Development Workflow

1. Create feature branch: \`git checkout -b feature/your-feature\`
2. Make changes and test: \`npm run test && npm run test:e2e\`
3. Check code quality: \`npm run lint && npm run type-check\`
4. Submit pull request with tests and documentation

`;
  }

  private generateDeployment(): string {
    return `## Deployment

### Production Environment

The application supports multiple deployment strategies:

#### Docker Deployment

\`\`\`bash
# Build production image
docker build -t ${this.packageJson.name} .

# Run with dependencies
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose exec app npm run db:migrate
\`\`\`

#### Environment Variables

Required environment variables for production:

- \`DATABASE_URL\` - PostgreSQL connection string
- \`REDIS_URL\` - Redis connection string
- \`NEXTAUTH_SECRET\` - Authentication secret key
- \`OPENAI_API_KEY\` - OpenAI API key
- \`ANTHROPIC_API_KEY\` - Anthropic API key
- \`DD_API_KEY\` - Datadog API key (optional)

#### Health Checks

Monitor application health:

\`\`\`bash
curl http://localhost:3000/api/monitoring/performance?action=health
\`\`\`

`;
  }

  private generateContributing(): string {
    return `## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Quick Contribution Guide

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create** a feature branch
4. **Make** your changes with tests
5. **Run** the test suite
6. **Submit** a pull request

### Code Standards

- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Use conventional commit messages
- Ensure security best practices

`;
  }

  private generateLicense(): string {
    const license = this.packageJson.license || 'MIT';
    return `## License

This project is licensed under the ${license} License - see the [LICENSE](LICENSE) file for details.

---

**Need Help?** 
- Check the [Developer Guide](docs/DEVELOPER_GUIDE.md)
- Review [API Documentation](docs/API.md)
- Run health checks: \`npm run perf:health\`
- View monitoring: \`http://localhost:3000/api/monitoring/performance\`
`;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Script execution
if (require.main === module) {
  const updater = new ReadmeUpdater();
  updater.update().catch(error => {
    console.error('Failed to update README:', error);
    process.exit(1);
  });
}

export { ReadmeUpdater };