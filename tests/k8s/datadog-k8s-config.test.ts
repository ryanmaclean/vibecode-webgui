import fs from 'node:fs'
import path from 'node:path'
import { load, loadAll } from 'js-yaml'

type HelmValues = {
  datadog: {
    logs?: { enabled?: boolean; containerCollectAll?: boolean; containerCollectUsingFiles?: boolean }
    apm?: { enabled?: boolean; portEnabled?: boolean }
    processAgent?: { enabled?: boolean }
    networkMonitoring?: { enabled?: boolean }
    databaseMonitoring?: { enabled?: boolean }
    collectEvents?: boolean
    kubeStateMetricsCore?: { enabled?: boolean }
    kubeStateMetricsScrape?: { enabled?: boolean }
    env?: Array<{ name: string }>
    confd?: Record<string, unknown>
  }
  securityAgent?: { runtime?: { enabled?: boolean }; compliance?: { enabled?: boolean } }
  systemProbe?: {
    enabled?: boolean
    enableTCPQueueLength?: boolean
    enableHTTPMonitoring?: boolean
    collectDNSStats?: boolean
  }
}

describe('Datadog Kubernetes configurations', () => {
  const helmFiles = [
    'k8s/datadog-values-kind.yaml',
    'k8s/kind-datadog-values.yaml',
    'k8s/datadog-values.yaml',
    'k8s/datadog-values-aks.yaml',
    'k8s/datadog-values-microk8s.yaml',
  ]

  it('enables required observability features across Helm values', () => {
    for (const relative of helmFiles) {
      const fullPath = path.join(process.cwd(), relative)
      const fileContents = fs.readFileSync(fullPath, 'utf8')
      const values = load(fileContents) as HelmValues

      expect(values.datadog?.logs?.enabled).toBe(true)
      expect(values.datadog?.logs?.containerCollectAll).toBe(true)
      expect(values.datadog?.logs?.containerCollectUsingFiles).toBe(true)
      expect(values.datadog?.apm?.enabled ?? values.datadog?.apm?.portEnabled).toBe(true)
      expect(values.datadog?.networkMonitoring?.enabled).toBe(true)
      expect(values.datadog?.collectEvents).toBe(true)
      expect(values.datadog?.kubeStateMetricsCore?.enabled).toBe(true)
      expect(values.datadog?.kubeStateMetricsScrape?.enabled).toBe(true)
      expect(values.datadog?.databaseMonitoring?.enabled ?? true).toBeTruthy()

      const envNames = new Set(values.datadog?.env?.map(env => env.name))
      for (const requiredEnv of [
        'DD_APPSEC_ENABLED',
        'DD_IAST_ENABLED',
        'DD_PROFILING_ENABLED',
        'DD_TRACE_ENABLED',
        'DD_LOGS_ENABLED',
        'DD_APM_FEATURES',
      ]) {
        expect(envNames.has(requiredEnv)).toBe(true)
      }

      expect(values.datadog?.confd).toBeDefined()
      expect(values.datadog?.confd).toHaveProperty('redisdb.yaml')

      expect(values.securityAgent?.runtime?.enabled).toBe(true)
      expect(values.securityAgent?.compliance?.enabled).toBe(true)

      expect(values.systemProbe?.enabled).toBe(true)
      expect(values.systemProbe?.enableTCPQueueLength).toBe(true)
      expect(values.systemProbe?.enableHTTPMonitoring).toBe(true)
      expect(values.systemProbe?.collectDNSStats).toBe(true)
    }
  })

  it('configures Valkey deployment for Datadog autodiscovery', () => {
    const valkeyPath = path.join(process.cwd(), 'k8s/valkey-deployment.yaml')
    const valkeyDocs = loadAll(fs.readFileSync(valkeyPath, 'utf8')) as Array<any>
    const deployment = valkeyDocs.find(
      doc => doc?.kind === 'Deployment' && doc?.metadata?.name === 'valkey'
    )

    expect(deployment).toBeDefined()
    const annotations = deployment?.spec?.template?.metadata?.annotations ?? {}
    expect(annotations['ad.datadoghq.com/valkey.check_names']).toBeDefined()
    expect(annotations['ad.datadoghq.com/valkey.init_configs']).toBeDefined()
    expect(annotations['ad.datadoghq.com/valkey.instances']).toBeDefined()
    expect(annotations['ad.datadoghq.com/valkey.logs']).toBeDefined()
  })
})
