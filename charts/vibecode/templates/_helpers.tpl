{{/*
Expand the name of the chart.
*/}}
{{- define "vibecode.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "vibecode.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "vibecode.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "vibecode.labels" -}}
helm.sh/chart: {{ include "vibecode.chart" . }}
{{ include "vibecode.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: frontend
app.kubernetes.io/part-of: vibecode-platform
{{- end }}

{{/*
Selector labels
*/}}
{{- define "vibecode.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vibecode.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Names and labels for the AI Gateway component
*/}}
{{- define "vibecode.aiGateway.fullname" -}}
{{- printf "%s-ai-gateway" (include "vibecode.fullname" .) -}}
{{- end }}

{{- define "vibecode.aiGateway.labels" -}}
{{- $base := (include "vibecode.labels" . | fromYaml) -}}
{{- $labels := merge $base (dict "app.kubernetes.io/name" (printf "%s-ai-gateway" (include "vibecode.name" .)) "app.kubernetes.io/component" "ai-gateway") -}}
{{- toYaml $labels -}}
{{- end }}

{{- define "vibecode.aiGateway.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vibecode.name" . }}-ai-gateway
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "vibecode.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "vibecode.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate the image name with registry
*/}}
{{- define "vibecode.image" -}}
{{- if .Values.image.registry }}
{{- printf "%s/%s:%s" .Values.image.registry .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- else }}
{{- printf "%s:%s" .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- end }}
{{- end }}

{{/*
Generate database URL
*/}}
{{- define "vibecode.databaseUrl" -}}
{{- if .Values.database.ssl }}
{{- printf "postgresql://%s:%s@%s:%d/%s?sslmode=require" .Values.database.username .Values.database.password .Values.database.host (.Values.database.port | int) .Values.database.name }}
{{- else }}
{{- printf "postgresql://%s:%s@%s:%d/%s" .Values.database.username .Values.database.password .Values.database.host (.Values.database.port | int) .Values.database.name }}
{{- end }}
{{- end }}

{{/*
Generate Redis URL
*/}}
{{- define "vibecode.redisUrl" -}}
{{- if .Values.redis.ssl }}
{{- printf "rediss://%s:%d" .Values.redis.host (.Values.redis.port | int) }}
{{- else }}
{{- printf "redis://%s:%d" .Values.redis.host (.Values.redis.port | int) }}
{{- end }}
{{- end }}

{{/*
Generate ingress hostname
*/}}
{{- define "vibecode.ingressHost" -}}
{{- if .Values.ingress.hosts }}
{{- (index .Values.ingress.hosts 0).host }}
{{- else }}
{{- printf "vibecode.%s.cloudapp.azure.com" .Values.global.location }}
{{- end }}
{{- end }}

{{/*
Generate Azure Key Vault secret provider class name
*/}}
{{- define "vibecode.keyVaultSecretProviderClass" -}}
{{- printf "%s-keyvault-secrets" (include "vibecode.fullname" .) }}
{{- end }}

{{/*
Generate common annotations for Azure workload identity
*/}}
{{- define "vibecode.azureWorkloadIdentityAnnotations" -}}
{{- if .Values.serviceAccount.annotations }}
{{- with .Values.serviceAccount.annotations }}
{{- toYaml . }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Generate Datadog annotations for pods
*/}}
{{- define "vibecode.datadogAnnotations" -}}
{{- if .Values.monitoring.datadog.enabled }}
ad.datadoghq.com/{{ .Chart.Name }}.logs: '[{"source":"nodejs","service":"{{ .Values.env.DD_SERVICE }}","log_processing_rules":[{"type":"multi_line","name":"log_start_with_date","pattern":"\\d{4}-\\d{2}-\\d{2}"}]}]'
ad.datadoghq.com/{{ .Chart.Name }}.check_names: '["http_check"]'
ad.datadoghq.com/{{ .Chart.Name }}.init_configs: '[{}]'
ad.datadoghq.com/{{ .Chart.Name }}.instances: '[{"name":"{{ include "vibecode.fullname" . }}-health","url":"http://%%host%%:%%port%%/api/health","timeout":5}]'
{{- end }}
{{- end }}

{{/*
Generate Prometheus annotations for pods
*/}}
{{- define "vibecode.prometheusAnnotations" -}}
{{- if .Values.monitoring.prometheus.enabled }}
prometheus.io/scrape: "true"
prometheus.io/port: "{{ .Values.monitoring.prometheus.port }}"
prometheus.io/path: "{{ .Values.monitoring.prometheus.path }}"
{{- end }}
{{- end }}

{{/*
Generate resource limits for containers
*/}}
{{- define "vibecode.resources" -}}
{{- if .Values.resources }}
resources:
  {{- if .Values.resources.limits }}
  limits:
    {{- toYaml .Values.resources.limits | nindent 4 }}
  {{- end }}
  {{- if .Values.resources.requests }}
  requests:
    {{- toYaml .Values.resources.requests | nindent 4 }}
  {{- end }}
{{- end }}
{{- end }}

{{/*
Generate storage class name
*/}}
{{- define "vibecode.storageClass" -}}
{{- if .Values.persistence.storageClass }}
{{- .Values.persistence.storageClass }}
{{- else if .Values.global.storageClass }}
{{- .Values.global.storageClass }}
{{- else }}
{{- "managed-csi" }}
{{- end }}
{{- end }}

{{/*
Generate the ConfigMap name that stores free LLM models
*/}}
{{- define "vibecode.freeLlmConfigMapName" -}}
{{- if .Values.freeModelUpdater.configMap.name }}
{{- .Values.freeModelUpdater.configMap.name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-free-llm-models" (include "vibecode.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Generate backup storage account URL
*/}}
{{- define "vibecode.backupStorageUrl" -}}
{{- if .Values.backup.enabled }}
{{- printf "https://%s.blob.core.windows.net/%s" .Values.backup.storageAccount .Values.backup.containerName }}
{{- end }}
{{- end }}

{{/*
Validate required values
*/}}
{{- define "vibecode.validateValues" -}}
{{- if not .Values.image.repository }}
{{- fail "image.repository is required" }}
{{- end }}
{{- if not .Values.database.host }}
{{- fail "database.host is required" }}
{{- end }}
{{- if and .Values.ingress.enabled (not .Values.ingress.hosts) }}
{{- fail "ingress.hosts is required when ingress is enabled" }}
{{- end }}
{{- if and .Values.secrets.enabled (eq .Values.secrets.provider "azure-keyvault") (not .Values.secrets.keyVault.name) }}
{{- fail "secrets.keyVault.name is required when using azure-keyvault provider" }}
{{- end }}
{{- end }}

{{/*
Generate Azure Key Vault CSI driver volume
*/}}
{{- define "vibecode.keyVaultVolume" -}}
{{- if and .Values.secrets.enabled (eq .Values.secrets.provider "azure-keyvault") }}
- name: keyvault-secrets
  csi:
    driver: secrets-store.csi.k8s.io
    readOnly: true
    volumeAttributes:
      secretProviderClass: {{ include "vibecode.keyVaultSecretProviderClass" . }}
{{- end }}
{{- end }}

{{/*
Generate Azure Key Vault CSI driver volume mount
*/}}
{{- define "vibecode.keyVaultVolumeMount" -}}
{{- if and .Values.secrets.enabled (eq .Values.secrets.provider "azure-keyvault") }}
- name: keyvault-secrets
  mountPath: /mnt/secrets-store
  readOnly: true
{{- end }}
{{- end }}
