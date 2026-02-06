'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VMCard } from './VMCard';
import type {
  VMInstance,
  VMProfile,
  VMDashboardStats,
  ResourceUsage,
  CreateVMOptions
} from '@/types/multi-vm';
import type { VMStatus } from '@/lib/vm/types';

/**
 * Props for MultiVMDashboard component
 */
export interface MultiVMDashboardProps {
  /** List of VM instances */
  vms: VMInstance[];
  /** Available profiles for creating VMs */
  profiles: VMProfile[];
  /** Dashboard statistics */
  stats?: VMDashboardStats;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string;
  /** Handle create VM */
  onCreateVM?: (options: CreateVMOptions) => void;
  /** Handle start VM */
  onStartVM?: (id: string) => void;
  /** Handle stop VM */
  onStopVM?: (id: string) => void;
  /** Handle SSH to VM */
  onSSHVM?: (id: string) => void;
  /** Handle delete VM */
  onDeleteVM?: (id: string) => void;
  /** Handle clone VM */
  onCloneVM?: (id: string) => void;
  /** Handle view VM details */
  onViewDetails?: (id: string) => void;
  /** Handle refresh */
  onRefresh?: () => void;
  /** Additional class name */
  className?: string;
}

/**
 * View mode for the dashboard
 */
type ViewMode = 'grid' | 'list';

/**
 * Filter options
 */
interface FilterOptions {
  status: VMStatus | 'all';
  profile: string | 'all';
  search: string;
}

/**
 * Format memory size for display
 */
function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)}GB`;
  }
  return `${mb}MB`;
}

/**
 * Resource overview card component
 */
const ResourceOverview = React.memo(function ResourceOverview({
  usage,
  limits
}: {
  usage: ResourceUsage;
  limits: { maxVMs: number; maxTotalCPU: number; maxTotalMemoryMB: number };
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Resource Usage</CardTitle>
        <CardDescription>System resource allocation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Active VMs</span>
            <span className="font-mono">{usage.activeVMs} / {limits.maxVMs}</span>
          </div>
          <Progress value={(usage.activeVMs / limits.maxVMs) * 100} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>CPU Cores</span>
            <span className="font-mono">{usage.cpuCoresUsed} / {limits.maxTotalCPU}</span>
          </div>
          <Progress value={usage.usagePercent.cpu} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Memory</span>
            <span className="font-mono">
              {formatMemory(usage.memoryUsedMB)} / {formatMemory(limits.maxTotalMemoryMB)}
            </span>
          </div>
          <Progress value={usage.usagePercent.memory} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Disk</span>
            <span className="font-mono">{usage.usagePercent.disk.toFixed(1)}%</span>
          </div>
          <Progress value={usage.usagePercent.disk} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
});

/**
 * Quick stats component
 */
const QuickStats = React.memo(function QuickStats({
  stats
}: {
  stats: VMDashboardStats;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold">{stats.totalVMs}</div>
          <p className="text-xs text-muted-foreground">Total VMs</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold text-green-600">{stats.runningVMs}</div>
          <p className="text-xs text-muted-foreground">Running</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold text-gray-500">{stats.stoppedVMs}</div>
          <p className="text-xs text-muted-foreground">Stopped</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold text-red-600">{stats.errorVMs}</div>
          <p className="text-xs text-muted-foreground">Errors</p>
        </CardContent>
      </Card>
    </div>
  );
});

/**
 * Create VM dialog/form component
 */
const CreateVMForm = React.memo(function CreateVMForm({
  profiles,
  onSubmit,
  onCancel,
  disabled
}: {
  profiles: VMProfile[];
  onSubmit: (options: CreateVMOptions) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [selectedProfile, setSelectedProfile] = React.useState<string>('development');
  const [vmName, setVmName] = React.useState('');

  const handleSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: vmName || undefined,
      profileId: selectedProfile,
      autoStart: true
    });
  }, [vmName, selectedProfile, onSubmit]);

  const selectedProfileData = profiles.find(p => p.id === selectedProfile);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New VM</CardTitle>
        <CardDescription>Choose a profile and configure your new VM</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="vm-name" className="text-sm font-medium">
              VM Name (optional)
            </label>
            <input
              id="vm-name"
              type="text"
              value={vmName}
              onChange={(e) => setVmName(e.target.value)}
              placeholder="my-dev-vm"
              className="w-full px-3 py-2 border rounded-md bg-background"
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="profile" className="text-sm font-medium">
              Profile
            </label>
            <Select
              value={selectedProfile}
              onValueChange={setSelectedProfile}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    <div className="flex items-center gap-2">
                      <span>{profile.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {profile.category}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProfileData && (
            <div className="p-3 bg-muted rounded-md space-y-2">
              <p className="text-sm text-muted-foreground">
                {selectedProfileData.description}
              </p>
              <div className="flex gap-4 text-xs">
                <span>{selectedProfileData.resources.cpuCores} CPU</span>
                <span>{formatMemory(selectedProfileData.resources.memoryMB)}</span>
                <span>{formatMemory(selectedProfileData.resources.diskMB)} Disk</span>
              </div>
              {selectedProfileData.services.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedProfileData.services.map((service) => (
                    <Badge key={service} variant="secondary" className="text-xs">
                      {service}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
              Cancel
            </Button>
            <Button type="submit" disabled={disabled}>
              Create VM
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
});

/**
 * Empty state component
 */
const EmptyState = React.memo(function EmptyState({
  onCreateClick
}: {
  onCreateClick: () => void;
}) {
  return (
    <Card className="col-span-full">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="text-4xl mb-4">No VMs</div>
        <h3 className="text-lg font-semibold mb-2">No virtual machines yet</h3>
        <p className="text-muted-foreground text-center mb-4">
          Create your first VM to get started with isolated development environments.
        </p>
        <Button onClick={onCreateClick}>Create Your First VM</Button>
      </CardContent>
    </Card>
  );
});

/**
 * Multi-VM Dashboard Component
 * Main dashboard for managing multiple VM instances
 */
export function MultiVMDashboard({
  vms,
  profiles,
  stats,
  loading = false,
  error,
  onCreateVM,
  onStartVM,
  onStopVM,
  onSSHVM,
  onDeleteVM,
  onCloneVM,
  onViewDetails,
  onRefresh,
  className
}: MultiVMDashboardProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [filters, setFilters] = React.useState<FilterOptions>({
    status: 'all',
    profile: 'all',
    search: ''
  });

  // Filter VMs based on current filters
  const filteredVMs = React.useMemo(() => {
    return vms.filter((vm) => {
      // Status filter
      if (filters.status !== 'all' && vm.status.status !== filters.status) {
        return false;
      }

      // Profile filter
      if (filters.profile !== 'all' && vm.profileId !== filters.profile) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesName = vm.name.toLowerCase().includes(searchLower);
        const matchesProject = vm.project?.name.toLowerCase().includes(searchLower);
        const matchesTags = vm.tags?.some(t => t.toLowerCase().includes(searchLower));

        if (!matchesName && !matchesProject && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [vms, filters]);

  const handleCreateVM = React.useCallback((options: CreateVMOptions) => {
    onCreateVM?.(options);
    setShowCreateForm(false);
  }, [onCreateVM]);

  const handleCancelCreate = React.useCallback(() => {
    setShowCreateForm(false);
  }, []);

  // Default stats if not provided
  const displayStats: VMDashboardStats = stats || {
    totalVMs: vms.length,
    runningVMs: vms.filter(vm => vm.status.status === 'running').length,
    stoppedVMs: vms.filter(vm => vm.status.status === 'stopped').length,
    errorVMs: vms.filter(vm => vm.status.status === 'error').length,
    resourceUsage: {
      cpuCoresUsed: vms.reduce((sum, vm) => sum + vm.resources.cpuCores, 0),
      memoryUsedMB: vms.reduce((sum, vm) => sum + vm.resources.memoryMB, 0),
      diskUsedMB: vms.reduce((sum, vm) => sum + vm.resources.diskMB, 0),
      activeVMs: vms.filter(vm => vm.status.status === 'running').length,
      usagePercent: { cpu: 0, memory: 0, disk: 0 }
    },
    availableCapacity: { vms: 4 - vms.length, cpuCores: 8, memoryMB: 8192 }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Virtual Machines</h1>
          <p className="text-muted-foreground">
            Manage your development environments
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh} disabled={loading}>
              Refresh
            </Button>
          )}
          <Button onClick={() => setShowCreateForm(true)} disabled={loading}>
            Create VM
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <QuickStats stats={displayStats} />

      {/* Create VM Form */}
      {showCreateForm && (
        <CreateVMForm
          profiles={profiles}
          onSubmit={handleCreateVM}
          onCancel={handleCancelCreate}
          disabled={loading}
        />
      )}

      {/* Filters and View Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search VMs..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(value) => setFilters(f => ({ ...f, status: value as FilterOptions['status'] }))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.profile}
          onValueChange={(value) => setFilters(f => ({ ...f, profile: value }))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Profile" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Profiles</SelectItem>
            {profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-r-none"
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-l-none"
          >
            List
          </Button>
        </div>
      </div>

      {/* Resource Overview (sidebar on larger screens) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {/* VM Grid/List */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded w-1/4 mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="h-4 bg-muted rounded" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredVMs.length === 0 ? (
            <EmptyState onCreateClick={() => setShowCreateForm(true)} />
          ) : (
            <div
              className={cn(
                'grid gap-4',
                viewMode === 'grid'
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1'
              )}
            >
              {filteredVMs.map((vm) => (
                <VMCard
                  key={vm.id}
                  vm={vm}
                  onStart={onStartVM}
                  onStop={onStopVM}
                  onSSH={onSSHVM}
                  onDelete={onDeleteVM}
                  onClone={onCloneVM}
                  onViewDetails={onViewDetails}
                  disabled={loading}
                />
              ))}
            </div>
          )}
        </div>

        {/* Resource Overview Sidebar */}
        <div className="lg:col-span-1">
          <ResourceOverview
            usage={displayStats.resourceUsage}
            limits={{
              maxVMs: 4,
              maxTotalCPU: 8,
              maxTotalMemoryMB: 8192
            }}
          />
        </div>
      </div>
    </div>
  );
}

MultiVMDashboard.displayName = 'MultiVMDashboard';
