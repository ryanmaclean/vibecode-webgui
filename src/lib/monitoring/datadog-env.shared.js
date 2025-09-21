'use strict';

/**
 * Shared Datadog environment helpers for both TypeScript and CommonJS contexts.
 * The logic matches the existing TypeScript implementation but is authored in
 * plain JavaScript so it can be required from bootstrap scripts (e.g. Next.js
 * instrumentation running under Node without a TypeScript transpiler).
 */

const VALID_KEYS = new Set(['API_KEY', 'APP_KEY', 'SITE', 'SERVICE', 'ENV', 'VERSION']);

function safeWarn(message) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(`[DatadogEnv] ${message}`);
  }
}

function getDDValue(key) {
  if (!VALID_KEYS.has(key)) {
    return undefined;
  }

  const dd = process.env[`DD_${key}`];
  const datadog = process.env[`DATADOG_${key}`];

  if (dd && datadog && dd !== datadog) {
    safeWarn(`Both DD_${key} and DATADOG_${key} are set and differ; preferring DD_${key}`);
  }

  return dd ?? datadog;
}

function getDatadogApiKey() {
  return getDDValue('API_KEY');
}

function getDatadogAppKey() {
  return getDDValue('APP_KEY');
}

function getDatadogSite() {
  return getDDValue('SITE') || 'datadoghq.com';
}

function getServiceEnvVersion() {
  const env =
    getDDValue('ENV') ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development');
  const service = getDDValue('SERVICE') || 'vibecode-webgui';
  const version = getDDValue('VERSION') || process.env.npm_package_version || '1.0.0';

  return { service, env, version };
}

function getRUMPublicConfig() {
  const applicationId =
    process.env.NEXT_PUBLIC_DD_APPLICATION_ID ||
    process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID ||
    process.env.NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID ||
    '';

  const clientToken =
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN ||
    process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN ||
    process.env.NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN ||
    '';

  const site = process.env.NEXT_PUBLIC_DD_SITE || process.env.NEXT_PUBLIC_DATADOG_SITE || 'datadoghq.com';
  const version = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
  const env = process.env.NODE_ENV || 'development';

  return { applicationId, clientToken, site, version, env };
}

module.exports = {
  getDDValue,
  getDatadogApiKey,
  getDatadogAppKey,
  getDatadogSite,
  getServiceEnvVersion,
  getRUMPublicConfig,
};
