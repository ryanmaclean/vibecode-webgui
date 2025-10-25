"use client"

import { useEffect, useState } from 'react'

export default function OfflineEditor() {
  const [readyAt, setReadyAt] = useState<number | null>(null)

  useEffect(() => {
    const t0 = performance.now()
    // Simulate quick init work; future: mount Monaco + IndexedDB
    requestAnimationFrame(() => {
      const t1 = performance.now()
      setReadyAt(Math.round(t1 - t0))
    })
  }, [])

  return (
    <main style={{ padding: 16 }}>
      <h1>Offline Editor (Lite)</h1>
      <p>This route is designed to work without a backend. Assets can be cached via Service Worker.</p>
      <ul>
        <li>Editor: placeholder (Monaco to be added)</li>
        <li>Storage: IndexedDB (TBD)</li>
        <li>Sync: Git/HTTP when back online (TBD)</li>
      </ul>
      <p>{readyAt !== null ? `editor_ready_ms=${readyAt}` : 'initializing…'}</p>
    </main>
  )
}
