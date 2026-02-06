'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SnapshotManager } from '@/components/vm'
import type { VMInstance } from '@/types/multi-vm'

/**
 * VM Snapshots Page
 *
 * Manages snapshots across all VM instances.
 * Allows selecting a VM and managing its snapshots via the SnapshotManager component.
 */
export default function VMSnapshotsPage() {
  const [vms, setVMs] = useState<VMInstance[]>([])
  const [selectedVMId, setSelectedVMId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const fetchVMs = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/vm/instances')
      if (response.ok) {
        const data = await response.json()
        const instances: VMInstance[] = data.instances || []
        setVMs(instances)
        if (instances.length > 0 && !selectedVMId) {
          setSelectedVMId(instances[0].id)
        }
      }
    } catch {
      // Handled by SnapshotManager
    } finally {
      setLoading(false)
    }
  }, [selectedVMId])

  useEffect(() => {
    fetchVMs()
  }, [fetchVMs])

  const selectedVM = vms.find((vm) => vm.id === selectedVMId)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/vm" className="hover:text-gray-700">
          Virtual Machines
        </Link>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900">Snapshots</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">VM Snapshots</h1>
        <p className="mt-1 text-gray-600">
          Save and restore VM state with point-in-time snapshots
        </p>
      </div>

      {/* VM Selector */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto" />
            <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto" />
          </div>
        </div>
      ) : vms.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Virtual Machines</h3>
          <p className="text-gray-600 mb-4">
            Create a VM first to manage its snapshots.
          </p>
          <Link
            href="/vm"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to VM Dashboard
          </Link>
        </div>
      ) : (
        <>
          {/* VM Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <label htmlFor="vm-select" className="block text-sm font-medium text-gray-700 mb-2">
              Select VM
            </label>
            <select
              id="vm-select"
              value={selectedVMId}
              onChange={(e) => setSelectedVMId(e.target.value)}
              className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              {vms.map((vm) => (
                <option key={vm.id} value={vm.id}>
                  {vm.name} ({vm.status.status})
                </option>
              ))}
            </select>
          </div>

          {/* Snapshot Manager */}
          {selectedVMId && (
            <SnapshotManager
              vmId={selectedVMId}
              vmName={selectedVM?.name}
              vmRunning={selectedVM?.status.status === 'running'}
            />
          )}
        </>
      )}
    </div>
  )
}
