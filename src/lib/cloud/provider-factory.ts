/**
 * Cloud Provider Factory
 * Creates appropriate cloud provider instance based on configuration
 */

import { ICloudProvider, CloudProvider, CloudRegion } from './provider-interface'
import { AWSCloudProvider } from './providers/aws-provider'
// import { GCPCloudProvider } from './providers/gcp-provider'
// import { AzureCloudProvider } from './providers/azure-provider'

export interface CloudProviderConfig {
  provider: CloudProvider
  region: string
  credentials: {
    aws?: {
      accessKeyId: string
      secretAccessKey: string
      sessionToken?: string
    }
    gcp?: {
      projectId: string
      credentials: string | object // Service account JSON
    }
    azure?: {
      subscriptionId: string
      tenantId: string
      clientId: string
      clientSecret: string
    }
  }
}

export class CloudProviderFactory {
  private static instance: CloudProviderFactory
  private providers: Map<CloudProvider, ICloudProvider> = new Map()

  private constructor() {}

  static getInstance(): CloudProviderFactory {
    if (!CloudProviderFactory.instance) {
      CloudProviderFactory.instance = new CloudProviderFactory()
    }
    return CloudProviderFactory.instance
  }

  /**
   * Create and register a cloud provider
   */
  createProvider(config: CloudProviderConfig): ICloudProvider {
    // Check if provider already exists
    const existing = this.providers.get(config.provider)
    if (existing) {
      return existing
    }

    let provider: ICloudProvider

    switch (config.provider) {
      case CloudProvider.AWS:
        if (!config.credentials.aws) {
          throw new Error('AWS credentials required')
        }
        provider = new AWSCloudProvider(config.region, config.credentials.aws)
        break

      case CloudProvider.GCP:
        if (!config.credentials.gcp) {
          throw new Error('GCP credentials required')
        }
        // provider = new GCPCloudProvider(config.credentials.gcp.projectId, config.region, config.credentials.gcp.credentials)
        throw new Error('GCP provider not yet implemented')

      case CloudProvider.AZURE:
        if (!config.credentials.azure) {
          throw new Error('Azure credentials required')
        }
        // provider = new AzureCloudProvider(config.region, config.credentials.azure)
        throw new Error('Azure provider not yet implemented')

      default:
        throw new Error(`Unsupported cloud provider: ${config.provider}`)
    }

    this.providers.set(config.provider, provider)
    return provider
  }

  /**
   * Get existing provider instance
   */
  getProvider(provider: CloudProvider): ICloudProvider {
    const instance = this.providers.get(provider)
    if (!instance) {
      throw new Error(`Provider ${provider} not initialized. Call createProvider() first.`)
    }
    return instance
  }

  /**
   * Create provider from environment variables
   */
  createFromEnv(): ICloudProvider {
    const provider = this.getProviderFromEnv()
    const region = this.getRegionFromEnv(provider)
    const credentials = this.getCredentialsFromEnv(provider)

    return this.createProvider({ provider, region, credentials })
  }

  private getProviderFromEnv(): CloudProvider {
    const provider = process.env.CLOUD_PROVIDER?.toLowerCase()

    switch (provider) {
      case 'aws':
        return CloudProvider.AWS
      case 'gcp':
      case 'google':
        return CloudProvider.GCP
      case 'azure':
        return CloudProvider.AZURE
      default:
        throw new Error('CLOUD_PROVIDER environment variable not set or invalid')
    }
  }

  private getRegionFromEnv(provider: CloudProvider): string {
    const region = process.env.CLOUD_REGION

    if (!region) {
      // Default regions
      switch (provider) {
        case CloudProvider.AWS:
          return 'us-east-1'
        case CloudProvider.GCP:
          return 'us-central1'
        case CloudProvider.AZURE:
          return 'eastus'
      }
    }

    return region
  }

  private getCredentialsFromEnv(provider: CloudProvider): CloudProviderConfig['credentials'] {
    switch (provider) {
      case CloudProvider.AWS:
        return {
          aws: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            sessionToken: process.env.AWS_SESSION_TOKEN
          }
        }

      case CloudProvider.GCP:
        return {
          gcp: {
            projectId: process.env.GCP_PROJECT_ID || '',
            credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || ''
          }
        }

      case CloudProvider.AZURE:
        return {
          azure: {
            subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
            tenantId: process.env.AZURE_TENANT_ID || '',
            clientId: process.env.AZURE_CLIENT_ID || '',
            clientSecret: process.env.AZURE_CLIENT_SECRET || ''
          }
        }
    }
  }

  /**
   * Validate cloud provider configuration
   */
  static validateConfig(config: CloudProviderConfig): void {
    if (!config.provider) {
      throw new Error('Cloud provider not specified')
    }

    if (!config.region) {
      throw new Error('Cloud region not specified')
    }

    switch (config.provider) {
      case CloudProvider.AWS:
        if (!config.credentials.aws?.accessKeyId || !config.credentials.aws?.secretAccessKey) {
          throw new Error('AWS credentials incomplete')
        }
        break

      case CloudProvider.GCP:
        if (!config.credentials.gcp?.projectId || !config.credentials.gcp?.credentials) {
          throw new Error('GCP credentials incomplete')
        }
        break

      case CloudProvider.AZURE:
        const azure = config.credentials.azure
        if (!azure?.subscriptionId || !azure?.tenantId || !azure?.clientId || !azure?.clientSecret) {
          throw new Error('Azure credentials incomplete')
        }
        break
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): CloudProvider[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Clear all registered providers
   */
  clearProviders(): void {
    this.providers.clear()
  }
}

// Export singleton instance
export const cloudProviderFactory = CloudProviderFactory.getInstance()

// Export convenience function for creating providers
export function createCloudProvider(config: CloudProviderConfig): ICloudProvider {
  return cloudProviderFactory.createProvider(config)
}

// Export convenience function for environment-based creation
export function createCloudProviderFromEnv(): ICloudProvider {
  return cloudProviderFactory.createFromEnv()
}
