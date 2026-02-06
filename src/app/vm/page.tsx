'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, Terminal, Database, Server, Globe, Container } from 'lucide-react'
import { MultiVMDashboard } from '@/components/vm'
import { ConsoleModal } from '@/components/console/ConsoleModal'
import type { VMInstance, VMProfile, VMDashboardStats, CreateVMOptions } from '@/types/multi-vm'

const connectionCards = [
  {
    name: 'SSH',
    icon: Terminal,
    command: 'ssh -p 2222 root@localhost',
    description: 'Password: vibecode',
  },
  {
    name: 'PostgreSQL',
    icon: Database,
    command: 'psql -h localhost -U postgres',
    description: 'PostgreSQL 16',
  },
  {
    name: 'Valkey',
    icon: Server,
    command: 'redis-cli -h localhost -p 6379',
    description: 'Valkey 7.2 (Redis-compatible)',
  },
  {
    name: 'OpenVSCode',
    icon: Globe,
    command: 'http://localhost:3000',
    description: 'Browser-based IDE',
  },
  {
    name: 'Docker',
    icon: Container,
    command: 'docker -H tcp://localhost:2375 info',
    description: 'Docker CE remote API',
  },
]

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

  const [consoleOpen, setConsoleOpen] = useState(false)
  const [copiedCard, setCopiedCard] = useState<string | null>(null)

  const handleCopy = useCallback(async (command: string, name: string) => {
    await navigator.clipboard.writeText(command)
    setCopiedCard(name)
    setTimeout(() => setCopiedCard(null), 2000)
  }, [])

  const activeVM = vms.find((vm) => vm.status.status === 'running')
  const consoleWorkspaceId = activeVM?.id || 'default'

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Virtual Machines</h1>
        <button
          onClick={() => setConsoleOpen(true)}
          className="inline-flex items-center space-x-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          <Terminal className="h-4 w-4" />
          <span>View Console</span>
        </button>
      </div>

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

      {/* Quick Connect */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Connect</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {connectionCards.map((card) => {
            const Icon = card.icon
            const isCopied = copiedCard === card.name
            return (
              <div
                key={card.name}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-gray-900">{card.name}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(card.command, card.name)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    title={isCopied ? 'Copied!' : 'Copy command'}
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-2">{card.description}</p>
                <code className="block text-sm bg-gray-50 text-gray-800 rounded px-3 py-2 font-mono break-all">
                  {card.command}
                </code>
              </div>
            )
          })}
        </div>
      </div>

      <ConsoleModal
        isOpen={consoleOpen}
        onClose={() => setConsoleOpen(false)}
        workspaceId={consoleWorkspaceId}
      />
    </>
  )
}
