/**
 * Template Submission Form Component
 * Allows users to submit new templates to the marketplace
 */

'use client';

import React, { useState } from 'react';
import {
  PlusIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import { z } from '@/lib/zod-compat';

interface TemplateFormData {
  name: string;
  description: string;
  category: 'frontend' | 'fullstack' | 'backend' | 'mobile' | 'desktop' | 'library';
  language: string;
  framework: string;
  complexity: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  envVars: Array<{
    name: string;
    defaultValue?: string;
    description?: string;
  }>;
  documentation: {
    setup: string[];
    usage: string[];
    deployment: string[];
  };
  dockerSupport: boolean;
  kubernetesSupport: boolean;
  cicdTemplate: boolean;
  testingSetup: boolean;
  monitoringSetup: boolean;
}

interface SubmissionStatus {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  message: string;
  progress?: number;
  error?: string;
}

interface TemplateSubmissionFormProps {
  onSubmit?: (templateData: TemplateFormData) => Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<TemplateFormData>;
}

const templateFormSchema = z.object({
  name: z.string().trim().min(3, 'Template name must be at least 3 characters long'),
  description: z
    .string()
    .trim()
    .min(20, 'Please provide a longer description (20+ characters).'),
  category: z.enum(['frontend', 'fullstack', 'backend', 'mobile', 'desktop', 'library']),
  language: z.string().trim().min(2, 'Select a language'),
  framework: z.string().trim().min(2, 'Select a framework'),
  complexity: z.enum(['beginner', 'intermediate', 'advanced']),
  tags: z.array(z.string().trim().min(1)).max(20).default([]),
  dependencies: z.record(z.string(), z.string().trim().min(1)).default({}),
  scripts: z.record(z.string(), z.string().trim().min(1)).default({}),
  envVars: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Environment variable name is required'),
        defaultValue: z.string().trim().optional(),
        description: z.string().trim().optional(),
      })
    )
    .max(20)
    .default([]),
  documentation: z.object({
    setup: z.array(z.string().trim().min(1)).default([]),
    usage: z.array(z.string().trim().min(1)).default([]),
    deployment: z.array(z.string().trim().min(1)).default([]),
  }),
  dockerSupport: z.boolean(),
  kubernetesSupport: z.boolean(),
  cicdTemplate: z.boolean(),
  testingSetup: z.boolean(),
  monitoringSetup: z.boolean(),
});

export function TemplateSubmissionForm({
  onSubmit,
  onCancel,
  initialData = {}
}: TemplateSubmissionFormProps) {
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    category: 'frontend',
    language: 'typescript',
    framework: 'react',
    complexity: 'intermediate',
    tags: [],
    dependencies: {},
    scripts: {},
    envVars: [],
    documentation: {
      setup: [],
      usage: [],
      deployment: []
    },
    dockerSupport: false,
    kubernetesSupport: false,
    cicdTemplate: false,
    testingSetup: false,
    monitoringSetup: false,
    ...initialData
  });

  const [newTag, setNewTag] = useState('');
  const [newDependency, setNewDependency] = useState({ name: '', version: '' });
  const [newScript, setNewScript] = useState({ name: '', command: '' });
  const [newEnvVar, setNewEnvVar] = useState({ name: '', defaultValue: '', description: '' });
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
    status: 'idle',
    message: 'Ready to submit'
  });

  const categories = [
    { value: 'frontend', label: 'Frontend' },
    { value: 'fullstack', label: 'Full Stack' },
    { value: 'backend', label: 'Backend' },
    { value: 'mobile', label: 'Mobile' },
    { value: 'desktop', label: 'Desktop' },
    { value: 'library', label: 'Library' }
  ];

  const languages = [
    'typescript',
    'javascript',
    'python',
    'java',
    'csharp',
    'go',
    'rust',
    'php',
    'ruby'
  ];

  const frameworks = [
    'react',
    'vue',
    'angular',
    'svelte',
    'nextjs',
    'nuxtjs',
    'express',
    'fastapi',
    'django',
    'spring',
    'laravel'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizeRecord = (record: Record<string, string>) =>
      Object.fromEntries(
        Object.entries(record)
          .map(([key, value]) => [key.trim(), value.trim()])
          .filter(([key, value]) => key.length && value.length)
      );

    const sanitizeLines = (lines: string[]) => lines.map(line => line.trim()).filter(Boolean);

    const sanitizedFormData: TemplateFormData = {
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
      language: formData.language.trim(),
      framework: formData.framework.trim(),
      tags: formData.tags.map(tag => tag.trim()).filter(Boolean),
      dependencies: sanitizeRecord(formData.dependencies),
      scripts: sanitizeRecord(formData.scripts),
      envVars: formData.envVars
        .map(envVar => ({
          name: envVar.name.trim(),
          defaultValue: envVar.defaultValue?.trim() || undefined,
          description: envVar.description?.trim() || undefined
        }))
        .filter(envVar => envVar.name.length > 0),
      documentation: {
        setup: sanitizeLines(formData.documentation.setup),
        usage: sanitizeLines(formData.documentation.usage),
        deployment: sanitizeLines(formData.documentation.deployment)
      }
    };

    const validation = templateFormSchema.safeParse(sanitizedFormData);
    if (!validation.success) {
      const [issue] = validation.error.issues;
      setSubmissionStatus({
        status: 'error',
        message: 'Please correct the form errors',
        error: issue?.message ?? 'Invalid form data'
      });
      return;
    }

    setSubmissionStatus({
      status: 'uploading',
      message: 'Uploading template...',
      error: undefined
    });

    try {
      await onSubmit?.(validation.data as TemplateFormData);

      setSubmissionStatus({
        status: 'success',
        message: 'Template submitted successfully!'
      });
    } catch (error) {
      setSubmissionStatus({
        status: 'error',
        message: 'Failed to submit template',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const updateFormData = (updates: Partial<TemplateFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      updateFormData({
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateFormData({
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const addDependency = () => {
    if (newDependency.name.trim() && newDependency.version.trim()) {
      updateFormData({
        dependencies: {
          ...formData.dependencies,
          [newDependency.name.trim()]: newDependency.version.trim()
        }
      });
      setNewDependency({ name: '', version: '' });
    }
  };

  const removeDependency = (depName: string) => {
    const newDeps = { ...formData.dependencies };
    delete newDeps[depName];
    updateFormData({ dependencies: newDeps });
  };

  const addScript = () => {
    if (newScript.name.trim() && newScript.command.trim()) {
      updateFormData({
        scripts: {
          ...formData.scripts,
          [newScript.name.trim()]: newScript.command.trim()
        }
      });
      setNewScript({ name: '', command: '' });
    }
  };

  const removeScript = (scriptName: string) => {
    const newScripts = { ...formData.scripts };
    delete newScripts[scriptName];
    updateFormData({ scripts: newScripts });
  };

  const addEnvVar = () => {
    if (newEnvVar.name.trim()) {
      updateFormData({
        envVars: [
          ...formData.envVars,
          {
            name: newEnvVar.name.trim(),
            defaultValue: newEnvVar.defaultValue.trim() || undefined,
            description: newEnvVar.description.trim() || undefined
          }
        ]
      });
      setNewEnvVar({ name: '', defaultValue: '', description: '' });
    }
  };

  const removeEnvVar = (index: number) => {
    updateFormData({
      envVars: formData.envVars.filter((_, i) => i !== index)
    });
  };

  const updateDocumentation = (section: keyof TemplateFormData['documentation'], value: string) => {
    const lines = value.split('\n').filter(line => line.trim());
    updateFormData({
      documentation: {
        ...formData.documentation,
        [section]: lines
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Submit New Template
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Share your project template with the community
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {/* Basic Information */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
            Basic Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="My Awesome Template"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe what your template does and who it's for..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => updateFormData({ category: e.target.value as any })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                value={formData.language}
                onChange={(e) => updateFormData({ language: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {languages.map(lang => (
                  <option key={lang} value={lang}>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Framework
              </label>
              <select
                value={formData.framework}
                onChange={(e) => updateFormData({ framework: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {frameworks.map(framework => (
                  <option key={framework} value={framework}>
                    {framework.charAt(0).toUpperCase() + framework.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Complexity
              </label>
              <select
                value={formData.complexity}
                onChange={(e) => updateFormData({ complexity: e.target.value as any })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add a tag..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Dependencies */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
            Dependencies
          </h3>

          <div className="space-y-2">
            {Object.entries(formData.dependencies).map(([name, version]) => (
              <div key={name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="font-mono text-sm">{name}: {version}</span>
                <button
                  type="button"
                  onClick={() => removeDependency(name)}
                  className="text-red-600 hover:text-red-800"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Package name"
              value={newDependency.name}
              onChange={(e) => setNewDependency(prev => ({ ...prev, name: e.target.value }))}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Version"
              value={newDependency.version}
              onChange={(e) => setNewDependency(prev => ({ ...prev, version: e.target.value }))}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={addDependency}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>

        {/* Scripts */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
            Scripts
          </h3>

          <div className="space-y-2">
            {Object.entries(formData.scripts).map(([name, command]) => (
              <div key={name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="font-mono text-sm">{name}: {command}</span>
                <button
                  type="button"
                  onClick={() => removeScript(name)}
                  className="text-red-600 hover:text-red-800"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Script name"
              value={newScript.name}
              onChange={(e) => setNewScript(prev => ({ ...prev, name: e.target.value }))}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Command"
              value={newScript.command}
              onChange={(e) => setNewScript(prev => ({ ...prev, command: e.target.value }))}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={addScript}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>

        {/* Environment Variables */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
            Environment Variables
          </h3>

          <div className="space-y-2">
            {formData.envVars.map((envVar, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex-1">
                  <span className="font-mono text-sm font-medium">{envVar.name}</span>
                  {envVar.description && (
                    <p className="text-xs text-gray-600 mt-1">{envVar.description}</p>
                  )}
                  {envVar.defaultValue && (
                    <p className="text-xs text-gray-500">Default: {envVar.defaultValue}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeEnvVar(index)}
                  className="text-red-600 hover:text-red-800 ml-2"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Variable name"
              value={newEnvVar.name}
              onChange={(e) => setNewEnvVar(prev => ({ ...prev, name: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Default value"
              value={newEnvVar.defaultValue}
              onChange={(e) => setNewEnvVar(prev => ({ ...prev, defaultValue: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Description"
              value={newEnvVar.description}
              onChange={(e) => setNewEnvVar(prev => ({ ...prev, description: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={addEnvVar}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Environment Variable
          </button>
        </div>

        {/* Documentation */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
            Documentation
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Setup Instructions
              </label>
              <textarea
                value={formData.documentation.setup.join('\n')}
                onChange={(e) => updateDocumentation('setup', e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Step-by-step setup instructions..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usage Guide
              </label>
              <textarea
                value={formData.documentation.usage.join('\n')}
                onChange={(e) => updateDocumentation('usage', e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="How to use the template..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deployment Guide
              </label>
              <textarea
                value={formData.documentation.deployment.join('\n')}
                onChange={(e) => updateDocumentation('deployment', e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Deployment instructions..."
              />
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
            Features
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { key: 'dockerSupport', label: 'Docker Support' },
              { key: 'kubernetesSupport', label: 'Kubernetes Support' },
              { key: 'cicdTemplate', label: 'CI/CD Template' },
              { key: 'testingSetup', label: 'Testing Setup' },
              { key: 'monitoringSetup', label: 'Monitoring Setup' }
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData[key as keyof TemplateFormData] as boolean}
                  onChange={(e) => updateFormData({ [key]: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Submission Status */}
        {submissionStatus.status !== 'idle' && (
          <div className="border-t border-gray-200 pt-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {submissionStatus.status === 'success' && (
                    <CheckCircleIcon className="h-6 w-6 text-green-600" />
                  )}
                  {submissionStatus.status === 'error' && (
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                  )}
                  {(submissionStatus.status === 'uploading' || submissionStatus.status === 'processing') && (
                    <ArrowUpTrayIcon className="h-6 w-6 text-blue-600 animate-pulse" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{submissionStatus.message}</p>
                  {submissionStatus.progress !== undefined && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${submissionStatus.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {submissionStatus.error && (
                    <p className="text-sm text-red-600 mt-2">{submissionStatus.error}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {submissionStatus.status === 'success'
              ? 'Template submitted successfully!'
              : 'Fill in all required fields to submit your template'
            }
          </div>
          <div className="flex space-x-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submissionStatus.status === 'uploading' || submissionStatus.status === 'processing'}
              onClick={handleSubmit}
              className={`px-4 py-2 rounded-md font-medium ${
                submissionStatus.status === 'uploading' || submissionStatus.status === 'processing'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {submissionStatus.status === 'uploading' || submissionStatus.status === 'processing' ? (
                <>
                  <ArrowUpTrayIcon className="h-4 w-4 animate-pulse mr-2 inline" />
                  Submitting...
                </>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4 mr-2 inline" />
                  Submit Template
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
