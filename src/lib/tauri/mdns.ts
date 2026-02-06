// @ts-expect-error - Tauri API only available in Tauri environment
import { invoke } from '@tauri-apps/api/core';

/**
 * Represents a discovered VibeCode session on the local network
 */
export interface DiscoveredSession {
  name: string;
  host: string;
  port: number;
  addresses: string[];
}

/**
 * Start advertising this VibeCode instance on the local network via mDNS/Bonjour
 * @param userName - The user's display name for the service
 * @param port - The port this VibeCode instance is running on (default: 3000)
 * @returns A confirmation message
 */
export async function startMDNSService(
  userName: string,
  port: number = 3000
): Promise<string> {
  return await invoke<string>('start_mdns_service', { userName, port });
}

/**
 * Discover other VibeCode instances on the local network
 * @returns An array of discovered VibeCode sessions
 */
export async function discoverSessions(): Promise<DiscoveredSession[]> {
  return await invoke<DiscoveredSession[]>('discover_vibecode_sessions');
}

/**
 * Stop advertising this VibeCode instance on the local network
 * @param userName - The user's display name for the service
 * @returns A confirmation message
 */
export async function stopMDNSService(userName: string): Promise<string> {
  return await invoke<string>('stop_mdns_service', { userName });
}
