/**
 * Integration Tests for VM Providers
 * Tests real VM creation and management
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ProviderFactory } from '@/lib/vm/provider-factory';
import { VMProvider } from '@/lib/vm/types';

describe('VM Provider Integration Tests', () => {
  let provider: VMProvider;
  
  beforeAll(async () => {
    // Auto-detect best provider
    provider = await ProviderFactory.detectProvider();
    console.log(`Using provider: ${provider.name}`);
  });
  
  describe('Provider Detection', () => {
    it('should detect system information', async () => {
      const sysInfo = await ProviderFactory.getSystemInfo();
      
      expect(sysInfo).toHaveProperty('os');
      expect(sysInfo).toHaveProperty('arch');
      expect(sysInfo).toHaveProperty('availableProviders');
      expect(sysInfo).toHaveProperty('recommendedProvider');
      
      console.log('System Info:', sysInfo);
    });
    
    it('should detect at least one provider', async () => {
      const sysInfo = await ProviderFactory.getSystemInfo();
      expect(sysInfo.availableProviders.length).toBeGreaterThan(0);
    });
  });
  
  describe('VM Listing', () => {
    it('should list existing VMs', async () => {
      const vms = await provider.list();
      
      expect(Array.isArray(vms)).toBe(true);
      console.log(`Found ${vms.length} existing VMs`);
      
      vms.forEach(vm => {
        expect(vm).toHaveProperty('id');
        expect(vm).toHaveProperty('name');
        expect(vm).toHaveProperty('provider');
        expect(vm).toHaveProperty('status');
      });
    });
  });
  
  describe('VM Creation (Smoke Test)', () => {
    const testVMName = `test-vm-${Date.now()}`;
    
    afterAll(async () => {
      // Cleanup: destroy test VM
      try {
        await provider.destroy(testVMName);
        console.log(`Cleaned up test VM: ${testVMName}`);
      } catch (error) {
        console.log(`Cleanup failed (VM may not exist): ${error}`);
      }
    });
    
    it.skip('should create a minimal test VM', async () => {
      // Skip by default - only run when explicitly testing
      const vm = await provider.create({
        name: testVMName,
        cpus: 1,
        memory: '512MB',
        disk: '1GB',
        image: 'alpine-3.22'
      });
      
      expect(vm.name).toBe(testVMName);
      expect(vm.provider).toBe(provider.name);
      expect(vm.status).toBe('running');
    }, 60000); // 60s timeout for VM creation
  });
  
  describe('Command Execution', () => {
    it.skip('should execute commands in existing VM', async () => {
      // Skip by default - requires existing VM
      const vms = await provider.list();
      
      if (vms.length === 0) {
        console.log('No VMs available for command execution test');
        return;
      }
      
      const vm = vms[0];
      const result = await provider.exec(vm.id, 'echo "Hello from VM"');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello from VM');
    });
  });
});

describe('vfkit Provider Tests (macOS)', () => {
  it('should detect existing vfkit VMs', async () => {
    const { VfkitProvider } = await import('@/lib/vm/providers/vfkit');
    const provider = new VfkitProvider();
    
    const canDetect = await provider.detect();
    
    if (canDetect) {
      const vms = await provider.list();
      console.log(`vfkit VMs found: ${vms.length}`);
      
      vms.forEach(vm => {
        console.log(`  - ${vm.name} (${vm.status})`);
      });
    } else {
      console.log('vfkit not available on this system');
    }
  });
});

describe('Lima Provider Tests', () => {
  it('should detect existing Lima VMs', async () => {
    const { LimaProvider } = await import('@/lib/vm/providers/lima');
    const provider = new LimaProvider();
    
    const canDetect = await provider.detect();
    
    if (canDetect) {
      const vms = await provider.list();
      console.log(`Lima VMs found: ${vms.length}`);
      
      vms.forEach(vm => {
        console.log(`  - ${vm.name} (${vm.status})`);
      });
    } else {
      console.log('Lima not available on this system');
    }
  });
});

describe('Docker Provider Tests', () => {
  it('should detect Docker availability', async () => {
    const { DockerProvider } = await import('@/lib/vm/providers/docker');
    const provider = new DockerProvider();
    
    const canDetect = await provider.detect();
    console.log(`Docker available: ${canDetect}`);
    
    if (canDetect) {
      const containers = await provider.list();
      console.log(`Docker containers found: ${containers.length}`);
    }
  });
  
  it.skip('should work with remote Docker host', async () => {
    const { DockerProvider } = await import('@/lib/vm/providers/docker');
    const provider = new DockerProvider({ 
      remoteHost: 'string@snas.local' 
    });
    
    const canDetect = await provider.detect();
    console.log(`Remote Docker available: ${canDetect}`);
    
    if (canDetect) {
      const containers = await provider.list();
      console.log(`Remote containers: ${containers.length}`);
    }
  });
});
