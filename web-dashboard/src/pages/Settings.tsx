import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Shield,
  Database,
  Network,
  Bell,
  Users,
  Palette,
  Globe,
  Lock,
  Key,
  Server,
  Monitor,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'
import { metricsApi } from '../services/api'

interface SettingsSection {
  id: string
  title: string
  description: string
  icon: any
}

export function Settings() {
  const [activeSection, setActiveSection] = useState('general')
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: metricsApi.getSettings
  })

  const updateSettingsMutation = useMutation({
    mutationFn: metricsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    }
  })

  const sections: SettingsSection[] = [
    {
      id: 'general',
      title: 'General',
      description: 'Basic platform configuration',
      icon: SettingsIcon
    },
    {
      id: 'authentication',
      title: 'Authentication',
      description: 'User authentication and security',
      icon: Shield
    },
    {
      id: 'cluster',
      title: 'Cluster',
      description: 'Kubernetes cluster settings',
      icon: Server
    },
    {
      id: 'ai',
      title: 'AI Gateway',
      description: 'AI model and provider configuration',
      icon: Network
    },
    {
      id: 'monitoring',
      title: 'Monitoring',
      description: 'Metrics and observability',
      icon: Monitor
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Alert and notification settings',
      icon: Bell
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'Default user and workspace settings',
      icon: Users
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'UI theme and customization',
      icon: Palette
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-sm text-gray-700">
            Configure platform settings and preferences.
          </p>
        </div>
        <button
          onClick={() => updateSettingsMutation.mutate(settings)}
          disabled={updateSettingsMutation.isPending || !settings}
          className="btn-primary"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-3">
          <nav className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-700 border-primary-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">{section.title}</div>
                    <div className="text-xs text-gray-500">{section.description}</div>
                  </div>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="col-span-12 lg:col-span-9">
          {isLoading ? (
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card p-6 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {activeSection === 'general' && <GeneralSettings settings={settings} />}
              {activeSection === 'authentication' && <AuthenticationSettings settings={settings} />}
              {activeSection === 'cluster' && <ClusterSettings settings={settings} />}
              {activeSection === 'ai' && <AISettings settings={settings} />}
              {activeSection === 'monitoring' && <MonitoringSettings settings={settings} />}
              {activeSection === 'notifications' && <NotificationSettings settings={settings} />}
              {activeSection === 'users' && <UserSettings settings={settings} />}
              {activeSection === 'appearance' && <AppearanceSettings settings={settings} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GeneralSettings({ settings }: { settings: any }) {
  return (
    <>
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Platform Name</label>
            <input
              type="text"
              defaultValue={settings?.platform?.name || 'VibeCode WebGUI'}
              className="input"
            />
          </div>
          <div>
            <label className="label">Environment</label>
            <select defaultValue={settings?.platform?.environment || 'development'} className="input">
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div>
            <label className="label">Default Language</label>
            <select defaultValue={settings?.platform?.language || 'en'} className="input">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
          <div>
            <label className="label">Timezone</label>
            <select defaultValue={settings?.platform?.timezone || 'UTC'} className="input">
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Data Retention</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Logs Retention (days)</label>
            <input
              type="number"
              defaultValue={settings?.retention?.logs || 30}
              className="input"
            />
          </div>
          <div>
            <label className="label">Metrics Retention (days)</label>
            <input
              type="number"
              defaultValue={settings?.retention?.metrics || 90}
              className="input"
            />
          </div>
          <div>
            <label className="label">Workspace Backup Retention (days)</label>
            <input
              type="number"
              defaultValue={settings?.retention?.backups || 14}
              className="input"
            />
          </div>
          <div>
            <label className="label">Inactive Workspace Cleanup (days)</label>
            <input
              type="number"
              defaultValue={settings?.retention?.inactive || 7}
              className="input"
            />
          </div>
        </div>
      </div>
    </>
  )
}

function AuthenticationSettings({ settings }: { settings: any }) {
  return (
    <>
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Authelia Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-sm text-green-800">Authelia is configured and running</span>
            </div>
            <button className="text-sm text-green-700 hover:text-green-800">View Status</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Session Timeout (hours)</label>
              <input
                type="number"
                defaultValue={settings?.auth?.sessionTimeout || 24}
                className="input"
              />
            </div>
            <div>
              <label className="label">Max Login Attempts</label>
              <input
                type="number"
                defaultValue={settings?.auth?.maxAttempts || 5}
                className="input"
              />
            </div>
            <div>
              <label className="label">Password Policy</label>
              <select defaultValue={settings?.auth?.passwordPolicy || 'strong'} className="input">
                <option value="basic">Basic (8+ characters)</option>
                <option value="strong">Strong (12+ chars, mixed case, numbers)</option>
                <option value="enterprise">Enterprise (16+ chars, special chars)</option>
              </select>
            </div>
            <div>
              <label className="label">Two-Factor Authentication</label>
              <select defaultValue={settings?.auth?.twoFactor || 'optional'} className="input">
                <option value="disabled">Disabled</option>
                <option value="optional">Optional</option>
                <option value="required">Required</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">OAuth Providers</h3>
        <div className="space-y-4">
          {['GitHub', 'Google', 'Microsoft'].map((provider) => (
            <div key={provider} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <Globe className="h-5 w-5 text-gray-400 mr-3" />
                <span className="text-sm font-medium text-gray-900">{provider}</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked={false} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function ClusterSettings({ settings }: { settings: any }) {
  return (
    <>
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Kubernetes Cluster</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Cluster Name</label>
            <input
              type="text"
              defaultValue={settings?.cluster?.name || 'vibecode-cluster'}
              className="input"
              readOnly
            />
          </div>
          <div>
            <label className="label">Kubernetes Version</label>
            <input
              type="text"
              defaultValue={settings?.cluster?.version || 'v1.28.0'}
              className="input"
              readOnly
            />
          </div>
          <div>
            <label className="label">Default Namespace</label>
            <input
              type="text"
              defaultValue={settings?.cluster?.namespace || 'vibecode'}
              className="input"
            />
          </div>
          <div>
            <label className="label">Ingress Class</label>
            <input
              type="text"
              defaultValue={settings?.cluster?.ingressClass || 'nginx'}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Resource Limits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Default CPU Limit</label>
            <input
              type="text"
              defaultValue={settings?.cluster?.limits?.cpu || '2'}
              className="input"
            />
          </div>
          <div>
            <label className="label">Default Memory Limit</label>
            <input
              type="text"
              defaultValue={settings?.cluster?.limits?.memory || '4Gi'}
              className="input"
            />
          </div>
          <div>
            <label className="label">Default Storage Limit</label>
            <input
              type="text"
              defaultValue={settings?.cluster?.limits?.storage || '10Gi'}
              className="input"
            />
          </div>
          <div>
            <label className="label">Max Workspaces per User</label>
            <input
              type="number"
              defaultValue={settings?.cluster?.limits?.workspaces || 5}
              className="input"
            />
          </div>
        </div>
      </div>
    </>
  )
}

function AISettings({ settings }: { settings: any }) {
  return (
    <>
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">OpenRouter Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-sm text-green-800">AI Gateway is running with 127 models</span>
            </div>
            <button className="text-sm text-green-700 hover:text-green-800">Test Connection</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">API Key</label>
              <div className="relative">
                <input
                  type="password"
                  defaultValue="sk-or-v1-****************"
                  className="input"
                />
                <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="label">Default Model</label>
              <select defaultValue={settings?.ai?.defaultModel || 'anthropic/claude-3-sonnet'} className="input">
                <option value="anthropic/claude-3-sonnet">Claude 3 Sonnet</option>
                <option value="openai/gpt-4-turbo">GPT-4 Turbo</option>
                <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
              </select>
            </div>
            <div>
              <label className="label">Request Timeout (seconds)</label>
              <input
                type="number"
                defaultValue={settings?.ai?.timeout || 30}
                className="input"
              />
            </div>
            <div>
              <label className="label">Max Tokens per Request</label>
              <input
                type="number"
                defaultValue={settings?.ai?.maxTokens || 4096}
                className="input"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Limits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Daily Requests per User</label>
            <input
              type="number"
              defaultValue={settings?.ai?.limits?.dailyRequests || 1000}
              className="input"
            />
          </div>
          <div>
            <label className="label">Monthly Cost Limit per User ($)</label>
            <input
              type="number"
              defaultValue={settings?.ai?.limits?.monthlyCost || 100}
              className="input"
            />
          </div>
          <div>
            <label className="label">Rate Limit (requests/minute)</label>
            <input
              type="number"
              defaultValue={settings?.ai?.limits?.rateLimit || 60}
              className="input"
            />
          </div>
          <div>
            <label className="label">Cache TTL (hours)</label>
            <input
              type="number"
              defaultValue={settings?.ai?.cache?.ttl || 24}
              className="input"
            />
          </div>
        </div>
      </div>
    </>
  )
}

function MonitoringSettings({ settings }: { settings: any }) {
  return (
    <>
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Metrics Collection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Metrics Interval (seconds)</label>
            <input
              type="number"
              defaultValue={settings?.monitoring?.interval || 15}
              className="input"
            />
          </div>
          <div>
            <label className="label">Log Level</label>
            <select defaultValue={settings?.monitoring?.logLevel || 'info'} className="input">
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label className="label">Enable Tracing</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked={settings?.monitoring?.tracing || false} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div>
            <label className="label">Enable Profiling</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked={settings?.monitoring?.profiling || false} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">External Monitoring</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <Info className="h-5 w-5 text-blue-600 mr-2" />
              <span className="text-sm text-blue-800">Datadog integration configured</span>
            </div>
            <button className="text-sm text-blue-700 hover:text-blue-800">Test Connection</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Datadog API Key</label>
              <div className="relative">
                <input
                  type="password"
                  defaultValue="****************"
                  className="input"
                />
                <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="label">Datadog Site</label>
              <select defaultValue={settings?.monitoring?.datadog?.site || 'datadoghq.com'} className="input">
                <option value="datadoghq.com">US1 (datadoghq.com)</option>
                <option value="us3.datadoghq.com">US3 (us3.datadoghq.com)</option>
                <option value="datadoghq.eu">EU (datadoghq.eu)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function NotificationSettings({ settings }: { settings: any }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Alert Channels</h3>
      <div className="space-y-4">
        {[
          { name: 'Email', icon: Bell, enabled: true },
          { name: 'Slack', icon: Bell, enabled: false },
          { name: 'Discord', icon: Bell, enabled: false },
          { name: 'PagerDuty', icon: AlertTriangle, enabled: false }
        ].map((channel) => (
          <div key={channel.name} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center">
              <channel.icon className="h-5 w-5 text-gray-400 mr-3" />
              <span className="text-sm font-medium text-gray-900">{channel.name}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked={channel.enabled} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

function UserSettings({ settings }: { settings: any }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Default User Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="label">Default Role</label>
          <select defaultValue={settings?.users?.defaultRole || 'developer'} className="input">
            <option value="viewer">Viewer</option>
            <option value="developer">Developer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="label">Auto-provision Workspace</label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" defaultChecked={settings?.users?.autoProvision || true} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>
  )
}

function AppearanceSettings({ settings }: { settings: any }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Theme and Branding</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="label">Theme</label>
          <select defaultValue={settings?.appearance?.theme || 'light'} className="input">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>
        <div>
          <label className="label">Primary Color</label>
          <input
            type="color"
            defaultValue={settings?.appearance?.primaryColor || '#3b82f6'}
            className="input h-12"
          />
        </div>
      </div>
    </div>
  )
}
