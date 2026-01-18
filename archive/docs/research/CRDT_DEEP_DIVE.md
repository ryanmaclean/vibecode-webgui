# CRDTs - The Key to Distributed VibeCode

## What Are CRDTs?

**Conflict-free Replicated Data Types** - Data structures that can be replicated across multiple computers, modified independently, and merged automatically without conflicts.

### The Problem They Solve

```
Traditional Approach (Fails):
Developer A: Changes line 5 to "hello"
Developer B: Changes line 5 to "world"
System: CONFLICT! Who wins?

CRDT Approach (Works):
Developer A: Changes line 5 to "hello"
Developer B: Changes line 5 to "world"
System: Both changes preserved, merged deterministically
Result: "helloworld" or "worldhello" (based on algorithm)
```

## How CRDTs Work

### Core Principle: Commutativity

```
A ∪ B = B ∪ A

Order doesn't matter.
Applying changes in any order produces the same result.
```

### Types of CRDTs

#### 1. State-based CRDTs (CvRDT)
```
Each replica maintains full state
Merge function: combine two states
Requirement: Merge must be commutative, associative, idempotent

Example: LWW-Register (Last-Write-Wins)
{
  value: "hello",
  timestamp: 1696204800,
  replicaId: "alice"
}
```

#### 2. Operation-based CRDTs (CmRDT)
```
Each replica broadcasts operations
Operations must commute
Requirement: Operations applied in causal order

Example: Counter
increment(5)  // Can apply in any order
decrement(2)  // Result is always the same
```

## CRDT Implementations for Code

### 1. Yjs (Most Popular)

**What it is**: CRDT framework for shared editing

```typescript
import * as Y from 'yjs'

// Create document
const doc = new Y.Doc()

// Create shared text
const yText = doc.getText('code')

// Insert text
yText.insert(0, 'function hello() {\n')
yText.insert(20, '  return "world"\n')
yText.insert(40, '}')

// Changes sync automatically across peers
```

**How it works**:
- Each character has a unique ID (position + replica ID)
- Deletions are tombstones (marked, not removed)
- Insertions reference previous character
- Merges are deterministic

**Data structure**:
```
[
  {id: [0, 'alice'], content: 'f'},
  {id: [1, 'alice'], content: 'u'},
  {id: [2, 'alice'], content: 'n'},
  {id: [0, 'bob'], content: 'c', after: [2, 'alice']},
  // ...
]
```

**Advantages**:
- Fast (optimized for text editing)
- Small network overhead
- Works with WebRTC, WebSocket
- Rich ecosystem (y-monaco, y-codemirror, y-prosemirror)

**Use in VibeCode**:
```typescript
// Shared code editor
const doc = new Y.Doc()
const yText = doc.getText('editor')

// Sync with peers
const provider = new WebrtcProvider('vibecode-room', doc)

// Bind to Monaco editor
const binding = new MonacoBinding(
  yText,
  editor.getModel(),
  new Set([editor]),
  provider.awareness
)
```

### 2. Automerge

**What it is**: CRDT library with JSON-like API

```typescript
import * as Automerge from '@automerge/automerge'

// Create document
let doc = Automerge.init()

// Make changes
doc = Automerge.change(doc, doc => {
  doc.files = {}
  doc.files['index.js'] = {
    content: 'console.log("hello")',
    language: 'javascript'
  }
})

// Sync with peers
const changes = Automerge.getChanges(oldDoc, newDoc)
// Send changes to peers
// Merge changes from peers
doc = Automerge.applyChanges(doc, receivedChanges)
```

**How it works**:
- Operation-based CRDT
- Tracks causality with vector clocks
- Efficient binary format
- Time-travel (full history)

**Advantages**:
- JSON-like API (familiar)
- Full history (undo/redo)
- Rust implementation (fast)
- WASM bindings

**Use in VibeCode**:
```typescript
// Project state
let project = Automerge.init()

project = Automerge.change(project, doc => {
  doc.files = {
    'src/App.tsx': { content: '...', cursor: 0 },
    'src/index.tsx': { content: '...', cursor: 0 }
  }
  doc.settings = {
    theme: 'dark',
    fontSize: 14
  }
})
```

### 3. RxDB CRDT Plugin

**What it is**: Database with built-in CRDT

```typescript
import { createRxDatabase } from 'rxdb'
import { RxDBCRDTPlugin } from 'rxdb/plugins/crdt'

const db = await createRxDatabase({
  name: 'vibecode',
  storage: getRxStorageDexie()
})

await db.addCollections({
  files: {
    schema: fileSchema,
    crdt: {
      field: 'content',
      algorithm: 'yjs'
    }
  }
})

// Changes sync automatically
await db.files.insert({
  name: 'index.js',
  content: 'console.log("hello")'
})
```

**Advantages**:
- Database + CRDT in one
- Offline-first
- Observable queries
- Multi-tab sync

## CRDT Algorithms Deep Dive

### 1. LWW-Element-Set (Last-Write-Wins)

```typescript
interface LWWSet<T> {
  adds: Map<T, Timestamp>
  removes: Map<T, Timestamp>
}

function add(set: LWWSet, element: T, timestamp: Timestamp) {
  set.adds.set(element, timestamp)
}

function remove(set: LWWSet, element: T, timestamp: Timestamp) {
  set.removes.set(element, timestamp)
}

function contains(set: LWWSet, element: T): boolean {
  const addTime = set.adds.get(element) || 0
  const removeTime = set.removes.get(element) || 0
  return addTime > removeTime
}

function merge(set1: LWWSet, set2: LWWSet): LWWSet {
  return {
    adds: mergeMaps(set1.adds, set2.adds, Math.max),
    removes: mergeMaps(set1.removes, set2.removes, Math.max)
  }
}
```

**Use case**: File system (files added/removed)

### 2. RGA (Replicated Growable Array)

```typescript
interface RGANode {
  id: [number, string] // [position, replicaId]
  value: string
  next: RGANode | null
  tombstone: boolean
}

function insert(rga: RGA, after: RGANode, value: string, id: [number, string]) {
  const newNode = {
    id,
    value,
    next: after.next,
    tombstone: false
  }
  after.next = newNode
}

function delete(rga: RGA, node: RGANode) {
  node.tombstone = true // Don't actually remove
}
```

**Use case**: Text editing (what Yjs uses internally)

### 3. OR-Set (Observed-Remove Set)

```typescript
interface ORSet<T> {
  elements: Map<T, Set<string>> // element -> unique tags
}

function add(set: ORSet, element: T, tag: string) {
  if (!set.elements.has(element)) {
    set.elements.set(element, new Set())
  }
  set.elements.get(element)!.add(tag)
}

function remove(set: ORSet, element: T) {
  set.elements.delete(element)
}

function merge(set1: ORSet, set2: ORSet): ORSet {
  const result = new Map()
  for (const [elem, tags1] of set1.elements) {
    const tags2 = set2.elements.get(elem) || new Set()
    result.set(elem, new Set([...tags1, ...tags2]))
  }
  return { elements: result }
}
```

**Use case**: Collaborative lists, tags

## libSQL + Turso: Single-File Database with Replication

### What is libSQL?

**Fork of SQLite** with modern features:
- Embedded (single file)
- Distributed (multi-region)
- Real-time sync
- HTTP API
- WASM support

### How Turso Works

```typescript
import { createClient } from '@libsql/client'

// Local database
const db = createClient({
  url: 'file:local.db'
})

// Or cloud database
const cloudDb = createClient({
  url: 'libsql://vibecode-db.turso.io',
  authToken: process.env.TURSO_TOKEN
})

// Hybrid: Local + Cloud sync
const syncDb = createClient({
  url: 'file:local.db',
  syncUrl: 'libsql://vibecode-db.turso.io',
  syncInterval: 60 // seconds
})

// Use like SQLite
await db.execute('CREATE TABLE files (name TEXT, content TEXT)')
await db.execute('INSERT INTO files VALUES (?, ?)', ['index.js', 'console.log("hello")'])

const result = await db.execute('SELECT * FROM files')
```

### Turso's Replication Model

```
┌─────────────────────────────────────────────┐
│         Primary Database                    │
│         (libSQL server)                     │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
┌──────▼──────┐  ┌────▼────────┐
│ Replica     │  │ Replica     │
│ (US-West)   │  │ (EU-West)   │
└──────┬──────┘  └────┬────────┘
       │               │
   ┌───▼───┐      ┌───▼───┐
   │ Local │      │ Local │
   │ Cache │      │ Cache │
   └───────┘      └───────┘
```

**Features**:
- Multi-region replicas
- Local caching
- Automatic failover
- Low latency reads
- Strong consistency writes

### Embedded Replicas (Game Changer)

```typescript
import { createClient } from '@libsql/client/web'

// In browser or Electron
const db = await createClient({
  url: 'file:vibecode.db', // IndexedDB in browser
  syncUrl: 'https://vibecode-db.turso.io',
  syncInterval: 5
})

// Works offline!
await db.execute('INSERT INTO files VALUES (?, ?)', ['test.js', 'code'])

// Syncs when online
// Conflicts resolved automatically
```

## Combining CRDTs + libSQL for VibeCode

### Architecture

```
┌─────────────────────────────────────────────┐
│         VibeCode Instance (Local)           │
│  ┌───────────────────────────────────────┐  │
│  │ CRDT Layer (Yjs/Automerge)            │  │
│  │ - Real-time text editing              │  │
│  │ - Cursor positions                    │  │
│  │ - Selections                          │  │
│  └───────────────┬───────────────────────┘  │
│                  │                           │
│  ┌───────────────▼───────────────────────┐  │
│  │ libSQL Database (Turso)               │  │
│  │ - File metadata                       │  │
│  │ - Project settings                    │  │
│  │ - User preferences                    │  │
│  │ - Git history                         │  │
│  └───────────────┬───────────────────────┘  │
│                  │                           │
│         Sync Layer (P2P + Cloud)            │
└──────────────────┬──────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
┌──────▼──────┐        ┌──────▼──────┐
│ Peer        │        │ Cloud       │
│ (WebRTC)    │        │ (Turso)     │
└─────────────┘        └─────────────┘
```

### Implementation

```typescript
// 1. Initialize CRDT for real-time editing
const doc = new Y.Doc()
const yText = doc.getText('editor')

// 2. Initialize libSQL for persistence
const db = await createClient({
  url: 'file:vibecode.db',
  syncUrl: 'libsql://vibecode.turso.io',
  syncInterval: 10
})

// 3. Sync CRDT to database periodically
yText.observe(event => {
  // Debounce writes
  debouncedSave(() => {
    db.execute(
      'UPDATE files SET content = ? WHERE name = ?',
      [yText.toString(), currentFile]
    )
  })
})

// 4. Load from database on startup
const result = await db.execute('SELECT content FROM files WHERE name = ?', [fileName])
yText.insert(0, result.rows[0].content)

// 5. P2P sync for real-time collaboration
const provider = new WebrtcProvider('vibecode-room', doc)

// 6. Cloud sync for persistence and backup
// (handled automatically by Turso)
```

## Why This Matters for VibeCode

### 1. Offline-First
```
Developer works on plane (no internet)
├─ CRDT: Changes tracked locally
├─ libSQL: Saved to local database
└─ When online: Syncs automatically
```

### 2. Real-Time Collaboration
```
Developer A types in SF
├─ CRDT: Change propagates via WebRTC
└─ Developer B sees it instantly in London
```

### 3. Conflict-Free
```
Both developers edit same line
├─ CRDT: Merges automatically
└─ No "who wins?" conflicts
```

### 4. Global Low Latency
```
Developer in Tokyo
├─ Reads from local Turso replica (< 10ms)
├─ Writes go to nearest region
└─ Syncs globally in background
```

### 5. Full History
```
Every change tracked
├─ CRDT: Operation log
├─ libSQL: Snapshots
└─ Time-travel debugging
```

## Performance Characteristics

### Yjs
- Insert: O(1) amortized
- Delete: O(1)
- Merge: O(n) where n = operations
- Memory: ~10 bytes per character
- Network: ~5 bytes per operation

### Automerge
- Insert: O(log n)
- Delete: O(log n)
- Merge: O(m) where m = changes
- Memory: ~50 bytes per character
- Network: ~20 bytes per operation

### libSQL/Turso
- Read: < 10ms (local replica)
- Write: ~50ms (nearest region)
- Sync: ~100ms (global)
- Storage: Same as SQLite
- Replication lag: < 1 second

## Conclusion

**CRDTs + libSQL = Perfect for VibeCode**

- **CRDTs**: Real-time collaboration, conflict-free
- **libSQL**: Persistence, querying, global sync
- **Together**: Offline-first, real-time, globally distributed

This is how Figma, Linear, and Notion work.  
This is how VibeCode should work.

---

*CRDT Deep Dive - October 1, 2025*  
*The Foundation of Distributed Collaboration*
