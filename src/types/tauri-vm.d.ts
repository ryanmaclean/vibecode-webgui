/**
 * TypeScript type definitions for Tauri VM Management Commands
 * Rust-to-Swift Bridge using Virtualization.framework
 */

declare module '@tauri-apps/api/core' {
  export namespace vm {
    // ==================== Data Types ====================

    /**
     * VM Configuration for creating new virtual machines
     */
    export interface VMConfig {
      /** Unique name identifier for the VM */
      name: string;
      /** Memory allocation in MiB (mebibytes) */
      memory: number;
      /** Number of virtual CPUs */
      cpus: number;
      /** Disk size in bytes */
      disk_size: number;
      /** Optional path to macOS IPSW restore image */
      ipsw_path?: string;
    }

    /**
     * VM Status information
     */
    export interface VMStatus {
      /** VM name */
      name: string;
      /** Whether the VM is currently running */
      running: boolean;
      /** Process ID if running */
      pid?: number;
    }

    /**
     * Detailed VM Information
     */
    export interface VMInfo {
      /** VM name */
      name: string;
      /** Path to disk image file */
      disk_path: string;
      /** Path to EFI/NVRAM file */
      efi_path: string;
      /** Whether VM resources are available */
      available: boolean;
    }

    /**
     * VM Pool Statistics from VMPoolManager
     */
    export interface PoolStatistics {
      /** Number of pre-warmed VMs available for allocation */
      available_vms: number;
      /** Number of VMs currently in use */
      active_vms: number;
      /** Total number of VMs in the pool */
      total_vms: number;
      /** Number of VMs allocated from pre-warmed pool */
      hot_allocations: number;
      /** Number of VMs that required cold boot */
      cold_boot_count: number;
      /** Number of VMs recycled due to usage limits */
      recycled_vms: number;
      /** Average VM allocation latency in seconds */
      average_allocation_latency: number;
      /** Average VM release latency in seconds */
      average_release_latency: number;
      /** Time taken to warm the pool in seconds */
      pool_warm_time: number;
    }

    /**
     * VM Resource Metrics
     */
    export interface VMMetrics {
      /** CPU usage percentage (0-100) */
      cpu_usage: number;
      /** Memory usage in bytes */
      memory_usage: number;
      /** Memory usage percentage (0-100) */
      memory_percentage: number;
      /** Disk read I/O in bytes/sec */
      disk_read_bytes: number;
      /** Disk write I/O in bytes/sec */
      disk_write_bytes: number;
      /** Network receive bytes/sec */
      network_rx_bytes: number;
      /** Network transmit bytes/sec */
      network_tx_bytes: number;
    }

    /**
     * Allocated VM from pool
     */
    export interface AllocatedVM {
      /** Unique VM identifier */
      id: string;
      /** IP address of the VM */
      ip_address: string;
      /** URL to workspace */
      workspace_url: string;
      /** Timestamp when allocated */
      allocated_at: string;
    }

    // ==================== Basic VM Operations ====================

    /**
     * List all available VMs
     * @returns Promise resolving to array of VM information
     */
    export function vm_list(): Promise<VMInfo[]>;

    /**
     * Start a VM by name
     * @param vm_name - Name of the VM to start
     * @returns Promise resolving to success message
     */
    export function vm_start(vm_name: string): Promise<string>;

    /**
     * Stop a running VM
     * @param vm_name - Name of the VM to stop
     * @returns Promise resolving to success message
     */
    export function vm_stop(vm_name: string): Promise<string>;

    /**
     * Get status of a specific VM
     * @param vm_name - Name of the VM
     * @returns Promise resolving to VM status
     */
    export function vm_status(vm_name: string): Promise<VMStatus>;

    /**
     * Start OpenVSCode Server VM with port forwarding
     * @returns Promise resolving to success message
     */
    export function vm_start_openvscode(): Promise<string>;

    /**
     * Setup first run by copying bundled VMs to user directory
     * @returns Promise resolving to setup status message
     */
    export function vm_setup_first_run(): Promise<string>;

    // ==================== Enhanced VM Operations (Swift Bridge) ====================

    /**
     * Create a new VM with specified configuration
     * @param config - VM configuration object
     * @returns Promise resolving to success message
     */
    export function vm_create(config: VMConfig): Promise<string>;

    /**
     * Delete a VM by name (removes all associated files)
     * @param vm_name - Name of the VM to delete
     * @returns Promise resolving to success message
     */
    export function vm_delete(vm_name: string): Promise<string>;

    /**
     * Pause a running VM (suspend to memory)
     * @param vm_name - Name of the VM to pause
     * @returns Promise resolving to success message
     */
    export function vm_pause(vm_name: string): Promise<string>;

    /**
     * Resume a paused VM
     * @param vm_name - Name of the VM to resume
     * @returns Promise resolving to success message
     */
    export function vm_resume(vm_name: string): Promise<string>;

    /**
     * Get detailed information about a VM
     * @param vm_name - Name of the VM
     * @returns Promise resolving to detailed VM information
     */
    export function vm_info(vm_name: string): Promise<Record<string, unknown>>;

    /**
     * Get real-time resource metrics for a VM
     * @param vm_name - Name of the VM
     * @returns Promise resolving to VM metrics
     */
    export function vm_metrics(vm_name: string): Promise<VMMetrics>;

    /**
     * Update VM configuration (requires VM restart)
     * @param vm_name - Name of the VM to update
     * @param config - New configuration
     * @returns Promise resolving to success message
     */
    export function vm_update_config(
      vm_name: string,
      config: VMConfig
    ): Promise<string>;

    // ==================== VM Pool Management ====================

    /**
     * Warm the VM pool by pre-booting VMs
     * @param pool_size - Number of VMs to pre-warm (default: 5)
     * @returns Promise resolving to success message
     */
    export function vm_pool_warm(pool_size?: number): Promise<string>;

    /**
     * Allocate a VM from the pre-warmed pool (sub-100ms)
     * @returns Promise resolving to allocated VM details
     */
    export function vm_pool_allocate(): Promise<AllocatedVM>;

    /**
     * Release a VM back to the pool or recycle if usage limit reached
     * @param vm_id - UUID of the VM to release
     * @returns Promise resolving to success message
     */
    export function vm_pool_release(vm_id: string): Promise<string>;

    /**
     * Get current pool statistics
     * @returns Promise resolving to pool statistics
     */
    export function vm_pool_stats(): Promise<PoolStatistics>;

    // ==================== Advanced VM Operations ====================

    /**
     * Clone an existing VM to create a copy
     * @param source_vm - Name of the source VM
     * @param target_vm - Name for the cloned VM
     * @returns Promise resolving to success message
     */
    export function vm_clone(
      source_vm: string,
      target_vm: string
    ): Promise<string>;

    /**
     * Create a snapshot of a VM's current state
     * @param vm_name - Name of the VM
     * @param snapshot_name - Name for the snapshot
     * @returns Promise resolving to success message
     */
    export function vm_snapshot(
      vm_name: string,
      snapshot_name: string
    ): Promise<string>;

    /**
     * Restore a VM from a snapshot
     * @param vm_name - Name of the VM
     * @param snapshot_name - Name of the snapshot to restore
     * @returns Promise resolving to success message
     */
    export function vm_restore(
      vm_name: string,
      snapshot_name: string
    ): Promise<string>;

    /**
     * Export a VM to a portable format
     * @param vm_name - Name of the VM to export
     * @param export_path - Path where to save the export
     * @returns Promise resolving to success message
     */
    export function vm_export(
      vm_name: string,
      export_path: string
    ): Promise<string>;

    /**
     * Import a VM from a portable format
     * @param import_path - Path to the VM export file
     * @param vm_name - Name for the imported VM
     * @returns Promise resolving to success message
     */
    export function vm_import(
      import_path: string,
      vm_name: string
    ): Promise<string>;
  }
}

// ==================== Usage Examples ====================

/**
 * Example: Create and start a new VM
 *
 * ```typescript
 * import { invoke } from '@tauri-apps/api/core';
 *
 * const config = {
 *   name: 'dev-vm-01',
 *   memory: 8192,  // 8GB
 *   cpus: 4,
 *   disk_size: 50 * 1024 * 1024 * 1024,  // 50GB
 * };
 *
 * const result = await invoke('vm_create', { config });
 * await invoke('vm_start', { vm_name: 'dev-vm-01' });
 * ```
 */

/**
 * Example: Use pre-warmed VM pool for fast allocation
 *
 * ```typescript
 * import { invoke } from '@tauri-apps/api/core';
 *
 * // Warm pool at startup
 * await invoke('vm_pool_warm', { pool_size: 5 });
 *
 * // Allocate VM (sub-100ms)
 * const vm = await invoke('vm_pool_allocate');
 * console.log(`VM allocated: ${vm.ip_address}`);
 *
 * // Use VM...
 *
 * // Release back to pool
 * await invoke('vm_pool_release', { vm_id: vm.id });
 * ```
 */

/**
 * Example: Monitor VM resources
 *
 * ```typescript
 * import { invoke } from '@tauri-apps/api/core';
 *
 * const metrics = await invoke('vm_metrics', { vm_name: 'dev-vm-01' });
 * console.log(`CPU Usage: ${metrics.cpu_usage}%`);
 * console.log(`Memory: ${metrics.memory_percentage}%`);
 * ```
 */

/**
 * Example: Snapshot and restore workflow
 *
 * ```typescript
 * import { invoke } from '@tauri-apps/api/core';
 *
 * // Create snapshot before risky operation
 * await invoke('vm_snapshot', {
 *   vm_name: 'dev-vm-01',
 *   snapshot_name: 'pre-upgrade'
 * });
 *
 * // If something goes wrong, restore
 * await invoke('vm_restore', {
 *   vm_name: 'dev-vm-01',
 *   snapshot_name: 'pre-upgrade'
 * });
 * ```
 */

export {};
