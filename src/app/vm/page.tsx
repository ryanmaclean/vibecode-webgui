'use client'

import { useState, useEffect, useCallback } from 'react'
import { MultiVMDashboard } from '@/components/vm'
import type { VMInstance, VMProfile, VMDashboardStats, CreateVMOptions } from '@/types/multi-vm'

/**
 * VM Dashboard Page
 *
 * Main page for managing virtual machine instances.
 * Fetches VM data from /api/vm/instances and renders the MultiVMDashboard.
 */
export default function VMDashboardPage() {
  const [vms, setVMs] = useState<VMInstance[]>([])
  const [profiles, setProfiles] = useState<VMProfile[]>([])
  const [stats, setStats] = useState<VMDashboardStats | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  const fetchVMs = useCallback(async () => {
    try {
      setLoading(true)
      setError(undefined)

      const response = await fetch('/api/vm/instances')
      if (!response.ok) {
        throw new Error(`Failed to fetch VMs: ${response.statusText}`)
      }

      const data = await response.json()
      setVMs(data.instances || [])

      if (data.resourceUsage && data.limits) {
        const instances: VMInstance[] = data.instances || []
        setStats({
          totalVMs: instances.length,
          runningVMs: instances.filter((vm: VMInstance) => vm.status.status === 'running').length,
          stoppedVMs: instances.filter((vm: VMInstance) => vm.status.status === 'stopped').length,
          errorVMs: instances.filter((vm: VMInstance) => vm.status.status === 'error').length,
          resourceUsage: data.resourceUsage,
          availableCapacity: {
            vms: data.limits.maxVMs - instances.length,
            cpuCores: data.limits.maxTotalCPU - data.resourceUsage.cpuCoresUsed,
            memoryMB: data.limits.maxTotalMemoryMB - data.resourceUsage.memoryUsedMB,
          },
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load VMs')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProfiles = useCallback(async () => {
    try {
      const response = await fetch('/api/vm/profiles')
      if (response.ok) {
        const data = await response.json()
        setProfiles(data.profiles || [])
      }
    } catch {
      // Profiles are optional; use defaults if fetch fails
      setProfiles([
        {
          id: 'development',
          name: 'Development',
          description: 'Full development environment with common tools',
          config: {},
          resources: { cpuCores: 2, memoryMB: 2048, diskMB: 10240 },
          defaultPorts: [],
          services: ['ssh', 'node', 'python'],
          category: 'development',
          isBuiltIn: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'minimal',
          name: 'Minimal',
          description: 'Lightweight VM with minimal resources',
          config: {},
          resources: { cpuCores: 1, memoryMB: 512, diskMB: 4096 },
          defaultPorts: [],
          services: ['ssh'],
          category: 'minimal',
          isBuiltIn: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'testing',
          name: 'Testing',
          description: 'VM configured for running tests and CI',
          config: {},
          resources: { cpuCores: 2, memoryMB: 4096, diskMB: 20480 },
          defaultPorts: [],
          services: ['ssh', 'docker'],
          category: 'testing',
          isBuiltIn: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    }
  }, [])

  useEffect(() => {
    fetchVMs()
    fetchProfiles()
  }, [fetchVMs, fetchProfiles])

  const handleCreateVM = useCallback(async (options: CreateVMOptions) => {
    try {
      setLoading(true)
      const response = await fetch('/api/vm/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create VM')
      }

      await fetchVMs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create VM')
    } finally {
      setLoading(false)
    }
  }, [fetchVMs])

  const handleStartVM = useCallback(async (id: string) => {
    try {
      await fetch(`/api/vm/instances/${id}/start`, { method: 'POST' })
      await fetchVMs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start VM')
    }
  }, [fetchVMs])

  const handleStopVM = useCallback(async (id: string) => {
    try {
      await fetch(`/api/vm/instances/${id}/stop`, { method: 'POST' })
      await fetchVMs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop VM')
    }
  }, [fetchVMs])

  const handleDeleteVM = useCallback(async (id: string) => {
    try {
      await fetch(`/api/vm/instances/${id}`, { method: 'DELETE' })
      await fetchVMs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete VM')
    }
  }, [fetchVMs])

  const handleCloneVM = useCallback(async (id: string) => {
    try {
      await fetch(`/api/vm/instances/${id}/clone`, { method: 'POST' })
      await fetchVMs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone VM')
    }
  }, [fetchVMs])

  return (
    <MultiVMDashboard
      vms={vms}
      profiles={profiles}
      stats={stats}
      loading={loading}
      error={error}
      onCreateVM={handleCreateVM}
      onStartVM={handleStartVM}
      onStopVM={handleStopVM}
      onDeleteVM={handleDeleteVM}
      onCloneVM={handleCloneVM}
      onRefresh={fetchVMs}
    />
  )
}
