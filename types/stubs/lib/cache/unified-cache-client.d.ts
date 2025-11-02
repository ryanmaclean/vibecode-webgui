export const cache: {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>;
};

export const CacheTTL: {
  HOUR: number;
};
