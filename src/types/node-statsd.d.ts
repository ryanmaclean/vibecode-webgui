// Type definitions for node-statsd
declare module 'node-statsd' {
  export interface StatsDConfig {
    host?: string;
    port?: number;
    prefix?: string;
    suffix?: string;
    globalize?: boolean;
    cacheDns?: boolean;
    mock?: boolean;
    global_tags?: string[];
    globalTags?: string[];
    maxBufferSize?: number;
    bufferFlushInterval?: number;
  }

  export default class StatsD {
    constructor(config?: StatsDConfig);
    constructor(host?: string, port?: number, prefix?: string);

    increment(stat: string | string[], value?: number, sampleRate?: number, tags?: string[], callback?: (error?: Error) => void): void;
    decrement(stat: string | string[], value?: number, sampleRate?: number, tags?: string[], callback?: (error?: Error) => void): void;
    timing(stat: string | string[], time: number, sampleRate?: number, tags?: string[], callback?: (error?: Error) => void): void;
    histogram(stat: string | string[], value: number, sampleRate?: number, tags?: string[], callback?: (error?: Error) => void): void;
    gauge(stat: string | string[], value: number, sampleRate?: number, tags?: string[], callback?: (error?: Error) => void): void;
    set(stat: string | string[], value: number | string, sampleRate?: number, tags?: string[], callback?: (error?: Error) => void): void;
    unique(stat: string | string[], value: number | string, sampleRate?: number, tags?: string[], callback?: (error?: Error) => void): void;

    close(callback?: (error?: Error) => void): void;
  }
}
