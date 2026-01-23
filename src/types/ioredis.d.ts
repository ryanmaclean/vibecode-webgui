// Type definitions for ioredis
declare module 'ioredis' {
  class Redis {
    constructor(port?: number, host?: string, options?: RedisOptions);
    constructor(host?: string, options?: RedisOptions);
    constructor(options?: RedisOptions | string);
    
    on(event: string, listener: Function): this;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<string>;
    setex(key: string, seconds: number, value: string): Promise<string>;
    del(keys: string | string[]): Promise<number>;
    exists(key: string): Promise<number>;
    mget(...keys: string[]): Promise<Array<string | null>>;
    mget(keys: string[]): Promise<Array<string | null>>;
    pipeline(): Pipeline;
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    info(section?: string): Promise<string>;
    dbsize(): Promise<number>;
    flushdb(): Promise<string>;
    ping(): Promise<string>;
    quit(): Promise<'OK'>;
  }

  export default Redis;
  export { Redis };

  export interface Pipeline {
    set(key: string, value: string): Pipeline;
    setex(key: string, seconds: number, value: string): Pipeline;
    get(key: string): Pipeline;
    del(key: string | string[]): Pipeline;
    exec(): Promise<Array<[Error | null, any]>>;
  }

  export interface RedisOptions {
    port?: number;
    host?: string;
    family?: number;
    path?: string;
    keepAlive?: number;
    connectionName?: string;
    password?: string;
    db?: number;
    enableReadyCheck?: boolean;
    enableOfflineQueue?: boolean;
    connectTimeout?: number;
    disconnectTimeout?: number;
    commandTimeout?: number;
    retryStrategy?: (times: number) => number | void | null;
    maxRetriesPerRequest?: number;
    reconnectOnError?: (error: Error) => boolean | 1 | 2;
    readOnly?: boolean;
    stringNumbers?: boolean;
    enableAutoPipelining?: boolean;
    autoPipeliningIgnoredCommands?: string[];
    lazyConnect?: boolean;
    tls?: any;
    sentinels?: Array<{ host: string; port: number }>;
    name?: string;
    role?: 'master' | 'slave';
    sentinelRetryStrategy?: (times: number) => number | void | null;
    sentinelReconnectStrategy?: (times: number) => number | void | null;
    preferredSlaves?: Array<{ host: string; port: number }> | ((slaves: Array<{ host: string; port: number }>) => Array<{ host: string; port: number }>);
    natMap?: Record<string, { host: string; port: number }>;
    retryDelayOnFailover?: number;
    sentinelUsername?: string;
    sentinelPassword?: string;
    username?: string;
  }
}