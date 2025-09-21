import sharedModule from './datadog-env.shared.js'

// Keys commonly used across the codebase
export type DatadogKey = 'API_KEY' | 'APP_KEY' | 'SITE' | 'SERVICE' | 'ENV' | 'VERSION'

type SharedExports = {
  getDDValue: (key: DatadogKey) => string | undefined
  getDatadogApiKey: () => string | undefined
  getDatadogAppKey: () => string | undefined
  getDatadogSite: () => string
  getServiceEnvVersion: () => { service: string; env: string; version: string }
  getRUMPublicConfig: () => {
    applicationId: string
    clientToken: string
    site: string
    version: string
    env: string
  }
}

const shared = sharedModule as SharedExports

const {
  getDDValue,
  getDatadogApiKey,
  getDatadogAppKey,
  getDatadogSite,
  getServiceEnvVersion,
  getRUMPublicConfig,
} = shared

export { getDDValue, getDatadogApiKey, getDatadogAppKey, getDatadogSite, getServiceEnvVersion, getRUMPublicConfig }
