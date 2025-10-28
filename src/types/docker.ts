/**
 * Docker Runtime Type Definitions
 *
 * Shared types for Docker detection across:
 * - Backend API
 * - Frontend components
 * - Future Tauri integration
 */

export enum DockerType {
  DockerDesktop = 'DockerDesktop',
  Colima = 'Colima',
  Podman = 'Podman',
  NotInstalled = 'NotInstalled',
}

export interface DockerStatus {
  dockerType: DockerType;
  version?: string;
  running: boolean;
  socketPath?: string;
  contextName?: string;
}

export interface DockerContext {
  name: string;
  current: boolean;
  dockerEndpoint: string;
}

export interface DockerDaemonStatus {
  accessible: boolean;
  error?: string;
}

export interface DockerStatusReport {
  runtime: DockerStatus;
  installed: boolean;
  daemonStatus: DockerDaemonStatus;
  contexts: DockerContext[];
}

export interface DockerStartResult {
  success: boolean;
  message: string;
}

/**
 * Docker API Response Types
 */
export interface DockerStatusResponse {
  success: boolean;
  data?: DockerStatus;
  error?: string;
}

export interface DockerStatusReportResponse {
  success: boolean;
  data?: DockerStatusReport;
  error?: string;
}

export interface DockerActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}
