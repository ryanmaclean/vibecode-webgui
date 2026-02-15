// @ts-expect-error - Tauri API only available in Tauri environment
import { invoke } from '@tauri-apps/api/core';

/**
 * Tailscale connection status
 */
export interface TailscaleStatus {
  connected: boolean;
  ip: string | null;
  hostname: string;
  user: string | null;
  version: string | null;
}

/**
 * Tailscale configuration options
 */
export interface TailscaleConfig {
  enabled: boolean;
  auto_start: boolean;
  bind_services: boolean;
}

/**
 * Check if Tailscale is installed on the system
 * @returns True if Tailscale is installed, false otherwise
 */
export async function isInstalled(): Promise<boolean> {
  return await invoke<boolean>('tailscale_is_installed');
}

/**
 * Get current Tailscale connection status
 * @returns Current Tailscale status
 */
export async function getStatus(): Promise<TailscaleStatus> {
  return await invoke<TailscaleStatus>('tailscale_status');
}

/**
 * Get Tailscale IP address
 * @returns Tailscale IP address
 */
export async function getIp(): Promise<string> {
  return await invoke<string>('tailscale_get_ip');
}

/**
 * Get secure bind address for services (Tailscale IP only)
 * @param port - Port number to bind to
 * @returns Secure bind address (Tailscale IP:port)
 */
export async function getSecureBindAddr(port: number): Promise<string> {
  return await invoke<string>('tailscale_get_secure_bind_addr', { port });
}

/**
 * Start code-server bound to Tailscale IP ONLY (secure)
 * @param port - Port number to bind to
 * @returns URL to access code-server
 */
export async function startCodeServerSecure(port: number): Promise<string> {
  return await invoke<string>('tailscale_start_code_server_secure', { port });
}

/**
 * Check if a service is accessible on Tailscale network
 * @param port - Port number to check
 * @returns True if service is accessible, false otherwise
 */
export async function checkServiceAccessible(port: number): Promise<boolean> {
  return await invoke<boolean>('tailscale_check_service_accessible', { port });
}

/**
 * Get Tailscale network info
 * @returns Network information as JSON
 */
export async function getNetworkInfo(): Promise<Record<string, unknown>> {
  return await invoke<Record<string, unknown>>('tailscale_get_network_info');
}

/**
 * Verify zero-trust configuration
 * @returns Array of verification messages or throws error with warnings
 */
export async function verifyZeroTrust(): Promise<string[]> {
  return await invoke<string[]>('tailscale_verify_zero_trust');
}
