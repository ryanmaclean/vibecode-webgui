"use strict";
/*
 * Centralized Datadog environment variable resolution
 * - Prefer DD_* variables; fall back to DATADOG_* for compatibility
 * - Never logs secret values; only emits safe mismatch warnings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDDValue = getDDValue;
exports.getDatadogApiKey = getDatadogApiKey;
exports.getDatadogAppKey = getDatadogAppKey;
exports.getDatadogSite = getDatadogSite;
exports.getServiceEnvVersion = getServiceEnvVersion;
exports.getRUMPublicConfig = getRUMPublicConfig;
function safeWarn(message) {
    // Avoid noisy logs in production if not needed
    if (process.env.NODE_ENV !== 'test') {
        // Intentionally do not include actual values for security
        console.warn(`[DatadogEnv] ${message}`);
    }
}
function getDDValue(key) {
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
    // Default per Datadog docs
    return getDDValue('SITE') || 'datadoghq.com';
}
function getServiceEnvVersion() {
    const env = getDDValue('ENV') ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development');
    const service = getDDValue('SERVICE') || 'vibecode-webgui';
    const version = getDDValue('VERSION') || process.env.npm_package_version || '1.0.0';
    return { service, env, version };
}
// Client-side RUM helpers (NEXT_PUBLIC_*).
// Prefer NEXT_PUBLIC_DD_* with fallback to legacy NEXT_PUBLIC_DATADOG_* for compatibility.
function getRUMPublicConfig() {
    const applicationId = process.env.NEXT_PUBLIC_DD_APPLICATION_ID ||
        process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID ||
        process.env.NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID ||
        '';
    const clientToken = process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN ||
        process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN ||
        process.env.NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN ||
        '';
    const site = process.env.NEXT_PUBLIC_DD_SITE || process.env.NEXT_PUBLIC_DATADOG_SITE || 'datadoghq.com';
    const version = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
    const env = process.env.NODE_ENV || 'development';
    return { applicationId, clientToken, site, version, env };
}
