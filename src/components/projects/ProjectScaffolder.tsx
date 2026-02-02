/**
 * Project Scaffolder Component
 * Provides an intuitive interface for creating new projects from templates
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  StarIcon as StarIconOutline,
  StarIcon as StarIconSolid,
  ClockIcon,
  TagIcon,
  FolderIcon,
  DocumentIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolidFilled } from '@heroicons/react/24/solid';

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  framework: string;
  complexity: 'beginner' | 'intermediate' | 'advanced';
  stars: number;
  downloads: number;
  tags: string[];
  previewImage?: string;
  estimatedTime: string;
  features: string[];
}

interface ProjectConfig {
  name: string;
  description: string;
  templateId: string;
  workspaceId?: number;
  settings: {
    includeTests: boolean;
    includeDocs: boolean;
    includeCI: boolean;
    packageManager: 'npm' | 'yarn' | 'pnpm';
  };
  customizations: {
    author?: string;
    license?: string;
    version?: string;
  };
}

interface GenerationStatus {
  status: 'idle' | 'generating' | 'success' | 'error';
  message: string;
  progress?: number;
  error?: string;
  generatedFiles?: Array<{
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
  }>;
}

type GeneratedProject = {
  name: string;
  templateId: string;
  files: Array<{ name: string; path: string; content: string }>;
};

type InitialTemplate = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  language?: string;
  framework?: string;
  complexity?: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
  estimatedTime?: string;
  features?: string[];
  previewImage?: string;
  downloads?: number;
  stars?: number;
};

interface ProjectScaffolderProps {
  workspaceId?: number;
  onProjectCreate?: (project: GeneratedProject) => void;
  onGenerate?: (project: GeneratedProject) => void;
  onDownload?: (project: GeneratedProject) => void;
  onTemplateSelect?: (template: ProjectTemplate) => void;
  className?: string;
  initialTemplate?: InitialTemplate | null;
  initialProjectName?: string;
}

export function ProjectScaffolder({
  workspaceId,
  onProjectCreate,
  onGenerate,
  onDownload,
  onTemplateSelect,
  className = '',
  initialTemplate,
  initialProjectName
}: ProjectScaffolderProps) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>({
    name: '',
    description: '',
    templateId: '',
    workspaceId,
    settings: {
      includeTests: true,
      includeDocs: true,
      includeCI: false,
      packageManager: 'npm'
    },
    customizations: {}
  });
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
    status: 'idle',
    message: 'Ready to create project'
  });
  const [generatedProject, setGeneratedProject] = useState<GeneratedProject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const normalizeTemplate = useMemo(
    () => (template: InitialTemplate): ProjectTemplate => ({
      id: template.id,
      name: template.name,
      description: template.description ?? 'Starter template',
      category: template.category ?? 'web',
      language: template.language ?? 'typescript',
      framework: template.framework ?? 'react',
      complexity: template.complexity ?? 'intermediate',
      stars: template.stars ?? 4.5,
      downloads: template.downloads ?? 1000,
      tags: template.tags ?? ['starter'],
      previewImage: template.previewImage,
      estimatedTime: template.estimatedTime ?? '5 min',
      features: template.features ?? ['TypeScript', 'Tooling']
    }),
    []
  );

  // Load available templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    // This would integrate with the template marketplace API
    // For now, using mock data
    const mockTemplates: ProjectTemplate[] = [
      {
        id: 'react-ts-vite',
        name: 'React TypeScript Vite',
        description: 'Modern React application with TypeScript and Vite build system',
        category: 'web',
        language: 'typescript',
        framework: 'react',
        complexity: 'intermediate',
        stars: 4.8,
        downloads: 15420,
        tags: ['react', 'typescript', 'vite', 'modern'],
        estimatedTime: '5 min',
        features: ['TypeScript', 'Vite', 'ESLint', 'Prettier', 'Testing']
      },
      {
        id: 'nextjs-fullstack',
        name: 'Next.js Full Stack',
        description: 'Complete full-stack application with Next.js, API routes, and database',
        category: 'web',
        language: 'typescript',
        framework: 'nextjs',
        complexity: 'advanced',
        stars: 4.6,
        downloads: 8930,
        tags: ['nextjs', 'fullstack', 'api', 'database'],
        estimatedTime: '8 min',
        features: ['Next.js', 'API Routes', 'Database', 'Authentication', 'Deployment']
      },
      {
        id: 'vue-nuxt-starter',
        name: 'Vue Nuxt Starter',
        description: 'Vue.js application with Nuxt.js framework and server-side rendering',
        category: 'web',
        language: 'javascript',
        framework: 'vue',
        complexity: 'intermediate',
        stars: 4.4,
        downloads: 5620,
        tags: ['vue', 'nuxt', 'ssr', 'javascript'],
        estimatedTime: '6 min',
        features: ['Vue 3', 'Nuxt 3', 'SSR', 'TypeScript', 'Tailwind CSS']
      }
    ];

    setTemplates(() => {
      const combined = [...mockTemplates];
      if (initialTemplate) {
        const normalized = normalizeTemplate(initialTemplate);
        const exists = combined.some(template => template.id === normalized.id);
        if (!exists) {
          combined.push(normalized);
        }
      }
      return combined;
    });
  };

  useEffect(() => {
    if (!initialTemplate) return;

    const normalized = normalizeTemplate(initialTemplate);

    setTemplates(prev => {
      const exists = prev.some(template => template.id === normalized.id);
      if (exists) return prev;
      return [...prev, normalized];
    });

    setSelectedTemplate(normalized);
    setProjectConfig(prev => ({
      ...prev,
      name:
        initialProjectName ??
        prev.name ??
        normalized.name.toLowerCase().replace(/\s+/g, '-'),
      templateId: normalized.id
    }));
    onTemplateSelect?.(normalized);
  }, [initialTemplate, initialProjectName, normalizeTemplate, onTemplateSelect]);

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: 'all', name: 'All Templates', count: templates.length },
    { id: 'web', name: 'Web Apps', count: templates.filter(t => t.category === 'web').length },
    { id: 'mobile', name: 'Mobile', count: templates.filter(t => t.category === 'mobile').length },
    { id: 'desktop', name: 'Desktop', count: templates.filter(t => t.category === 'desktop').length }
  ];

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setProjectConfig(prev => ({
      ...prev,
      templateId: template.id
    }));
    onTemplateSelect?.(template);
  };

  const handleCreateProject = async () => {
    if (!selectedTemplate || !projectConfig.name.trim()) {
      setGenerationStatus({
        status: 'error',
        message: 'Please select a template and enter a project name'
      });
      return;
    }

    setGenerationStatus({
      status: 'generating',
      message: 'Creating project structure...',
      progress: 0
    });

    try {
      // Simulate project generation process
      await generateProject();

      const projectPayload: GeneratedProject = {
        name: projectConfig.name,
        templateId: selectedTemplate.id,
        files: [] // Placeholder for generated file content
      };

      setGenerationStatus({
        status: 'success',
        message: 'Project created successfully!',
        progress: 100,
        generatedFiles: [
          { name: 'package.json', path: 'package.json', type: 'file' },
          { name: 'src', path: 'src', type: 'directory' },
          { name: 'public', path: 'public', type: 'directory' },
          { name: 'README.md', path: 'README.md', type: 'file' }
        ]
      });

      setGeneratedProject(projectPayload);

      onProjectCreate?.(projectPayload);

    } catch (error) {
      setGenerationStatus({
        status: 'error',
        message: 'Failed to create project',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const generateProject = async (): Promise<void> => {
    // Simulate project generation steps
    const steps = [
      { message: 'Creating project structure...', duration: 1000, progress: 25 },
      { message: 'Installing dependencies...', duration: 2000, progress: 50 },
      { message: 'Configuring build tools...', duration: 1500, progress: 75 },
      { message: 'Finalizing project...', duration: 1000, progress: 100 }
    ];

    for (const step of steps) {
      setGenerationStatus(prev => ({
        ...prev,
        message: step.message,
        progress: step.progress
      }));

      await new Promise(resolve => setTimeout(resolve, step.duration));
    }
  };

  const updateProjectConfig = (updates: Partial<ProjectConfig>) => {
    setProjectConfig(prev => ({ ...prev, ...updates }));
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <StarIconSolidFilled key={i} className="h-4 w-4 text-yellow-400" />
      );
    }

    if (hasHalfStar) {
      stars.push(
        <div key="half" className="relative h-4 w-4">
          <StarIconOutline className="h-4 w-4 text-yellow-400" />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <StarIconSolidFilled className="h-4 w-4 text-yellow-400" />
          </div>
        </div>
      );
    }

    const remainingStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(
        <StarIconOutline key={`empty-${i}`} className="h-4 w-4 text-gray-300" />
      );
    }

    return stars;
  };

  return (
    <div className={`max-w-6xl mx-auto ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create New Project</h2>
              <p className="text-gray-600 mt-1">Choose a template to get started</p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.name} ({category.count})
                </button>
              ))}
            </div>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className={`bg-white rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                  selectedTemplate?.id === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleTemplateSelect(template)}
              >
                {/* Template Preview */}
                <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 rounded-t-lg flex items-center justify-center">
                  {template.previewImage ? (
                    <img
                      src={template.previewImage}
                      alt={template.name}
                      className="w-full h-full object-cover rounded-t-lg"
                    />
                  ) : (
                    <div className="text-center">
                      <FolderIcon className="h-12 w-12 text-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">{template.name}</p>
                    </div>
                  )}
                </div>

                {/* Template Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                        {template.description}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                    <div className="flex items-center">
                      {renderStars(template.stars)}
                      <span className="ml-1">{template.stars}</span>
                    </div>
                    <div className="flex items-center">
                      <DocumentIcon className="h-4 w-4 mr-1" />
                      {template.downloads.toLocaleString()}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                      >
                        <TagIcon className="h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                    {template.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{template.tags.length - 3} more</span>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      template.complexity === 'beginner'
                        ? 'bg-green-100 text-green-800'
                        : template.complexity === 'intermediate'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {template.complexity}
                    </span>
                    <div className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      {template.estimatedTime}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <FolderIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
              <p className="text-gray-600">
                Try adjusting your search criteria or browse all templates.
              </p>
            </div>
          )}
        </div>

        {/* Project Configuration */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Project Configuration</h3>

            {selectedTemplate ? (
              <>
                {/* Selected Template Info */}
                <div className="mb-6 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-blue-900">{selectedTemplate.name}</p>
                      <p className="text-sm text-blue-700">{selectedTemplate.language} • {selectedTemplate.framework}</p>
                    </div>
                  </div>
                </div>

                {/* Project Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      value={projectConfig.name}
                      onChange={(e) => updateProjectConfig({ name: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="my-awesome-project"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={projectConfig.description}
                      onChange={(e) => updateProjectConfig({ description: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Brief description of your project..."
                    />
                  </div>

                  {/* Generation Settings */}
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Generation Settings</h4>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={projectConfig.settings.includeTests}
                          onChange={(e) => updateProjectConfig({
                            settings: { ...projectConfig.settings, includeTests: e.target.checked }
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Include tests</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={projectConfig.settings.includeDocs}
                          onChange={(e) => updateProjectConfig({
                            settings: { ...projectConfig.settings, includeDocs: e.target.checked }
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Include documentation</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={projectConfig.settings.includeCI}
                          onChange={(e) => updateProjectConfig({
                            settings: { ...projectConfig.settings, includeCI: e.target.checked }
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Include CI/CD configuration</span>
                      </label>
                    </div>
                  </div>

                  {/* Package Manager */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Package Manager
                    </label>
                    <select
                      value={projectConfig.settings.packageManager}
                      onChange={(e) => updateProjectConfig({
                        settings: { ...projectConfig.settings, packageManager: e.target.value as 'npm' | 'yarn' | 'pnpm' }
                      })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="npm">npm</option>
                      <option value="yarn">yarn</option>
                      <option value="pnpm">pnpm</option>
                    </select>
                  </div>

                  {/* Advanced Settings */}
                  <div>
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                    </button>

                    {showAdvanced && (
                      <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Author
                          </label>
                          <input
                            type="text"
                            value={projectConfig.customizations.author || ''}
                            onChange={(e) => updateProjectConfig({
                              customizations: { ...projectConfig.customizations, author: e.target.value }
                            })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Your name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            License
                          </label>
                          <select
                            value={projectConfig.customizations.license || 'MIT'}
                            onChange={(e) => updateProjectConfig({
                              customizations: { ...projectConfig.customizations, license: e.target.value }
                            })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          >
                            <option value="MIT">MIT</option>
                            <option value="Apache-2.0">Apache 2.0</option>
                            <option value="GPL-3.0">GPL 3.0</option>
                            <option value="ISC">ISC</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Generation Status */}
                {generationStatus.status !== 'idle' && (
                  <div className="mt-6 p-4 border-t border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {generationStatus.status === 'success' && (
                          <CheckCircleIcon className="h-6 w-6 text-green-600" />
                        )}
                        {generationStatus.status === 'error' && (
                          <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                        )}
                        {generationStatus.status === 'generating' && (
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{generationStatus.message}</p>
                        {generationStatus.progress !== undefined && generationStatus.status === 'generating' && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${generationStatus.progress}%` }}
                              ></div>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {generationStatus.progress}% complete
                            </p>
                          </div>
                        )}
                        {generationStatus.error && (
                          <p className="text-sm text-red-600 mt-2">{generationStatus.error}</p>
                        )}
                        {generationStatus.status === 'success' && generatedProject && (
                          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            {onGenerate && (
                              <button
                                onClick={() => onGenerate(generatedProject)}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                              >
                                Open in Workspace
                              </button>
                            )}
                            {onDownload && (
                              <button
                                onClick={() => onDownload(generatedProject)}
                                className="flex-1 px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                              >
                                Download Project
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleCreateProject}
                    disabled={generationStatus.status === 'generating' || !projectConfig.name.trim()}
                    className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
                      generationStatus.status === 'generating' || !projectConfig.name.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {generationStatus.status === 'generating' ? (
                      <>
                        <CogIcon className="h-5 w-5 animate-spin mr-2 inline" />
                        Creating Project...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-5 w-5 mr-2 inline" />
                        Create Project
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <FolderIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Select a template to configure your project</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
