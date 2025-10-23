/**
 * Workspace Service Factory
 * 
 * Automatically selects the appropriate workspace provisioning service
 * based on available runtime (Kubernetes or Apple Container)
 */

import { WorkspaceProvisioningService } from './workspace-provisioning-simple'
import { AppleContainerWorkspaceService } from './workspace-provisioning-apple-container'
import { appleContainer } from '@/lib/container/apple-container'
// import { logger } from '@/lib/logger';
export type WorkspaceRuntime = 'kubernetes' | 'apple-container' | 'none'

export class WorkspaceServiceFactory {
  private static cachedRuntime: WorkspaceRuntime | null = null

  /**
   * Detect available workspace runtime
   */
  static async detectRuntime(): Promise<WorkspaceRuntime> {
    // Use cached result if available
    if (this.cachedRuntime) {
      return this.cachedRuntime
    }

    // Check for Apple Container first (faster, local)
    try {
      const isAppleContainerAvailable = await appleContainer.isAvailable()
      if (isAppleContainerAvailable) {
        console.info('✅ Detected runtime: Apple Container')
        this.cachedRuntime = 'apple-container'
        return 'apple-container'
      }
    } catch (error) {
      console.info('⚠️  Apple Container not available:', error)
    }

    // Check for Kubernetes
    if (process.env.KUBECONFIG || process.env.KUBERNETES_SERVICE_HOST) {
      console.info('✅ Detected runtime: Kubernetes')
      this.cachedRuntime = 'kubernetes'
      return 'kubernetes'
    }

    console.info('❌ No workspace runtime available')
    this.cachedRuntime = 'none'
    return 'none'
  }

  /**
   * Get the appropriate workspace service
   */
  static async getService(): Promise<
    WorkspaceProvisioningService | AppleContainerWorkspaceService
  > {
    const runtime = await this.detectRuntime()

    switch (runtime) {
      case 'apple-container':
        return new AppleContainerWorkspaceService()
      
      case 'kubernetes':
        return new WorkspaceProvisioningService()
      
      case 'none':
        throw new Error(
          'No workspace runtime available. Please install Apple Container CLI or configure Kubernetes.'
        )
    }
  }

  /**
   * Get runtime information
   */
  static async getRuntimeInfo(): Promise<{
    runtime: WorkspaceRuntime
    available: boolean
    features: string[]
  }> {
    const runtime = await this.detectRuntime()

    const features: Record<WorkspaceRuntime, string[]> = {
      'apple-container': [
        'Fast startup (< 1s)',
        'Native macOS integration',
        'No Docker Desktop required',
        'Local development',
      ],
      kubernetes: [
        'Production-ready',
        'Auto-scaling',
        'Multi-region',
        'High availability',
      ],
      none: [],
    }

    return {
      runtime,
      available: runtime !== 'none',
      features: features[runtime],
    }
  }

  /**
   * Clear cached runtime (for testing)
   */
  static clearCache(): void {
    this.cachedRuntime = null
  }
}
