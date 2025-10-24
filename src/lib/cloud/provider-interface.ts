/**
 * Cloud Provider Interface
 * Common interface for all cloud providers
 */

export enum CloudProvider {
  AWS = 'aws',
  GCP = 'gcp',
  AZURE = 'azure'
}

export interface CloudRegion {
  id: string;
  name: string;
  location: string;
}

export interface CloudCredentials {
  accessKeyId?: string;
  secretAccessKey?: string;
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface ICloudProvider {
  provider: CloudProvider;
  region: string;

  // Resource management
  createResource(type: string, config: Record<string, unknown>): Promise<string>;
  deleteResource(resourceId: string): Promise<void>;
  getResource(resourceId: string): Promise<Record<string, unknown>>;
  listResources(type: string): Promise<Array<Record<string, unknown>>>;

  // Health check
  checkHealth(): Promise<boolean>;
}
