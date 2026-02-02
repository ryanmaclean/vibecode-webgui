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
    on(event: string, cb: (...args: any[]) => void): void
    off(event: string, cb: (...args: any[]) => void): void
    on(event: string, cb: (...args: any[]) => void): void
    off(event: string, cb: (...args: any[]) => void): void
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

// CodeMirror module declarations for collaborative editing
declare module '@codemirror/basic-setup' {
  import { Extension } from '@codemirror/state'
  export const basicSetup: Extension
}

declare module '@codemirror/lang-html' {
  import { Extension } from '@codemirror/state'
  export function html(): Extension
}

declare module '@codemirror/lang-css' {
  import { Extension } from '@codemirror/state'
  export function css(): Extension
}

declare module 'y-codemirror.next' {
  import { Extension } from '@codemirror/state'
  import type { Text } from 'yjs'
  import type { Awareness } from 'y-protocols/awareness'
  export function yCollab(ytext: Text, awareness: Awareness | null, options?: any): Extension
}
