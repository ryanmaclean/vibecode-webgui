/**
 * VM Profiles Service
 * Manages VM profile templates for creating VMs with specific configurations
 */

import { createServiceLogger } from '@/lib/logging';
import type { VMProfile, ProfileExport, VMResource, PortMapping } from '@/types/multi-vm';
import type { ProvisionScript, VMConfig } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

const log = createServiceLogger({
  service: 'vibecode-vm',
  component: 'profiles'
});

/**
 * Profile version for export compatibility
 */
const PROFILE_VERSION = '1.0.0';

/**
 * Custom profiles storage path
 */
const PROFILES_FILE = '.vibecode/vm-profiles.json';

/**
 * Built-in development profile
 */
const DEVELOPMENT_PROFILE: VMProfile = {
  id: 'development',
  name: 'Development',
  description: 'Full development environment with common tools and services',
  config: {
    image: 'alpine-3.22',
    arch: 'auto'
  },
  resources: {
    cpuCores: 2,
    memoryMB: 2048,
    diskMB: 20480
  },
  defaultPorts: [
    { guest: 22, host: 2222, protocol: 'tcp', service: 'SSH' },
    { guest: 3000, host: 3000, protocol: 'tcp', service: 'Dev Server' },
    { guest: 5173, host: 5173, protocol: 'tcp', service: 'Vite' },
    { guest: 8080, host: 8080, protocol: 'tcp', service: 'HTTP' }
  ],
  services: ['ssh', 'git', 'node', 'python'],
  provision: [
    {
      mode: 'system',
      description: 'Install development tools',
      script: `#!/bin/sh
set -e
apk update
apk add --no-cache \\
  git curl wget \\
  nodejs npm \\
  python3 py3-pip \\
  build-base \\
  openssh
rc-update add sshd
service sshd start
`
    }
  ],
  category: 'development',
  isBuiltIn: true,
  icon: 'code',
  estimatedSetupTime: 120,
  version: '1.0.0',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

/**
 * Built-in testing profile
 */
const TESTING_PROFILE: VMProfile = {
  id: 'testing',
  name: 'Testing',
  description: 'Isolated testing environment for running tests',
  config: {
    image: 'alpine-3.22',
    arch: 'auto'
  },
  resources: {
    cpuCores: 2,
    memoryMB: 1024,
    diskMB: 10240
  },
  defaultPorts: [
    { guest: 22, host: 2223, protocol: 'tcp', service: 'SSH' }
  ],
  services: ['ssh', 'git', 'node'],
  provision: [
    {
      mode: 'system',
      description: 'Install testing tools',
      script: `#!/bin/sh
set -e
apk update
apk add --no-cache \\
  git curl \\
  nodejs npm \\
  chromium \\
  openssh
rc-update add sshd
service sshd start
`
    }
  ],
  category: 'testing',
  isBuiltIn: true,
  icon: 'beaker',
  estimatedSetupTime: 90,
  version: '1.0.0',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

/**
 * Built-in minimal profile
 */
const MINIMAL_PROFILE: VMProfile = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Lightweight VM with minimal resources for simple tasks',
  config: {
    image: 'alpine-3.22',
    arch: 'auto'
  },
  resources: {
    cpuCores: 1,
    memoryMB: 512,
    diskMB: 5120
  },
  defaultPorts: [
    { guest: 22, host: 2224, protocol: 'tcp', service: 'SSH' }
  ],
  services: ['ssh'],
  provision: [
    {
      mode: 'system',
      description: 'Install SSH',
      script: `#!/bin/sh
set -e
apk update
apk add --no-cache openssh
rc-update add sshd
service sshd start
`
    }
  ],
  category: 'minimal',
  isBuiltIn: true,
  icon: 'cpu',
  estimatedSetupTime: 30,
  version: '1.0.0',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

/**
 * Database profile template
 */
const DATABASE_PROFILE: VMProfile = {
  id: 'database',
  name: 'Database Server',
  description: 'VM configured for running database services',
  config: {
    image: 'alpine-3.22',
    arch: 'auto'
  },
  resources: {
    cpuCores: 2,
    memoryMB: 2048,
    diskMB: 51200
  },
  defaultPorts: [
    { guest: 22, host: 2225, protocol: 'tcp', service: 'SSH' },
    { guest: 5432, host: 5432, protocol: 'tcp', service: 'PostgreSQL' },
    { guest: 6379, host: 6379, protocol: 'tcp', service: 'Redis' }
  ],
  services: ['ssh', 'postgresql', 'redis'],
  provision: [
    {
      mode: 'system',
      description: 'Install database services',
      script: `#!/bin/sh
set -e
apk update
apk add --no-cache \\
  openssh \\
  postgresql postgresql-contrib \\
  redis

# Setup PostgreSQL
mkdir -p /var/lib/postgresql/data
chown postgres:postgres /var/lib/postgresql/data
su postgres -c "initdb -D /var/lib/postgresql/data"
rc-update add postgresql
service postgresql start

# Setup Redis
rc-update add redis
service redis start

# SSH
rc-update add sshd
service sshd start
`
    }
  ],
  category: 'custom',
  isBuiltIn: true,
  icon: 'database',
  estimatedSetupTime: 180,
  version: '1.0.0',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

/**
 * All built-in profiles
 */
const BUILT_IN_PROFILES: VMProfile[] = [
  DEVELOPMENT_PROFILE,
  TESTING_PROFILE,
  MINIMAL_PROFILE,
  DATABASE_PROFILE
];

/**
 * VM Profiles Service
 */
export class VMProfilesService {
  private profiles: Map<string, VMProfile> = new Map();
  private profilesPath: string;
  private initialized = false;

  constructor(options?: { profilesPath?: string }) {
    this.profilesPath = options?.profilesPath || path.join(os.homedir(), PROFILES_FILE);

    // Initialize with built-in profiles
    for (const profile of BUILT_IN_PROFILES) {
      this.profiles.set(profile.id, { ...profile });
    }
  }

  /**
   * Initialize the profiles service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadCustomProfiles();
      this.initialized = true;
      log.info('VM profiles service initialized', {
        totalProfiles: this.profiles.size,
        customProfiles: this.profiles.size - BUILT_IN_PROFILES.length
      });
    } catch (error) {
      log.error('Failed to initialize profiles service', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get a profile by ID
   */
  getProfile(id: string): VMProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): VMProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get profiles by category
   */
  getProfilesByCategory(category: VMProfile['category']): VMProfile[] {
    return Array.from(this.profiles.values()).filter(p => p.category === category);
  }

  /**
   * Get built-in profiles
   */
  getBuiltInProfiles(): VMProfile[] {
    return Array.from(this.profiles.values()).filter(p => p.isBuiltIn);
  }

  /**
   * Get custom profiles
   */
  getCustomProfiles(): VMProfile[] {
    return Array.from(this.profiles.values()).filter(p => !p.isBuiltIn);
  }

  /**
   * Create a new custom profile
   */
  async createProfile(options: {
    name: string;
    description: string;
    config?: Partial<VMConfig>;
    resources: VMResource;
    defaultPorts?: PortMapping[];
    services?: string[];
    provision?: ProvisionScript[];
    icon?: string;
    estimatedSetupTime?: number;
  }): Promise<VMProfile> {
    const id = randomUUID();
    const now = new Date();

    const profile: VMProfile = {
      id,
      name: options.name,
      description: options.description,
      config: options.config || {},
      resources: options.resources,
      defaultPorts: options.defaultPorts || [],
      services: options.services || [],
      provision: options.provision,
      category: 'custom',
      isBuiltIn: false,
      icon: options.icon,
      estimatedSetupTime: options.estimatedSetupTime,
      version: '1.0.0',
      createdAt: now,
      updatedAt: now
    };

    this.profiles.set(id, profile);
    await this.saveCustomProfiles();

    log.info('Created custom profile', { id, name: profile.name });
    return profile;
  }

  /**
   * Update an existing custom profile
   */
  async updateProfile(
    id: string,
    updates: Partial<Omit<VMProfile, 'id' | 'isBuiltIn' | 'createdAt'>>
  ): Promise<VMProfile | null> {
    const profile = this.profiles.get(id);

    if (!profile) {
      log.warn('Profile not found for update', { id });
      return null;
    }

    if (profile.isBuiltIn) {
      log.warn('Cannot update built-in profile', { id });
      return null;
    }

    const updatedProfile: VMProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date()
    };

    this.profiles.set(id, updatedProfile);
    await this.saveCustomProfiles();

    log.info('Updated profile', { id, name: updatedProfile.name });
    return updatedProfile;
  }

  /**
   * Delete a custom profile
   */
  async deleteProfile(id: string): Promise<boolean> {
    const profile = this.profiles.get(id);

    if (!profile) {
      return false;
    }

    if (profile.isBuiltIn) {
      log.warn('Cannot delete built-in profile', { id });
      return false;
    }

    this.profiles.delete(id);
    await this.saveCustomProfiles();

    log.info('Deleted profile', { id, name: profile.name });
    return true;
  }

  /**
   * Clone a profile
   */
  async cloneProfile(sourceId: string, newName?: string): Promise<VMProfile | null> {
    const source = this.profiles.get(sourceId);

    if (!source) {
      return null;
    }

    return this.createProfile({
      name: newName || `${source.name} (Copy)`,
      description: source.description,
      config: { ...source.config },
      resources: { ...source.resources },
      defaultPorts: [...source.defaultPorts],
      services: [...source.services],
      provision: source.provision ? [...source.provision] : undefined,
      icon: source.icon,
      estimatedSetupTime: source.estimatedSetupTime
    });
  }

  /**
   * Export a profile
   */
  exportProfile(id: string): ProfileExport | null {
    const profile = this.profiles.get(id);

    if (!profile) {
      return null;
    }

    return {
      version: PROFILE_VERSION,
      exportedAt: new Date(),
      profile: {
        name: profile.name,
        description: profile.description,
        config: profile.config,
        resources: profile.resources,
        defaultPorts: profile.defaultPorts,
        services: profile.services,
        provision: profile.provision,
        category: profile.category,
        icon: profile.icon,
        estimatedSetupTime: profile.estimatedSetupTime,
        version: profile.version
      }
    };
  }

  /**
   * Import a profile
   */
  async importProfile(data: ProfileExport): Promise<VMProfile> {
    // Validate version
    if (!data.version || !data.profile) {
      throw new Error('Invalid profile export format');
    }

    return this.createProfile({
      name: data.profile.name,
      description: data.profile.description,
      config: data.profile.config,
      resources: data.profile.resources,
      defaultPorts: data.profile.defaultPorts,
      services: data.profile.services,
      provision: data.profile.provision,
      icon: data.profile.icon,
      estimatedSetupTime: data.profile.estimatedSetupTime
    });
  }

  /**
   * Import profile from JSON string
   */
  async importProfileFromJSON(json: string): Promise<VMProfile> {
    try {
      const data = JSON.parse(json) as ProfileExport;
      return this.importProfile(data);
    } catch (error) {
      throw new Error(`Failed to parse profile JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Export profile to JSON string
   */
  exportProfileToJSON(id: string): string | null {
    const exported = this.exportProfile(id);
    if (!exported) return null;
    return JSON.stringify(exported, null, 2);
  }

  /**
   * Load custom profiles from disk
   */
  private async loadCustomProfiles(): Promise<void> {
    try {
      const data = await fs.readFile(this.profilesPath, 'utf-8');
      const profiles = JSON.parse(data) as VMProfile[];

      for (const profile of profiles) {
        // Restore dates
        profile.createdAt = new Date(profile.createdAt);
        profile.updatedAt = new Date(profile.updatedAt);
        profile.isBuiltIn = false; // Ensure loaded profiles are marked as custom

        this.profiles.set(profile.id, profile);
      }

      log.debug('Loaded custom profiles', { count: profiles.length });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.warn('Failed to load custom profiles', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Save custom profiles to disk
   */
  private async saveCustomProfiles(): Promise<void> {
    try {
      const customProfiles = Array.from(this.profiles.values()).filter(p => !p.isBuiltIn);

      const dir = path.dirname(this.profilesPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(this.profilesPath, JSON.stringify(customProfiles, null, 2));
      log.debug('Saved custom profiles', { count: customProfiles.length });
    } catch (error) {
      log.error('Failed to save custom profiles', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Reset to built-in profiles only (removes all custom profiles)
   */
  async resetToBuiltIn(): Promise<void> {
    this.profiles.clear();

    for (const profile of BUILT_IN_PROFILES) {
      this.profiles.set(profile.id, { ...profile });
    }

    await this.saveCustomProfiles();
    log.info('Reset to built-in profiles');
  }

  /**
   * Search profiles by name or description
   */
  searchProfiles(query: string): VMProfile[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.profiles.values()).filter(
      p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.services.some(s => s.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Validate profile configuration
   */
  validateProfile(profile: Partial<VMProfile>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!profile.name || profile.name.trim().length === 0) {
      errors.push('Profile name is required');
    }

    if (!profile.resources) {
      errors.push('Resources configuration is required');
    } else {
      if (profile.resources.cpuCores < 1 || profile.resources.cpuCores > 16) {
        errors.push('CPU cores must be between 1 and 16');
      }
      if (profile.resources.memoryMB < 256 || profile.resources.memoryMB > 16384) {
        errors.push('Memory must be between 256MB and 16GB');
      }
      if (profile.resources.diskMB < 1024 || profile.resources.diskMB > 512000) {
        errors.push('Disk must be between 1GB and 500GB');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Singleton instance
let profilesServiceInstance: VMProfilesService | null = null;

/**
 * Get the singleton profiles service instance
 */
export function getProfilesService(
  options?: ConstructorParameters<typeof VMProfilesService>[0]
): VMProfilesService {
  if (!profilesServiceInstance) {
    profilesServiceInstance = new VMProfilesService(options);
  }
  return profilesServiceInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetProfilesService(): void {
  profilesServiceInstance = null;
}
