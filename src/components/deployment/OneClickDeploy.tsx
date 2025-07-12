/**
 * One-Click Deployment Component
 * Enables instant deployment to popular cloud platforms
 */

'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Cloud, 
  Zap, 
  ExternalLink, 
  Copy, 
  Check,
  AlertCircle,
  Globe,
  Server,
  Rocket,
  Settings
} from 'lucide-react'

// Deployment platform configurations
const DEPLOYMENT_PLATFORMS = [
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deploy instantly to Vercel with automatic HTTPS and global CDN',
    icon: '▲',
    color: 'black',
    deployUrl: 'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-repo%2Fvibecode-webgui&env=OPENROUTER_API_KEY,NEXTAUTH_SECRET&envDescription=API%20keys%20required%20for%20AI%20chat%20functionality&envLink=https%3A%2F%2Fgithub.com%2Fyour-repo%2Fvibecode-webgui%23environment-variables',
    features: ['Instant deployment', 'Automatic HTTPS', 'Global CDN', 'Serverless functions'],
    estimatedTime: '2-3 minutes',
    complexity: 'Easy',
    envVars: ['OPENROUTER_API_KEY', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
    pros: ['Zero configuration', 'Excellent performance', 'Built-in analytics'],
    cons: ['Function timeout limits', 'Cold starts'],
    pricing: 'Free tier available'
  },
  {
    id: 'netlify',
    name: 'Netlify',
    description: 'Deploy to Netlify with continuous deployment and branch previews',
    icon: '🌐',
    color: 'teal',
    deployUrl: 'https://app.netlify.com/start/deploy?repository=https://github.com/your-repo/vibecode-webgui',
    features: ['Continuous deployment', 'Branch previews', 'Form handling', 'Identity management'],
    estimatedTime: '3-5 minutes',
    complexity: 'Easy',
    envVars: ['OPENROUTER_API_KEY', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
    pros: ['Great developer experience', 'Excellent documentation', 'Built-in forms'],
    cons: ['Function limitations', 'Build time limits'],
    pricing: 'Free tier available'
  },
  {
    id: 'railway',
    name: 'Railway',
    description: 'Deploy to Railway with automatic database provisioning and scaling',
    icon: '🚄',
    color: 'purple',
    deployUrl: 'https://railway.app/new/template?template=https%3A%2F%2Fgithub.com%2Fyour-repo%2Fvibecode-webgui',
    features: ['Auto database provisioning', 'Horizontal scaling', 'Built-in monitoring', 'Custom domains'],
    estimatedTime: '5-7 minutes',
    complexity: 'Medium',
    envVars: ['OPENROUTER_API_KEY', 'NEXTAUTH_SECRET', 'DATABASE_URL', 'REDIS_URL'],
    pros: ['Full-stack support', 'Database included', 'Easy scaling'],
    cons: ['More complex setup', 'Higher resource usage'],
    pricing: 'Usage-based pricing'
  },
  {
    id: 'render',
    name: 'Render',
    description: 'Deploy to Render with automatic SSL and global CDN',
    icon: '🎨',
    color: 'green',
    deployUrl: 'https://render.com/deploy?repo=https://github.com/your-repo/vibecode-webgui',
    features: ['Automatic SSL', 'Global CDN', 'Database hosting', 'Static site hosting'],
    estimatedTime: '4-6 minutes',
    complexity: 'Medium',
    envVars: ['OPENROUTER_API_KEY', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
    pros: ['Full-stack platform', 'Reasonable pricing', 'Good performance'],
    cons: ['Smaller ecosystem', 'Limited regions'],
    pricing: 'Free tier with limits'
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean App Platform',
    description: 'Deploy to DigitalOcean with managed infrastructure and databases',
    icon: '🌊',
    color: 'blue',
    deployUrl: 'https://cloud.digitalocean.com/apps/new?repo=https://github.com/your-repo/vibecode-webgui',
    features: ['Managed databases', 'Auto-scaling', 'Load balancing', 'Container support'],
    estimatedTime: '5-8 minutes',
    complexity: 'Medium',
    envVars: ['OPENROUTER_API_KEY', 'NEXTAUTH_SECRET', 'DATABASE_URL', 'REDIS_URL'],
    pros: ['Enterprise features', 'Good documentation', 'Predictable pricing'],
    cons: ['More setup required', 'Higher minimum cost'],
    pricing: 'Starts at $5/month'
  }
]

// Environment variable templates
const ENV_TEMPLATES = {
  development: {
    NEXTAUTH_URL: 'http://localhost:3000',
    NODE_ENV: 'development',
    OPENROUTER_API_KEY: 'your-openrouter-api-key-here',
    NEXTAUTH_SECRET: 'your-nextauth-secret-here'
  },
  production: {
    NEXTAUTH_URL: 'https://your-app-domain.com',
    NODE_ENV: 'production',
    OPENROUTER_API_KEY: 'your-openrouter-api-key-here',
    NEXTAUTH_SECRET: 'your-nextauth-secret-here'
  }
}

interface OneClickDeployProps {
  className?: string
}

export default function OneClickDeploy({ className = '' }: OneClickDeployProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [copiedEnv, setCopiedEnv] = useState<string | null>(null)
  const [showEnvTemplate, setShowEnvTemplate] = useState(false)

  const handleDeploy = (platform: any) => {
    // Track deployment initiation
    if (typeof window !== 'undefined') {
      window.gtag?.('event', 'deploy_initiated', {
        platform: platform.id,
        complexity: platform.complexity
      })
    }
    
    // Open deployment URL in new tab
    window.open(platform.deployUrl, '_blank')
  }

  const copyEnvTemplate = (envType: 'development' | 'production') => {
    const template = Object.entries(ENV_TEMPLATES[envType])
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
    
    navigator.clipboard.writeText(template)
    setCopiedEnv(envType)
    setTimeout(() => setCopiedEnv(null), 2000)
  }

  const generateDeploymentGuide = (platform: any) => {
    return `
# Deploy VibeCode to ${platform.name}

## Prerequisites
1. Fork the repository to your GitHub account
2. Get your OpenRouter API key from https://openrouter.ai/
3. Generate a secure NextAuth secret

## Environment Variables
${platform.envVars.map(env => `- ${env}`).join('\n')}

## Deployment Steps
1. Click the "Deploy to ${platform.name}" button
2. Connect your GitHub account
3. Select the forked repository
4. Add environment variables
5. Deploy!

Estimated time: ${platform.estimatedTime}
Complexity: ${platform.complexity}
    `.trim()
  }

  const copyDeploymentGuide = (platform: any) => {
    const guide = generateDeploymentGuide(platform)
    navigator.clipboard.writeText(guide)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <Rocket className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold">One-Click Deployment</h2>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Deploy your VibeCode platform instantly to popular cloud providers. 
          Choose your preferred platform and get started in minutes.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex justify-center space-x-4">
        <Button
          variant="outline"
          onClick={() => setShowEnvTemplate(!showEnvTemplate)}
        >
          <Settings className="w-4 h-4 mr-2" />
          Environment Setup
        </Button>
        <Button
          variant="outline"
          onClick={() => window.open('https://github.com/your-repo/vibecode-webgui', '_blank')}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          View Source Code
        </Button>
      </div>

      {/* Environment Template */}
      {showEnvTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Environment Variables Template</span>
            </CardTitle>
            <p className="text-sm text-gray-600">
              Copy these templates and update with your actual values before deployment.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Development</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyEnvTemplate('development')}
                  >
                    {copiedEnv === 'development' ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                  {Object.entries(ENV_TEMPLATES.development)
                    .map(([key, value]) => `${key}=${value}`)
                    .join('\n')}
                </pre>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Production</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyEnvTemplate('production')}
                  >
                    {copiedEnv === 'production' ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                  {Object.entries(ENV_TEMPLATES.production)
                    .map(([key, value]) => `${key}=${value}`)
                    .join('\n')}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platform Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DEPLOYMENT_PLATFORMS.map((platform) => (
          <Card 
            key={platform.id} 
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedPlatform === platform.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedPlatform(
              selectedPlatform === platform.id ? null : platform.id
            )}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{platform.icon}</div>
                  <div>
                    <CardTitle className="text-lg">{platform.name}</CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge 
                        variant={platform.complexity === 'Easy' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {platform.complexity}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {platform.estimatedTime}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {platform.description}
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Features */}
              <div>
                <h4 className="font-medium text-sm mb-2">Features</h4>
                <div className="flex flex-wrap gap-1">
                  {platform.features.slice(0, 3).map((feature, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {platform.features.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{platform.features.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Deploy Button */}
              <Button 
                className="w-full" 
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeploy(platform)
                }}
              >
                <Zap className="w-4 h-4 mr-2" />
                Deploy to {platform.name}
              </Button>

              {/* Additional Actions */}
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    copyDeploymentGuide(platform)
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy Guide
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(platform.deployUrl, '_blank')
                  }}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Manual
                </Button>
              </div>

              {/* Expanded Details */}
              {selectedPlatform === platform.id && (
                <div className="border-t pt-4 space-y-3">
                  <div>
                    <h5 className="font-medium text-sm mb-2">Required Environment Variables</h5>
                    <div className="space-y-1">
                      {platform.envVars.map((envVar) => (
                        <code key={envVar} className="block text-xs bg-gray-100 p-1 rounded">
                          {envVar}
                        </code>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <h5 className="font-medium text-sm mb-1 text-green-600">Pros</h5>
                      <ul className="text-xs space-y-1">
                        {platform.pros.map((pro, index) => (
                          <li key={index} className="flex items-start">
                            <Check className="w-3 h-3 text-green-500 mr-1 mt-0.5 flex-shrink-0" />
                            {pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-sm mb-1 text-orange-600">Considerations</h5>
                      <ul className="text-xs space-y-1">
                        {platform.cons.map((con, index) => (
                          <li key={index} className="flex items-start">
                            <AlertCircle className="w-3 h-3 text-orange-500 mr-1 mt-0.5 flex-shrink-0" />
                            {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600">
                    <strong>Pricing:</strong> {platform.pricing}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <span>Before You Deploy</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Required API Keys</h4>
              <ul className="text-sm space-y-1">
                <li>• <strong>OpenRouter API Key:</strong> Get from <a href="https://openrouter.ai" target="_blank" className="text-blue-600 hover:underline">openrouter.ai</a></li>
                <li>• <strong>NextAuth Secret:</strong> Generate a secure random string</li>
                <li>• <strong>Database URL:</strong> Some platforms provide this automatically</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Recommended Setup</h4>
              <ul className="text-sm space-y-1">
                <li>• Fork the repository to your GitHub account</li>
                <li>• Set up your API keys beforehand</li>
                <li>• Test locally with <code className="bg-gray-100 px-1 rounded">npm run dev</code></li>
                <li>• Choose a platform based on your technical requirements</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}