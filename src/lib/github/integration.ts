/**
 * GitHub integration for direct repository creation and management
 */

import { Octokit } from '@octokit/rest'
import { z } from '@/lib/zod-compat'
import type { GeneratedProject } from '@/lib/templates/generator'

const createRepoSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  private: z.boolean().default(false),
  autoInit: z.boolean().default(false),
  gitignoreTemplate: z.string().optional(),
  licenseTemplate: z.string().optional(),
})

interface GitHubRepoOptions {
  name: string
  description?: string
  private?: boolean
  autoInit?: boolean
  gitignoreTemplate?: string
  licenseTemplate?: string
  accessToken: string
}

interface GitHubFile {
  path: string
  content: string
  encoding?: 'utf-8' | 'base64'
}

interface CreateRepoResult {
  repository: {
    id: number
    name: string
    fullName: string
    htmlUrl: string
    cloneUrl: string
    sshUrl: string
    defaultBranch: string
  }
  setupInstructions: string[]
}

/**
 * GitHub API client wrapper for VibeCode integration
 */
export class GitHubIntegration {
  private octokit: Octokit
  private owner: string

  constructor(accessToken: string, owner?: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    })
    this.owner = owner || '' // Will be set from authenticated user
  }

  /**
   * Initialize GitHub integration and get authenticated user info
   */
  async initialize(): Promise<{ login: string; name: string; email: string }> {
    try {
      const { data: user } = await this.octokit.rest.users.getAuthenticated()
      this.owner = user.login
      
      return {
        login: user.login,
        name: user.name || user.login,
        email: user.email || `${user.login}@users.noreply.github.com`
      }
    } catch (error) {
      throw new Error(`Failed to authenticate with GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create a new GitHub repository
   */
  async createRepository(options: GitHubRepoOptions): Promise<CreateRepoResult> {
    const validatedOptions = createRepoSchema.parse(options)

    try {
      const { data: repo } = await this.octokit.rest.repos.createForAuthenticatedUser({
        name: validatedOptions.name,
        description: validatedOptions.description,
        private: validatedOptions.private,
        auto_init: validatedOptions.autoInit,
        gitignore_template: validatedOptions.gitignoreTemplate,
        license_template: validatedOptions.licenseTemplate,
      })

      const setupInstructions = [
        `git clone ${repo.clone_url}`,
        `cd ${repo.name}`,
        'git add .',
        'git commit -m "Initial commit from VibeCode"',
        'git push origin main'
      ]

      return {
        repository: {
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          htmlUrl: repo.html_url,
          cloneUrl: repo.clone_url,
          sshUrl: repo.ssh_url,
          defaultBranch: repo.default_branch
        },
        setupInstructions
      }
    } catch (error) {
      throw new Error(`Failed to create repository: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Upload multiple files to a GitHub repository
   */
  async uploadFiles(
    repoName: string, 
    files: GitHubFile[], 
    commitMessage: string = 'Add project files from VibeCode'
  ): Promise<void> {
    try {
      // Get the repository to ensure it exists and get the default branch
      const { data: repo } = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: repoName,
      })

      const defaultBranch = repo.default_branch

      // Get the latest commit SHA for the default branch
      let latestSHA: string
      try {
        const { data: ref } = await this.octokit.rest.git.getRef({
          owner: this.owner,
          repo: repoName,
          ref: `heads/${defaultBranch}`,
        })
        latestSHA = ref.object.sha
      } catch (error) {
        // If the branch doesn't exist (empty repo), we'll create it
        latestSHA = ''
      }

      // Create a tree with all files
      const tree = await Promise.all(
        files.map(async (file) => {
          const content = file.encoding === 'base64' 
            ? file.content 
            : Buffer.from(file.content, 'utf-8').toString('base64')

          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            content,
            encoding: 'base64' as const
          }
        })
      )

      const { data: newTree } = await this.octokit.rest.git.createTree({
        owner: this.owner,
        repo: repoName,
        tree,
        base_tree: latestSHA || undefined,
      })

      // Create a commit
      const { data: commit } = await this.octokit.rest.git.createCommit({
        owner: this.owner,
        repo: repoName,
        message: commitMessage,
        tree: newTree.sha,
        parents: latestSHA ? [latestSHA] : [],
      })

      // Update the reference
      if (latestSHA) {
        await this.octokit.rest.git.updateRef({
          owner: this.owner,
          repo: repoName,
          ref: `heads/${defaultBranch}`,
          sha: commit.sha,
        })
      } else {
        await this.octokit.rest.git.createRef({
          owner: this.owner,
          repo: repoName,
          ref: `refs/heads/${defaultBranch}`,
          sha: commit.sha,
        })
      }
    } catch (error) {
      throw new Error(`Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create repository from generated project
   */
  async createRepositoryFromProject(
    generatedProject: GeneratedProject,
    options: {
      private?: boolean
      description?: string
      licenseTemplate?: string
    } = {}
  ): Promise<CreateRepoResult & { commitSHA: string }> {
    // Sanitize repository name
    const repoName = generatedProject.name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    // Create the repository
    const repoResult = await this.createRepository({
      name: repoName,
      description: options.description || generatedProject.description,
      private: options.private || false,
      autoInit: false, // We'll add our own files
      licenseTemplate: options.licenseTemplate,
      accessToken: '' // Not used in this context
    })

    // Prepare files for upload
    const githubFiles: GitHubFile[] = generatedProject.files.map(file => ({
      path: file.path,
      content: file.content,
      encoding: 'utf-8' as const
    }))

    // Add package.json if it exists in scripts/dependencies
    if (Object.keys(generatedProject.dependencies).length > 0 || Object.keys(generatedProject.scripts).length > 0) {
      const packageJson = {
        name: repoName,
        version: '1.0.0',
        description: generatedProject.description,
        scripts: generatedProject.scripts,
        dependencies: generatedProject.dependencies,
        ...(generatedProject.devDependencies && { devDependencies: generatedProject.devDependencies })
      }

      githubFiles.push({
        path: 'package.json',
        content: JSON.stringify(packageJson, null, 2),
        encoding: 'utf-8'
      })
    }

    // Add environment variables template
    if (generatedProject.envVars.length > 0) {
      const envContent = generatedProject.envVars
        .map((env: { name: string; value: string }) => `${env.name}=${env.value}`)
        .join('\n')

      const envExampleContent = generatedProject.envVars
        .map((env: { name: string; value: string; description?: string }) => `# ${env.description}\n${env.name}=${env.value || 'your-value-here'}`)
        .join('\n\n')

      githubFiles.push({
        path: '.env.example',
        content: envExampleContent,
        encoding: 'utf-8'
      })
    }

    // Upload all files
    await this.uploadFiles(
      repoName, 
      githubFiles, 
      '🚀 Initial project setup from VibeCode\n\nGenerated with VibeCode AI-powered project scaffolding'
    )

    // Get the latest commit SHA
    const { data: commits } = await this.octokit.rest.repos.listCommits({
      owner: this.owner,
      repo: repoName,
      per_page: 1
    })

    return {
      ...repoResult,
      commitSHA: commits[0]?.sha || '',
      setupInstructions: [
        `git clone ${repoResult.repository.cloneUrl}`,
        `cd ${repoName}`,
        ...generatedProject.setupInstructions
      ]
    }
  }

  /**
   * Check if a repository name is available
   */
  async isRepositoryNameAvailable(name: string): Promise<boolean> {
    try {
      await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: name,
      })
      return false // Repository exists
    } catch (error: any) {
      if (error.status === 404) {
        return true // Repository doesn't exist, name is available
      }
      throw error // Some other error occurred
    }
  }

  /**
   * Get user's repositories
   */
  async getUserRepositories(options: {
    type?: 'all' | 'owner' | 'member'
    sort?: 'created' | 'updated' | 'pushed' | 'full_name'
    direction?: 'asc' | 'desc'
    per_page?: number
    page?: number
  } = {}): Promise<Array<{
    id: number
    name: string
    fullName: string
    description: string | null
    htmlUrl: string
    private: boolean
    createdAt: string
    updatedAt: string
    language: string | null
    stargazersCount: number
    forksCount: number
  }>> {
    try {
      const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
        type: options.type || 'owner',
        sort: options.sort || 'updated',
        direction: options.direction || 'desc',
        per_page: options.per_page || 30,
        page: options.page || 1,
      })

      return data.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        htmlUrl: repo.html_url,
        private: repo.private,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        language: repo.language,
        stargazersCount: repo.stargazers_count,
        forksCount: repo.forks_count,
      }))
    } catch (error) {
      throw new Error(`Failed to fetch repositories: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create a GitHub Actions workflow file
   */
  async addGitHubActionsWorkflow(
    repoName: string,
    workflowName: string,
    workflowContent: string
  ): Promise<void> {
    try {
      const workflowPath = `.github/workflows/${workflowName}.yml`
      
      await this.uploadFiles(repoName, [
        {
          path: workflowPath,
          content: workflowContent,
          encoding: 'utf-8'
        }
      ], `Add GitHub Actions workflow: ${workflowName}`)
    } catch (error) {
      throw new Error(`Failed to add GitHub Actions workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Set up repository protection rules
   */
  async setupBranchProtection(
    repoName: string,
    branch: string = 'main',
    options: {
      requireStatusChecks?: boolean
      requireUpToDate?: boolean
      requiredStatusChecks?: string[]
      enforceAdmins?: boolean
      requirePullRequestReviews?: boolean
      requiredReviewers?: number
      dismissStaleReviews?: boolean
      requireCodeOwnerReviews?: boolean
      restrictPushes?: boolean
      allowedPushUsers?: string[]
    } = {}
  ): Promise<void> {
    try {
      await this.octokit.rest.repos.updateBranchProtection({
        owner: this.owner,
        repo: repoName,
        branch,
        required_status_checks: options.requireStatusChecks ? {
          strict: options.requireUpToDate || false,
          contexts: options.requiredStatusChecks || []
        } : null,
        enforce_admins: options.enforceAdmins || false,
        required_pull_request_reviews: options.requirePullRequestReviews ? {
          required_approving_review_count: options.requiredReviewers || 1,
          dismiss_stale_reviews: options.dismissStaleReviews || false,
          require_code_owner_reviews: options.requireCodeOwnerReviews || false
        } : null,
        restrictions: options.restrictPushes ? {
          users: options.allowedPushUsers || [],
          teams: []
        } : null
      })
    } catch (error) {
      throw new Error(`Failed to set up branch protection: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

/**
 * Generate GitHub Actions workflow for common project types
 */
export function generateGitHubActionsWorkflow(
  projectType: string,
  language: string,
  framework?: string
): string {
  const workflows: Record<string, string> = {
    'node': `name: Node.js CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Run linter
      run: npm run lint
    
    - name: Build project
      run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build project
      run: npm run build
    
    - name: Deploy to production
      run: echo "Add your deployment steps here"`,

    'python': `name: Python CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.9', '3.10', '3.11']
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python \${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: \${{ matrix.python-version }}
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install pytest black flake8
    
    - name: Run black
      run: black --check .
    
    - name: Run flake8
      run: flake8 .
    
    - name: Run tests
      run: pytest

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    
    - name: Deploy to production
      run: echo "Add your deployment steps here"`,

    'docker': `name: Docker CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
    
    - name: Build Docker image
      run: docker build -t test-image .
    
    - name: Run tests in container
      run: docker run --rm test-image npm test

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: \${{ env.REGISTRY }}
        username: \${{ github.actor }}
        password: \${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: \${{ steps.meta.outputs.tags }}
        labels: \${{ steps.meta.outputs.labels }}`
  }

  // Determine workflow type based on project characteristics
  if (language === 'python') {
    return workflows.python
  } else if (language === 'javascript' || language === 'typescript' || framework === 'nextjs' || framework === 'react') {
    return workflows.node
  } else {
    return workflows.docker
  }
}