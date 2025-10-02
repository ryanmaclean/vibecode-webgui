@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment (dev, staging, production)')
@allowed(['dev', 'staging', 'production'])
param environment string = 'production'

@description('App Service plan name')
param planName string = 'plan-vibecode-docs-${environment}'

@description('Web App name')
param appName string = 'vibecode-docs-next-${environment}'

@description('Container image to deploy')
param containerImage string

@description('Key Vault name for secrets')
param keyVaultName string = 'kv-vibecode-docs-${environment}'

@description('App Service plan SKU')
@allowed(['B1', 'P1v3', 'P2v3'])
param skuName string = 'P1v3'

@description('Enable staging slot for blue-green deployments')
param enableStagingSlot bool = true

@description('Datadog site (datadoghq.com, datadoghq.eu, etc.)')
param datadogSite string = 'datadoghq.com'

@description('Datadog service name')
param datadogService string = 'vibecode-docs-next'

@description('Enable auto-scaling')
param enableAutoScale bool = true

@description('Minimum instance count for auto-scaling')
param minInstances int = 1

@description('Maximum instance count for auto-scaling')
param maxInstances int = 5

@description('Tags to apply to all resources')
param tags object = {
  Application: 'VibeCode'
  Component: 'Documentation'
  Environment: environment
  ManagedBy: 'Bicep'
}

// App Service Plan
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  kind: 'linux'
  sku: {
    name: skuName
    tier: skuName == 'B1' ? 'Basic' : 'PremiumV3'
    capacity: minInstances
  }
  properties: {
    reserved: true
    targetWorkerCount: minInstances
    targetWorkerSizeId: 0
  }
  tags: tags
}

// Key Vault (if not exists)
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Web App for Containers
resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      numberOfWorkers: minInstances
      linuxFxVersion: 'DOCKER|${containerImage}'
      alwaysOn: true
      healthCheckPath: '/api/readyz'
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      cors: {
        allowedOrigins: [
          'https://${appName}.azurewebsites.net'
        ]
        supportCredentials: true
      }
      appSettings: [
        {
          name: 'WEBSITES_PORT'
          value: '3000'
        }
        {
          name: 'WEBSITES_CONTAINER_START_TIME_LIMIT'
          value: '300'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '3000'
        }
        {
          name: 'HOST'
          value: '0.0.0.0'
        }
        // NextAuth Configuration
        {
          name: 'NEXTAUTH_URL'
          value: 'https://${appName}.azurewebsites.net'
        }
        {
          name: 'NEXTAUTH_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=NEXTAUTH-SECRET)'
        }
        // Datadog Configuration
        {
          name: 'DD_API_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=DD-API-KEY)'
        }
        {
          name: 'DD_APP_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=DD-APP-KEY)'
        }
        {
          name: 'DD_SITE'
          value: datadogSite
        }
        {
          name: 'DD_ENV'
          value: environment
        }
        {
          name: 'DD_SERVICE'
          value: datadogService
        }
        {
          name: 'DD_VERSION'
          value: containerImage
        }
        {
          name: 'DD_TRACE_ENABLED'
          value: 'true'
        }
        {
          name: 'DD_RUNTIME_METRICS_ENABLED'
          value: 'true'
        }
        {
          name: 'DD_LOGS_INJECTION'
          value: 'true'
        }
        // RUM Configuration
        {
          name: 'NEXT_PUBLIC_DD_APPLICATION_ID'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=DD-RUM-APPLICATION-ID)'
        }
        {
          name: 'NEXT_PUBLIC_DD_CLIENT_TOKEN'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=DD-RUM-CLIENT-TOKEN)'
        }
        {
          name: 'NEXT_PUBLIC_DD_SITE'
          value: datadogSite
        }
        // AI Provider Keys (optional)
        {
          name: 'OPENAI_API_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=OPENAI-API-KEY)'
        }
        {
          name: 'ANTHROPIC_API_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=ANTHROPIC-API-KEY)'
        }
      ]
      connectionStrings: []
    }
    containerSize: 0
    dailyMemoryTimeQuota: 0
  }
  tags: tags
}

// Grant Web App access to Key Vault
resource keyVaultAccessPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2023-07-01' = {
  parent: keyVault
  name: 'add'
  properties: {
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: app.identity.principalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
        }
      }
    ]
  }
}

// Staging Slot for Blue-Green Deployment
resource stagingSlot 'Microsoft.Web/sites/slots@2023-12-01' = if (enableStagingSlot) {
  parent: app
  name: 'staging'
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerImage}'
      alwaysOn: true
      healthCheckPath: '/api/readyz'
      http20Enabled: true
      appSettings: app.properties.siteConfig.appSettings
    }
  }
  tags: tags
}

// Grant Staging Slot access to Key Vault
resource stagingKeyVaultAccessPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2023-07-01' = if (enableStagingSlot) {
  parent: keyVault
  name: 'add-staging'
  properties: {
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: stagingSlot.identity.principalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
        }
      }
    ]
  }
}

// Auto-scaling configuration
resource autoScaleSettings 'Microsoft.Insights/autoscalesettings@2022-10-01' = if (enableAutoScale) {
  name: 'autoscale-${appName}'
  location: location
  properties: {
    enabled: true
    targetResourceUri: plan.id
    profiles: [
      {
        name: 'Auto scale based on CPU'
        capacity: {
          minimum: string(minInstances)
          maximum: string(maxInstances)
          default: string(minInstances)
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: plan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 70
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: plan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: 30
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
        ]
      }
    ]
    notifications: []
  }
  tags: tags
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'ai-${appName}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Flow_Type: 'Bluefield'
    Request_Source: 'rest'
    RetentionInDays: 30
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
  tags: tags
}

// Log Analytics Workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'law-${appName}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: 1
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
  tags: tags
}

// Diagnostic Settings
resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${appName}'
  scope: app
  properties: {
    workspaceId: logAnalyticsWorkspace.id
    logs: [
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 7
        }
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 7
        }
      }
      {
        category: 'AppServiceAppLogs'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 7
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 7
        }
      }
    ]
  }
}

// Outputs
output appName string = app.name
output appUrl string = 'https://${app.properties.defaultHostName}'
output stagingUrl string = enableStagingSlot ? 'https://${stagingSlot.properties.defaultHostName}' : ''
output appServicePlanId string = plan.id
output appIdentityPrincipalId string = app.identity.principalId
output stagingIdentityPrincipalId string = enableStagingSlot ? stagingSlot.identity.principalId : ''
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
