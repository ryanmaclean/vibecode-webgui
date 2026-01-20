/**
 * Container Runtime Interface
 * 
 * Unified interface for all container runtimes (Docker, Podman, Kubernetes, Apple Containers)
 * This abstraction allows seamless switching between different container technologies
 */

export type ContainerRuntimeType = 'docker' | 'podman' | 'kubernetes' | 'apple';

export interface ContainerRuntime {
  /** Runtime identifier */
  readonly name: ContainerRuntimeType;
  
  /** Runtime version */
  readonly version?: string;

  /**
   * Check if runtime is available and accessible
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get runtime status and health
   */
  getStatus(): Promise<RuntimeStatus>;

  /**
   * Start a new container
   * @param image - Container image name
   * @param options - Container configuration options
   */
  start(image: string, options: ContainerOptions): Promise<ContainerStartResult>;

  /**
   * Stop a running container
   * @param containerId - Container ID or name
   */
  stop(containerId: string): Promise<OperationResult>;

  /**
   * Remove a container
   * @param containerId - Container ID or name
   */
  remove(containerId: string): Promise<OperationResult>;

  /**
   * List all containers
   * @param options - Filter options
   */
  list(options?: ListOptions): Promise<ContainerListResult>;

  /**
   * Get container logs
   * @param containerId - Container ID or name
   * @param options - Log options
   */
  logs(containerId: string, options?: LogOptions): Promise<ContainerLogsResult>;

  /**
   * Inspect container details
   * @param containerId - Container ID or name
   */
  inspect(containerId: string): Promise<ContainerInfo | null>;

  /**
   * Execute command in container
   * @param containerId - Container ID or name
   * @param command - Command to execute
   */
  exec(containerId: string, command: string[]): Promise<ExecResult>;

  /**
   * Get container stats
   * @param containerId - Container ID or name
   */
  stats(containerId: string): Promise<ContainerStats | null>;
}

export interface RuntimeStatus {
  /** Is runtime available */
  available: boolean;
  
  /** Is runtime running */
  running: boolean;
  
  /** Runtime version */
  version?: string;
  
  /** Additional runtime info */
  info?: Record<string, unknown>;
  
  /** Error message if unavailable */
  error?: string;
}

export interface ContainerOptions {
  /** Container name */
  name?: string;

  /** Port mappings (host:container) */
  ports?: Record<number, number>;

  /** Environment variables */
  env?: Record<string, string>;

  /** Volume mounts (hostPath:containerPath) */
  volumes?: Record<string, string>;

  /** Run in detached mode */
  detached?: boolean;

  /** Remove container after exit */
  rm?: boolean;

  /** CPU count */
  cpus?: number;

  /** Memory in MB */
  memory?: number;

  /** Network name */
  network?: string;

  /** Command to run */
  command?: string[];

  /** Working directory */
  workdir?: string;

  /** User to run as */
  user?: string;

  /** Additional labels */
  labels?: Record<string, string>;

  /** Restart policy */
  restart?: 'no' | 'always' | 'on-failure' | 'unless-stopped';

  /** Health check configuration */
  healthCheck?: HealthCheckConfig;
}

export interface HealthCheckConfig {
  /** Health check command */
  test: string[];
  
  /** Interval between checks (seconds) */
  interval?: number;
  
  /** Timeout for each check (seconds) */
  timeout?: number;
  
  /** Number of retries before unhealthy */
  retries?: number;
  
  /** Start period before first check (seconds) */
  startPeriod?: number;
}

export interface ContainerInfo {
  /** Container ID */
  id: string;

  /** Container name */
  name: string;

  /** Image name */
  image: string;

  /** Container state */
  state: ContainerState;

  /** IP address */
  ipAddress?: string;

  /** Port mappings */
  ports?: Record<string, number>;

  /** Created timestamp */
  created?: string;

  /** Started timestamp */
  started?: string;

  /** Labels */
  labels?: Record<string, string>;

  /** Network information */
  networks?: NetworkInfo[];
}

export type ContainerState = 
  | 'created' 
  | 'running' 
  | 'paused' 
  | 'restarting' 
  | 'removing' 
  | 'exited' 
  | 'dead';

export interface NetworkInfo {
  /** Network name */
  name: string;
  
  /** Network ID */
  id?: string;
  
  /** IP address */
  ipAddress?: string;
  
  /** Gateway */
  gateway?: string;
}

export interface ContainerStartResult {
  /** Success status */
  success: boolean;

  /** Container ID */
  id?: string;

  /** Container name */
  name?: string;

  /** Error message if failed */
  error?: string;
}

export interface OperationResult {
  /** Success status */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

export interface ContainerListResult {
  /** Success status */
  success: boolean;

  /** List of containers */
  containers: ContainerInfo[];

  /** Error message if failed */
  error?: string;
}

export interface ListOptions {
  /** Include stopped containers */
  all?: boolean;

  /** Filter by label */
  labels?: Record<string, string>;

  /** Filter by state */
  state?: ContainerState;

  /** Limit number of results */
  limit?: number;
}

export interface ContainerLogsResult {
  /** Success status */
  success: boolean;

  /** Log output */
  logs: string;

  /** Error message if failed */
  error?: string;
}

export interface LogOptions {
  /** Follow log output */
  follow?: boolean;

  /** Number of lines from end */
  tail?: number;

  /** Show timestamps */
  timestamps?: boolean;

  /** Show logs since timestamp */
  since?: Date;

  /** Show logs until timestamp */
  until?: Date;
}

export interface ExecResult {
  /** Exit code */
  exitCode: number;

  /** Standard output */
  stdout: string;

  /** Standard error */
  stderr: string;

  /** Success status */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

export interface ContainerStats {
  /** Container ID */
  containerId: string;

  /** CPU usage percentage */
  cpuPercent: number;

  /** Memory usage in bytes */
  memoryUsage: number;

  /** Memory limit in bytes */
  memoryLimit: number;

  /** Memory usage percentage */
  memoryPercent: number;

  /** Network bytes received */
  networkRx: number;

  /** Network bytes transmitted */
  networkTx: number;

  /** Block I/O read */
  blockRead: number;

  /** Block I/O write */
  blockWrite: number;

  /** Number of PIDs */
  pids?: number;
}

/**
 * Runtime configuration
 */
export interface RuntimeConfig {
  /** Selected runtime type */
  runtime: ContainerRuntimeType;

  /** Docker-specific configuration */
  docker?: DockerConfig;

  /** Podman-specific configuration */
  podman?: PodmanConfig;

  /** Kubernetes-specific configuration */
  kubernetes?: KubernetesConfig;

  /** Apple Container-specific configuration */
  apple?: AppleContainerConfig;
}

export interface DockerConfig {
  /** Docker host URL */
  host?: string;

  /** Docker socket path */
  socketPath?: string;

  /** Use Docker Desktop */
  useDesktop?: boolean;

  /** Use Colima */
  useColima?: boolean;

  /** TLS verification */
  tlsVerify?: boolean;
}

export interface PodmanConfig {
  /** Podman machine name */
  machine?: string;

  /** Podman socket path */
  socketPath?: string;

  /** Remote host */
  remoteHost?: string;

  /** Use rootless mode */
  rootless?: boolean;
}

export interface KubernetesConfig {
  /** Kubernetes context */
  context?: string;

  /** Namespace for deployments */
  namespace?: string;

  /** Use kind */
  useKind?: boolean;

  /** Use minikube */
  useMinikube?: boolean;

  /** Use k3s */
  useK3s?: boolean;

  /** Kubeconfig path */
  kubeconfig?: string;
}

export interface AppleContainerConfig {
  /** Binary path */
  binaryPath?: string;

  /** Isolation mode */
  isolation?: 'process' | 'vm';

  /** Enable Rosetta */
  enableRosetta?: boolean;

  /** Data directory */
  dataDirectory?: string;
}
