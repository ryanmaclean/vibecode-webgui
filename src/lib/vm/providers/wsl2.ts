/**
 * WSL2 Provider
 * Windows Subsystem for Linux support
 */

import { VMProvider, VMConfig, VM, VMStatus, ExecResult } from '../types';
import { logger } from '@/lib/logger';

export class WSL2Provider implements VMProvider {
  name = 'wsl2';
  
  async detect(): Promise<boolean> {
    // TODO: Implement WSL2 detection
    return false;
  }
  
  async create(config: VMConfig): Promise<VM> {
    throw new Error('WSL2 provider not yet implemented');
  }
  
  async start(vmId: string): Promise<void> {
    throw new Error('WSL2 provider not yet implemented');
  }
  
  async stop(vmId: string): Promise<void> {
    throw new Error('WSL2 provider not yet implemented');
  }
  
  async destroy(vmId: string): Promise<void> {
    throw new Error('WSL2 provider not yet implemented');
  }
  
  async list(): Promise<VM[]> {
    return [];
  }
  
  async exec(vmId: string, command: string): Promise<ExecResult> {
    throw new Error('WSL2 provider not yet implemented');
  }
  
  async status(vmId: string): Promise<VMStatus> {
    return 'unknown';
  }
}
