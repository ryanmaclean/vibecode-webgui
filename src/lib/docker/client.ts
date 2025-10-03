/**
 * Docker API Client
 *
 * Frontend utility for interacting with Docker detection API
 * Can be used in:
 * - React components
 * - Next.js pages
 * - Future Tauri frontend
 */

import type {
  DockerStatusResponse,
  DockerStatusReportResponse,
  DockerActionResponse,
} from '@/types/docker';

const API_BASE = '/api/docker';

/**
 * Fetches current Docker runtime status
 */
export async function getDockerStatus(): Promise<DockerStatusResponse> {
  try {
    const response = await fetch(`${API_BASE}/status`);
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch Docker status',
    };
  }
}

/**
 * Fetches detailed Docker status report
 */
export async function getDockerStatusReport(): Promise<DockerStatusReportResponse> {
  try {
    const response = await fetch(`${API_BASE}/status?detailed=true`);
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch Docker status report',
    };
  }
}

/**
 * Starts Colima if installed but not running
 */
export async function startColima(): Promise<DockerActionResponse> {
  try {
    const response = await fetch(`${API_BASE}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'start-colima' }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start Colima',
    };
  }
}

/**
 * Checks if Docker is running and accessible
 */
export async function isDockerRunning(): Promise<boolean> {
  const status = await getDockerStatus();
  return status.success && status.data?.running === true;
}

/**
 * Gets user-friendly Docker status message
 */
export async function getDockerStatusMessage(): Promise<string> {
  const status = await getDockerStatus();

  if (!status.success) {
    return 'Unable to check Docker status';
  }

  if (!status.data) {
    return 'No Docker information available';
  }

  const { dockerType, running, version } = status.data;

  if (!running) {
    switch (dockerType) {
      case 'DockerDesktop':
        return 'Docker Desktop is installed but not running';
      case 'Colima':
        return 'Colima is installed but not running';
      case 'Podman':
        return 'Podman is installed but not running';
      default:
        return 'No container runtime detected';
    }
  }

  switch (dockerType) {
    case 'DockerDesktop':
      return `Docker Desktop ${version || ''} is running`;
    case 'Colima':
      return `Colima ${version || ''} is running`;
    case 'Podman':
      return `Podman ${version || ''} is running`;
    default:
      return 'Container runtime is running';
  }
}
