declare module 'yjs' {
  export class Doc {}
}

declare module 'y-websocket' {
  export class WebsocketProvider {
    constructor(url: string, room: string, doc: any, opts?: any)
    destroy(): void
  }
}

declare module 'y-indexeddb' {
  export class IndexeddbPersistence {
    constructor(name: string, doc: any)
    destroy(): void
  }
}

declare module 'y-websocket/bin/utils' {
  export function setPersistence(persistence: any): void
}

declare module 'y-leveldb' {
  export class LeveldbPersistence {
    constructor(dir: string)
  }
}

declare module 'ioredis' {
  export class Redis {
    constructor(url?: string)
    on(event: string, cb: (...args: any[]) => void): void
    quit(): Promise<void>
  }
}
