/**
 * IDE Factory
 * Factory pattern for creating IDE instances based on configuration
 */

import { WebIDE, IDEType, IDEConfig } from './types';
import { OpenVSCodeServer } from './openvscode';
import { CodeServer } from './code-server';
import { EclipseTheia } from './theia';

export class IDEFactory {
  private static instances: Map<IDEType, WebIDE> = new Map();

  /**
   * Get an IDE instance by type
   * Uses singleton pattern to reuse instances
   */
  static getIDE(type: IDEType): WebIDE {
    if (!this.instances.has(type)) {
      this.instances.set(type, this.createIDE(type));
    }
    return this.instances.get(type)!;
  }

  /**
   * Create a new IDE instance
   */
  private static createIDE(type: IDEType): WebIDE {
    switch (type) {
      case 'openvscode':
        return new OpenVSCodeServer();
      case 'code-server':
        return new CodeServer();
      case 'theia':
        return new EclipseTheia();
      default:
        throw new Error(`Unsupported IDE type: ${type}`);
    }
  }

  /**
   * Start an IDE session with automatic type selection
   */
  static async startIDE(config: IDEConfig): Promise<WebIDE> {
    const ide = this.getIDE(config.type);
    await ide.start(config);
    return ide;
  }

  /**
   * Get the default IDE type from environment or configuration
   */
  static getDefaultIDEType(): IDEType {
    const envType = process.env.DEFAULT_IDE_TYPE as IDEType;
    const validTypes: IDEType[] = ['openvscode', 'code-server', 'theia'];
    
    if (envType && validTypes.includes(envType)) {
      return envType;
    }
    
    // Default to OpenVSCode Server
    return 'openvscode';
  }

  /**
   * Get all available IDE types
   */
  static getAvailableIDEs(): IDEType[] {
    return ['openvscode', 'code-server', 'theia'];
  }

  /**
   * Clear all IDE instances (useful for testing)
   */
  static clearInstances(): void {
    this.instances.clear();
  }
}
