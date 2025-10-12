/**
 * Template Deployment Integration Component
 * Handles deployment of templates to various hosting platforms
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  XMarkIcon,
  GlobeAltIcon,
  ServerIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline';

interface DeploymentPlatform {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  supportedLanguages: string[];
  features: string[];
  pricing: 'free' | 'paid';
}

interface DeploymentConfig {
  platform: string;
  projectName: string;
  environment: 'development' | 'staging' | 'production';
  region?: string;
  buildSettings?: {
    buildCommand?: string;
    outputDirectory?: string;
    nodeVersion?: string;
  };
  environmentVariables?: Array<{
    name: string;
    value: string;
    description?: string;
  }>;
  domain?: {
    customDomain?: string;
    subdomain?: string;
  };
}

interface DeploymentStatus {
  status: 'idle' | 'preparing' | 'building' | 'deploying' | 'success' | 'error';
  message: string;
  progress?: number;
  deploymentUrl?: string;
  logs?: string[];
  error?: string;
}

interface TemplateDeploymentIntegrationProps {
  template: {
    id: string;
    name: string;
    language: string;
    framework: string;
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    envVars?: Array<{
      name: string;
      defaultValue?: string;
      description?: string;
    }>;
    documentation?: {
      setup?: string[];
      deployment?: string[];
    };
  };
  onClose?: () => void;
  onDeploymentComplete?: (result: { success: boolean; url?: string; error?: string }) => void;
}

export function TemplateDeploymentIntegration({
  template,
  onClose,
  onDeploymentComplete
}: TemplateDeploymentIntegrationProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig>({
    platform: '',
    projectName: template.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    environment: 'development'
  });
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>({
    status: 'idle',
    message: 'Ready to deploy'
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const availablePlatforms: DeploymentPlatform[] = [
    {
      id: 'vercel',
      name: 'Vercel',
      description: 'Deploy web applications with zero configuration',
      icon: <GlobeAltIcon className="h-6 w-6" />,
      supportedLanguages: ['javascript', 'typescript'],
      features: ['Zero configuration', 'Global CDN', 'Serverless functions'],
      pricing: 'free'
    },
    {
      id: 'netlify',
      name: 'Netlify',
      description: 'Deploy modern web projects with continuous deployment',
      icon: <ServerIcon className="h-6 w-6" />,
      supportedLanguages: ['javascript', 'typescript', 'react', 'vue', 'angular'],
      features: ['Continuous deployment', 'Form handling', 'Serverless functions'],
      pricing: 'free'
    },
    {
      id: 'railway',
      name: 'Railway',
      description: 'Deploy full-stack applications with databases',
      icon: <ServerIcon className="h-6 w-6" />,
      supportedLanguages: ['javascript', 'typescript', 'python', 'go', 'rust'],
      features: ['Full-stack deployment', 'Database integration', 'Custom domains'],
      pricing: 'free'
    }
  ];

  const filteredPlatforms = availablePlatforms.filter(platform =>
    platform.supportedLanguages.includes(template.language.toLowerCase())
  );

  const handlePlatformSelect = (platformId: string) => {
    setSelectedPlatform(platformId);
    setDeploymentConfig(prev => ({
      ...prev,
      platform: platformId
    }));
  };

  const handleDeploy = async () => {
    if (!selectedPlatform) return;

    setDeploymentStatus({
      status: 'preparing',
      message: 'Preparing deployment...'
    });

    try {
      // Prepare deployment data
      const deploymentData = {
        templateId: template.id,
        config: deploymentConfig,
        timestamp: new Date().toISOString()
      };

      // This would integrate with your deployment service
      // For now, simulate deployment process
      await simulateDeployment(deploymentData);

      setDeploymentStatus({
        status: 'success',
        message: 'Deployment completed successfully!',
        deploymentUrl: `https://${deploymentConfig.projectName}.vercel.app`
      });

      onDeploymentComplete?.({
        success: true,
        url: `https://${deploymentConfig.projectName}.vercel.app`
      });

    } catch (error) {
      setDeploymentStatus({
        status: 'error',
        message: 'Deployment failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      onDeploymentComplete?.({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const simulateDeployment = async (deploymentData: any): Promise<void> => {
    // Simulate deployment steps
    const steps = [
      { status: 'preparing', message: 'Preparing deployment package...', duration: 1000 },
      { status: 'building', message: 'Building application...', duration: 3000 },
      { status: 'deploying', message: 'Deploying to platform...', duration: 2000 }
    ];

    for (const step of steps) {
      setDeploymentStatus({
        status: step.status as any,
        message: step.message,
        progress: Math.round((steps.indexOf(step) + 1) / steps.length * 100)
      });

      await new Promise(resolve => setTimeout(resolve, step.duration));
    }
  };

  const updateConfig = (updates: Partial<DeploymentConfig>) => {
    setDeploymentConfig(prev => ({ ...prev, ...updates }));
  };

  const renderStars = (rating: number, size = 4) => {
    const stars = [];

    for (let i = 1; i <= 5; i++) {
      if (i <= rating) {
        stars.push(
          <span key={i} className={`text-${size === 4 ? 'sm' : size === 5 ? 'base' : 'lg'} text-yellow-400`}>
            ★
          </span>
        );
      } else {
        stars.push(
          <span key={i} className={`text-${size === 4 ? 'sm' : size === 5 ? 'base' : 'lg'} text-gray-300`}>
            ★
          </span>
        );
      }
    }

    return stars;
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Deploy {template.name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Choose a deployment platform and configure your deployment settings
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Template Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <CodeBracketIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{template.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{template.language} • {template.framework}</p>
              {template.dependencies && Object.keys(template.dependencies).length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">
                    {Object.keys(template.dependencies).length} dependencies
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Platform Selection */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Choose Deployment Platform</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredPlatforms.map((platform) => (
              <div
                key={platform.id}
                className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedPlatform === platform.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => handlePlatformSelect(platform.id)}
              >
                <div className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 ${selectedPlatform === platform.id ? 'text-blue-600' : 'text-gray-600'}`}>
                    {platform.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-gray-900">{platform.name}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        platform.pricing === 'free'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {platform.pricing}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{platform.description}</p>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">Features:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {platform.features.slice(0, 2).map((feature, index) => (
                          <span
                            key={index}
                            className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {selectedPlatform === platform.id && (
                  <div className="absolute top-2 right-2">
                    <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Deployment Configuration */}
        {selectedPlatform && (
          <div className="space-y-6">
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Deployment Configuration</h3>

              {/* Basic Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={deploymentConfig.projectName}
                    onChange={(e) => updateConfig({ projectName: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="my-awesome-project"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Environment
                  </label>
                  <select
                    value={deploymentConfig.environment}
                    onChange={(e) => updateConfig({ environment: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div className="mb-4">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                </button>
              </div>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Build Command
                      </label>
                      <input
                        type="text"
                        value={deploymentConfig.buildSettings?.buildCommand || ''}
                        onChange={(e) => updateConfig({
                          buildSettings: {
                            ...deploymentConfig.buildSettings,
                            buildCommand: e.target.value
                          }
                        })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="npm run build"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Output Directory
                      </label>
                      <input
                        type="text"
                        value={deploymentConfig.buildSettings?.outputDirectory || ''}
                        onChange={(e) => updateConfig({
                          buildSettings: {
                            ...deploymentConfig.buildSettings,
                            outputDirectory: e.target.value
                          }
                        })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="dist"
                      />
                    </div>
                  </div>

                  {/* Environment Variables */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Environment Variables
                    </label>
                    <div className="space-y-2">
                      {template.envVars?.map((envVar, index) => (
                        <div key={index} className="flex space-x-2">
                          <input
                            type="text"
                            placeholder="Variable name"
                            defaultValue={envVar.name}
                            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <input
                            type="text"
                            placeholder="Value"
                            defaultValue={envVar.defaultValue || ''}
                            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deployment Status */}
        {deploymentStatus.status !== 'idle' && (
          <div className="border-t border-gray-200 pt-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {deploymentStatus.status === 'success' && (
                    <CheckCircleIcon className="h-6 w-6 text-green-600" />
                  )}
                  {deploymentStatus.status === 'error' && (
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                  )}
                  {deploymentStatus.status === 'preparing' && (
                    <ArrowPathIcon className="h-6 w-6 text-blue-600 animate-spin" />
                  )}
                  {(deploymentStatus.status === 'building' || deploymentStatus.status === 'deploying') && (
                    <ArrowPathIcon className="h-6 w-6 text-blue-600 animate-spin" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{deploymentStatus.message}</p>
                  {deploymentStatus.progress !== undefined && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${deploymentStatus.progress}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {deploymentStatus.progress}% complete
                      </p>
                    </div>
                  )}
                  {deploymentStatus.deploymentUrl && (
                    <div className="mt-3">
                      <a
                        href={deploymentStatus.deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Deployment →
                      </a>
                    </div>
                  )}
                  {deploymentStatus.error && (
                    <p className="text-sm text-red-600 mt-2">{deploymentStatus.error}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documentation */}
        {template.documentation && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Documentation</h3>

            {template.documentation.setup && template.documentation.setup.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Setup Instructions</h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {Array.isArray(template.documentation.setup)
                      ? template.documentation.setup.join('\n')
                      : template.documentation.setup}
                  </pre>
                </div>
              </div>
            )}

            {template.documentation.deployment && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Deployment Guide</h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {Array.isArray(template.documentation.deployment)
                      ? template.documentation.deployment.join('\n')
                      : template.documentation.deployment}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedPlatform ? (
              <span className="text-green-600 font-medium">
                Ready to deploy to {availablePlatforms.find(p => p.id === selectedPlatform)?.name}
              </span>
            ) : (
              'Select a deployment platform to continue'
            )}
          </div>
          <div className="flex space-x-3">
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleDeploy}
              disabled={!selectedPlatform || deploymentStatus.status === 'preparing' || deploymentStatus.status === 'building' || deploymentStatus.status === 'deploying'}
              className={`px-4 py-2 rounded-md font-medium ${
                selectedPlatform && deploymentStatus.status === 'idle'
                  ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {deploymentStatus.status === 'preparing' || deploymentStatus.status === 'building' || deploymentStatus.status === 'deploying' ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin mr-2 inline" />
                  Deploying...
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="h-4 w-4 mr-2 inline" />
                  Deploy Template
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
