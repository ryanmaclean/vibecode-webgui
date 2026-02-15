/**
 * React hook for Tailscale network functionality
 */

import { useState, useCallback, useEffect } from 'react'
import {
  isInstalled,
  getStatus,
  getIp,
  getSecureBindAddr,
  startCodeServerSecure,
  checkServiceAccessible,
  getNetworkInfo,
  verifyZeroTrust,
  TailscaleStatus,
  TailscaleConfig
} from '@/lib/api/tailscale'

interface UseTailscaleOptions {
  onStatusChange?: (status: TailscaleStatus) => void
  onError?: (error: string) => void
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useTailscale(options: UseTailscaleOptions = {}) {
  const [status, setStatus] = useState<TailscaleStatus | null>(null)
  const [installed, setInstalled] = useState<boolean>(false)
  const [ip, setIp] = useState<string | null>(null)
  const [networkInfo, setNetworkInfo] = useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { onStatusChange, onError, autoRefresh = false, refreshInterval = 5000 } = options

  const checkInstallation = useCallback(async (): Promise<boolean> => {
    try {
      const isInstalledResult = await isInstalled()
      setInstalled(isInstalledResult)
      return isInstalledResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check Tailscale installation'
      setError(errorMessage)
      onError?.(errorMessage)
      return false
    }
  }, [onError])

  const refreshStatus = useCallback(async (): Promise<TailscaleStatus | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const currentStatus = await getStatus()
      setStatus(currentStatus)
      onStatusChange?.(currentStatus)
      return currentStatus
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get Tailscale status'
      setError(errorMessage)
      onError?.(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [onStatusChange, onError])

  const refreshIp = useCallback(async (): Promise<string | null> => {
    try {
      const currentIp = await getIp()
      setIp(currentIp)
      return currentIp
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get Tailscale IP'
      setError(errorMessage)
      onError?.(errorMessage)
      return null
    }
  }, [onError])

  const refreshNetworkInfo = useCallback(async (): Promise<Record<string, unknown> | null> => {
    try {
      const info = await getNetworkInfo()
      setNetworkInfo(info)
      return info
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get network info'
      setError(errorMessage)
      onError?.(errorMessage)
      return null
    }
  }, [onError])

  const getSecureBind = useCallback(async (port: number): Promise<string | null> => {
    try {
      return await getSecureBindAddr(port)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get secure bind address'
      setError(errorMessage)
      onError?.(errorMessage)
      return null
    }
  }, [onError])

  const startSecureCodeServer = useCallback(async (port: number): Promise<string | null> => {
    try {
      return await startCodeServerSecure(port)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start secure code-server'
      setError(errorMessage)
      onError?.(errorMessage)
      return null
    }
  }, [onError])

  const checkService = useCallback(async (port: number): Promise<boolean> => {
    try {
      return await checkServiceAccessible(port)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check service accessibility'
      setError(errorMessage)
      onError?.(errorMessage)
      return false
    }
  }, [onError])

  const verifySecureConfig = useCallback(async (): Promise<string[] | null> => {
    try {
      return await verifyZeroTrust()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify zero-trust configuration'
      setError(errorMessage)
      onError?.(errorMessage)
      return null
    }
  }, [onError])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Auto-refresh status if enabled
  useEffect(() => {
    if (autoRefresh && installed) {
      const interval = setInterval(() => {
        refreshStatus()
      }, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [autoRefresh, installed, refreshInterval, refreshStatus])

  // Check installation on mount
  useEffect(() => {
    checkInstallation()
  }, [checkInstallation])

  return {
    // State
    status,
    installed,
    ip,
    networkInfo,
    isLoading,
    error,
    connected: status?.connected ?? false,

    // Actions
    checkInstallation,
    refreshStatus,
    refreshIp,
    refreshNetworkInfo,
    getSecureBind,
    startSecureCodeServer,
    checkService,
    verifySecureConfig,
    clearError
  }
}

// Hook for monitoring specific service accessibility
export function useServiceMonitoring(port: number, checkInterval = 10000) {
  const [isAccessible, setIsAccessible] = useState<boolean>(false)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkAccessibility = useCallback(async () => {
    setIsChecking(true)
    setError(null)

    try {
      const accessible = await checkServiceAccessible(port)
      setIsAccessible(accessible)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check service accessibility'
      setError(errorMessage)
      setIsAccessible(false)
    } finally {
      setIsChecking(false)
    }
  }, [port])

  useEffect(() => {
    checkAccessibility()

    const interval = setInterval(() => {
      checkAccessibility()
    }, checkInterval)

    return () => clearInterval(interval)
  }, [checkAccessibility, checkInterval])

  return {
    isAccessible,
    isChecking,
    error,
    checkAccessibility
  }
}

// Hook for zero-trust verification
export function useZeroTrustVerification() {
  const [verificationResults, setVerificationResults] = useState<string[] | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verify = useCallback(async () => {
    setIsVerifying(true)
    setError(null)

    try {
      const results = await verifyZeroTrust()
      setVerificationResults(results)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify zero-trust configuration'
      setError(errorMessage)
      setVerificationResults(null)
    } finally {
      setIsVerifying(false)
    }
  }, [])

  return {
    verificationResults,
    isVerifying,
    error,
    verify
  }
}
