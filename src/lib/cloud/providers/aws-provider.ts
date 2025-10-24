/**
 * AWS Cloud Provider Implementation
 */

import { ICloudProvider, CloudProvider } from '../provider-interface';

export class AWSCloudProvider implements ICloudProvider {
  provider = CloudProvider.AWS;
  region: string;

  constructor(region: string, credentials?: Record<string, unknown>) {
    this.region = region;
  }

  async createResource(type: string, config: Record<string, unknown>): Promise<string> {
    throw new Error('Not implemented');
  }

  async deleteResource(resourceId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async getResource(resourceId: string): Promise<Record<string, unknown>> {
    throw new Error('Not implemented');
  }

  async listResources(type: string): Promise<Array<Record<string, unknown>>> {
    throw new Error('Not implemented');
  }

  async checkHealth(): Promise<boolean> {
    return true;
  }
}
