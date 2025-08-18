"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiMocks = void 0;
const sinon = __importStar(require("sinon"));
class ApiMocks {
    constructor() {
        this.axiosStub = null;
    }
    static getInstance() {
        if (!ApiMocks.instance) {
            ApiMocks.instance = new ApiMocks();
        }
        return ApiMocks.instance;
    }
    setupMocks() {
        // Mock axios if not already mocked
        if (!this.axiosStub) {
            const axios = require('axios');
            this.axiosStub = sinon.stub(axios, 'default');
        }
    }
    teardownMocks() {
        if (this.axiosStub) {
            this.axiosStub.restore();
            this.axiosStub = null;
        }
        sinon.restore();
    }
    mockTemplatesAPI() {
        this.setupMocks();
        const mockTemplates = [
            {
                id: 'react-typescript',
                name: 'React TypeScript Starter',
                description: 'Modern React app with TypeScript, Vite, and Tailwind CSS',
                category: 'Frontend',
                tags: ['react', 'typescript', 'vite', 'tailwind'],
                author: 'vibecode',
                downloads: 1250,
                rating: 4.8,
                framework: 'React',
                language: 'TypeScript'
            },
            {
                id: 'nextjs-fullstack',
                name: 'Next.js Full-Stack',
                description: 'Complete Next.js app with authentication and database',
                category: 'Full-Stack',
                tags: ['nextjs', 'prisma', 'auth', 'postgresql'],
                author: 'vibecode',
                downloads: 890,
                rating: 4.9,
                framework: 'Next.js',
                language: 'TypeScript'
            }
        ];
        if (this.axiosStub) {
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/\/api\/templates/))).resolves({
                data: { templates: mockTemplates },
                status: 200
            });
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/\/api\/templates\/\w+/))).resolves({
                data: mockTemplates[0],
                status: 200
            });
        }
    }
    mockDeploymentAPI() {
        this.setupMocks();
        const mockDeployments = [
            {
                id: 'deploy-1',
                name: 'my-app',
                status: 'deployed',
                provider: 'vercel',
                url: 'https://my-app-abc123.vercel.app',
                logs: ['Building...', 'Deployed successfully'],
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T10:05:00Z'
            },
            {
                id: 'deploy-2',
                name: 'test-app',
                status: 'building',
                provider: 'netlify',
                logs: ['Starting build...', 'Installing dependencies...'],
                createdAt: '2024-01-15T11:00:00Z',
                updatedAt: '2024-01-15T11:02:00Z'
            }
        ];
        if (this.axiosStub) {
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/\/api\/deployments/))).resolves({
                data: { deployments: mockDeployments },
                status: 200
            });
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/\/api\/deploy/))).resolves({
                data: { deployment: mockDeployments[0] },
                status: 201
            });
        }
    }
    mockGitHubAPI() {
        this.setupMocks();
        const mockRepos = [
            {
                id: 'repo-1',
                name: 'my-project',
                full_name: 'user/my-project',
                private: false,
                html_url: 'https://github.com/user/my-project',
                description: 'My awesome project',
                default_branch: 'main',
                has_workflows: true
            },
            {
                id: 'repo-2',
                name: 'private-app',
                full_name: 'user/private-app',
                private: true,
                html_url: 'https://github.com/user/private-app',
                description: 'Private application',
                default_branch: 'main',
                has_workflows: false
            }
        ];
        if (this.axiosStub) {
            // Mock GitHub authentication
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/github\.com\/login\/oauth/))).resolves({
                data: { access_token: 'mock-token-123' },
                status: 200
            });
            // Mock user repositories
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/api\.github\.com\/user\/repos/))).resolves({
                data: mockRepos,
                status: 200
            });
            // Mock repository creation
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/api\.github\.com\/user\/repos/))).resolves({
                data: mockRepos[0],
                status: 201
            });
            // Mock workflow creation
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/api\.github\.com\/repos\/.+\/actions\/workflows/))).resolves({
                data: { id: 'workflow-1', name: 'CI/CD Pipeline' },
                status: 201
            });
        }
    }
    mockMonitoringAPI() {
        this.setupMocks();
        const mockMetrics = {
            deployments: {
                total: 45,
                successful: 42,
                failed: 3,
                success_rate: 93.3
            },
            usage: {
                api_calls: 1250,
                templates_used: 28,
                active_projects: 12
            },
            performance: {
                avg_build_time: 180,
                avg_response_time: 95,
                uptime: 99.9
            }
        };
        if (this.axiosStub) {
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/\/api\/monitoring/))).resolves({
                data: mockMetrics,
                status: 200
            });
        }
    }
    mockCollaborationAPI() {
        this.setupMocks();
        const mockSessions = [
            {
                id: 'session-1',
                name: 'Project Review',
                participants: ['user1', 'user2'],
                status: 'active',
                created_at: '2024-01-15T14:00:00Z'
            },
            {
                id: 'session-2',
                name: 'Code Review',
                participants: ['user1', 'user3'],
                status: 'ended',
                created_at: '2024-01-15T13:00:00Z'
            }
        ];
        if (this.axiosStub) {
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/\/api\/collaboration/))).resolves({
                data: { sessions: mockSessions },
                status: 200
            });
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/\/api\/collaboration\/start/))).resolves({
                data: { session: mockSessions[0] },
                status: 201
            });
        }
    }
    mockAIModelsAPI() {
        this.setupMocks();
        const mockModels = [
            {
                id: 'anthropic/claude-3-sonnet',
                name: 'Claude 3 Sonnet',
                provider: 'Anthropic',
                context_length: 200000,
                cost_per_token: 0.000015,
                available: true,
                capabilities: ['text', 'code', 'reasoning']
            },
            {
                id: 'openai/gpt-4-turbo',
                name: 'GPT-4 Turbo',
                provider: 'OpenAI',
                context_length: 128000,
                cost_per_token: 0.00001,
                available: true,
                capabilities: ['text', 'code', 'vision']
            }
        ];
        if (this.axiosStub) {
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/\/api\/ai\/models/))).resolves({
                data: { models: mockModels },
                status: 200
            });
            this.axiosStub.withArgs(sinon.match.has('url', sinon.match(/\/api\/ai\/orchestration/))).resolves({
                data: { status: 'configured', active_models: 2 },
                status: 200
            });
        }
    }
    mockAllAPIs() {
        this.mockTemplatesAPI();
        this.mockDeploymentAPI();
        this.mockGitHubAPI();
        this.mockMonitoringAPI();
        this.mockCollaborationAPI();
        this.mockAIModelsAPI();
    }
}
exports.ApiMocks = ApiMocks;
exports.default = ApiMocks.getInstance();
//# sourceMappingURL=api-mocks.js.map