'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { VMInstance, VMService, PortMapping } from '@/types/multi-vm';

/**
 * Props for VMCard component
 */
export interface VMCardProps {
  /** VM instance data */
  vm: VMInstance;
  /** Handle start action */
  onStart?: (id: string) => void;
  /** Handle stop action */
  onStop?: (id: string) => void;
  /** Handle SSH action */
  onSSH?: (id: string) => void;
  /** Handle delete action */
  onDelete?: (id: string) => void;
  /** Handle clone action */
  onClone?: (id: string) => void;
  /** Handle view details action */
  onViewDetails?: (id: string) => void;
  /** Whether actions are disabled */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Status badge variant mapping
 */
const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  running: 'default',
  stopped: 'secondary',
  creating: 'outline',
  stopping: 'outline',
  error: 'destructive',
  unknown: 'secondary'
};

/**
 * Status display text
 */
const statusText: Record<string, string> = {
  running: 'Running',
  stopped: 'Stopped',
  creating: 'Creating...',
  stopping: 'Stopping...',
  error: 'Error',
  unknown: 'Unknown'
};

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
 * Format uptime for display
 */
function formatUptime(seconds?: number): string {
  if (!seconds) return 'N/A';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Service status indicator component
 */
const ServiceIndicator = React.memo(function ServiceIndicator({
  service
}: {
  service: VMService
}) {
  const statusColors = {
    running: 'bg-green-500',
    stopped: 'bg-gray-400',
    starting: 'bg-yellow-500',
    error: 'bg-red-500'
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          statusColors[service.status]
        )}
      />
      <span className="text-muted-foreground">{service.name}</span>
      {service.port && (
        <span className="text-xs text-muted-foreground">:{service.port}</span>
      )}
    </div>
  );
});

/**
 * Port mapping display component
 */
const PortMappingDisplay = React.memo(function PortMappingDisplay({
  mapping
}: {
  mapping: PortMapping
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="font-mono text-muted-foreground">
        {mapping.host}:{mapping.guest}
      </span>
      {mapping.service && (
        <span className="text-muted-foreground">({mapping.service})</span>
      )}
    </div>
  );
});

/**
 * Resource usage bar component
 */
const ResourceBar = React.memo(function ResourceBar({
  label,
  value,
  max,
  unit = '%'
}: {
  label: string;
  value: number;
  max: number;
  unit?: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  const displayValue = unit === '%' ? value : `${value}/${max}`;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{displayValue}{unit === '%' ? '%' : ''}</span>
      </div>
      <Progress value={percentage} className="h-1.5" />
    </div>
  );
});

/**
 * VM Card Component
 * Displays a single VM instance with status, resources, and actions
 */
export const VMCard = React.memo(function VMCard({
  vm,
  onStart,
  onStop,
  onSSH,
  onDelete,
  onClone,
  onViewDetails,
  disabled = false,
  className
}: VMCardProps) {
  const isRunning = vm.status.status === 'running';
  const isStopped = vm.status.status === 'stopped';
  const isTransitioning = vm.status.status === 'creating' || vm.status.status === 'stopping';
  const hasError = vm.status.status === 'error';

  const handleStart = React.useCallback(() => {
    onStart?.(vm.id);
  }, [vm.id, onStart]);

  const handleStop = React.useCallback(() => {
    onStop?.(vm.id);
  }, [vm.id, onStop]);

  const handleSSH = React.useCallback(() => {
    onSSH?.(vm.id);
  }, [vm.id, onSSH]);

  const handleDelete = React.useCallback(() => {
    onDelete?.(vm.id);
  }, [vm.id, onDelete]);

  const handleClone = React.useCallback(() => {
    onClone?.(vm.id);
  }, [vm.id, onClone]);

  const handleViewDetails = React.useCallback(() => {
    onViewDetails?.(vm.id);
  }, [vm.id, onViewDetails]);

  return (
    <Card
      className={cn(
        'relative transition-shadow hover:shadow-md',
        hasError && 'border-destructive',
        className
      )}
    >
      {/* Status indicator dot */}
      <div
        className={cn(
          'absolute top-4 right-4 w-3 h-3 rounded-full',
          isRunning && 'bg-green-500 animate-pulse',
          isStopped && 'bg-gray-400',
          isTransitioning && 'bg-yellow-500 animate-pulse',
          hasError && 'bg-red-500'
        )}
      />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between pr-6">
          <CardTitle className="text-lg font-semibold">{vm.name}</CardTitle>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={statusVariants[vm.status.status] || 'secondary'}>
            {statusText[vm.status.status] || vm.status.status}
          </Badge>
          {vm.project && (
            <Badge variant="outline" className="text-xs">
              {vm.project.name}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Resource Usage */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Resources</h4>
          <div className="space-y-2">
            <ResourceBar
              label="CPU"
              value={vm.status.currentUsage?.cpuPercent || 0}
              max={100}
            />
            <ResourceBar
              label="Memory"
              value={vm.status.currentUsage?.memoryPercent || 0}
              max={100}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{vm.resources.cpuCores} CPU</span>
            <span>{formatMemory(vm.resources.memoryMB)}</span>
            <span>{formatMemory(vm.resources.diskMB)} Disk</span>
          </div>
        </div>

        {/* Running Services */}
        {vm.services.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Services</h4>
            <div className="space-y-1">
              {vm.services.slice(0, 3).map((service) => (
                <ServiceIndicator key={service.name} service={service} />
              ))}
              {vm.services.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{vm.services.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Port Mappings */}
        {vm.ports.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Ports</h4>
            <div className="flex flex-wrap gap-2">
              {vm.ports.slice(0, 4).map((port, index) => (
                <PortMappingDisplay key={index} mapping={port} />
              ))}
              {vm.ports.length > 4 && (
                <span className="text-xs text-muted-foreground">
                  +{vm.ports.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Uptime and Health */}
        {isRunning && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Uptime: {formatUptime(vm.status.uptimeSeconds)}</span>
            <span>Health: {vm.status.health}%</span>
          </div>
        )}

        {/* Error Message */}
        {hasError && vm.status.errorMessage && (
          <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">
            {vm.status.errorMessage}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 pt-2">
        {isStopped && onStart && (
          <Button
            size="sm"
            onClick={handleStart}
            disabled={disabled || isTransitioning}
          >
            Start
          </Button>
        )}
        {isRunning && onStop && (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleStop}
            disabled={disabled || isTransitioning}
          >
            Stop
          </Button>
        )}
        {isRunning && onSSH && vm.ssh && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSSH}
            disabled={disabled}
          >
            SSH
          </Button>
        )}
        {onClone && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleClone}
            disabled={disabled || isTransitioning}
          >
            Clone
          </Button>
        )}
        {onViewDetails && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleViewDetails}
          >
            Details
          </Button>
        )}
        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={disabled || isTransitioning}
          >
            Delete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
});

VMCard.displayName = 'VMCard';
