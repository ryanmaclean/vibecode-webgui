export interface VectorDatabaseConfig {
    user?: string;
    host?: string;
    database?: string;
    password?: string;
    port?: number;
    pool?: {
        min?: number;
        max?: number;
        idleTimeoutMillis?: number;
        connectionTimeoutMillis?: number;
    };
}
