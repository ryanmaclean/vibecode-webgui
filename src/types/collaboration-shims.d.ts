declare module 'yjs' {
  export type Text = any
  export type Map<T = any> = any

  export class Doc {
    getText(key?: string): Text
    getMap<T = any>(key?: string): Map<T>
    destroy(): void
  }

  export function encodeStateAsUpdate(doc: Doc): Uint8Array
  export function applyUpdate(doc: Doc, update: Uint8Array): void
}

declare module 'y-websocket' {
  export class WebsocketProvider {
    constructor(url: string, room: string, doc: any, opts?: any)
    destroy(): void
    awareness?: {
      setLocalStateField: (key: string, value: any) => void
      on: (event: string, cb: (...args: any[]) => void) => void
      getStates: () => any
      getLocalState: () => any
    }
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
    constructor(dir: string, doc?: any)
    whenSynced: Promise<void>
    destroy(): void
  }
}

declare module 'ioredis' {
  export class Redis {
    constructor(url?: string)
    on(event: string, cb: (...args: any[]) => void): void
    subscribe(channel: string, ...rest: any[]): Promise<number>
    publish(channel: string, message: string): Promise<number>
    quit(): Promise<void>
  }
}

declare module 'socket.io' {
  export class Server<T = any> {
    constructor(httpServer?: any, opts?: any)
    on(event: string, cb: (...args: any[]) => void): void
    to(room: string): this
    emit(event: string, ...args: any[]): void
  }
}

declare module '@anthropic-ai/sdk' {
  export default class Anthropic {
    constructor(...args: any[])
    messages: {
      create: (args: any) => Promise<any>
    }
  }
}
