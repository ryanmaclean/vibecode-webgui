@description('Name for the Azure Resource Group (provided by az deployment context)')
param location string = resourceGroup().location

@description('Name for the Azure Container Registry')
param acrName string

@description('App Service plan name')
param planName string = 'ai-gateway-plan'

@description('App Service (Web App for Containers) name')
param appName string

@description('Container image tag to deploy (e.g., latest or sha)')
param imageTag string = 'latest'

@description('Container image repository (e.g., vibecode/ai-gateway)')
param imageRepository string

@description('CPU size for App Service plan')
@allowed([ 'B1' 'P1v3' 'P2v3' ])
param skuName string = 'B1'

@description('Enable Managed Identity for the app')
param enableManagedIdentity bool = true

@description('Optional app settings (key/value)')
param appSettings object = {
  NODE_ENV: 'production'
  PORT: '3001'
  ENABLE_TRACING: 'true'
  PROVIDERS_ENABLED: 'openrouter'
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: {
    name: skuName
    tier: skuName == 'B1' ? 'Basic' : 'PremiumV3'
    size: skuName
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${imageRepository}:${imageTag}'
      appSettings: [
        {
          name: 'WEBSITES_PORT'
          value: '3001'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acr.properties.loginServer}'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_USERNAME'
          value: acr.listCredentials().username
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_PASSWORD'
          value: acr.listCredentials().passwords[0].value
        }
        // User-provided app settings
        for (k, v) in appSettings: {
          name: k
          value: string(v)
        }
      ]
      alwaysOn: true
      healthCheckPath: '/health'
      http20Enabled: true
      ftpsState: 'Disabled'
    }
    httpsOnly: true
  }
  identity: enableManagedIdentity ? {
    type: 'SystemAssigned'
  } : null
  kind: 'app,linux,container'
  tags: {
    project: 'vibecode-ai-gateway'
  }
}

output appUrl string = 'https://' + app.properties.defaultHostName
