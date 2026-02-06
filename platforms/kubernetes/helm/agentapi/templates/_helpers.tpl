{{/*
Expand the name of the chart.
*/}}
{{- define "agentapi.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "agentapi.fullname" -}}
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
{{- define "agentapi.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "agentapi.labels" -}}
helm.sh/chart: {{ include "agentapi.chart" . }}
{{ include "agentapi.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
environment: {{ .Values.global.environment }}
tags.datadoghq.com/env: {{ .Values.global.environment | default "development" | quote }}
tags.datadoghq.com/service: {{ .Chart.Name | quote }}
tags.datadoghq.com/version: {{ .Chart.AppVersion | default "1.0.0" | quote }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "agentapi.selectorLabels" -}}
app.kubernetes.io/name: {{ include "agentapi.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app: code-server
component: workspace
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "agentapi.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "agentapi.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Database URL construction
*/}}
{{- define "agentapi.databaseUrl" -}}
{{- if .Values.externalPostgresql.enabled }}
{{- printf "postgresql://%s:%s@%s:%d/%s?sslmode=%s" .Values.externalPostgresql.username .Values.externalPostgresql.password .Values.externalPostgresql.host (.Values.externalPostgresql.port | int) .Values.externalPostgresql.database .Values.externalPostgresql.sslMode }}
{{- else if .Values.postgresql.enabled }}
{{- printf "postgresql://%s:%s@%s-postgresql:5432/%s" .Values.postgresql.auth.username .Values.postgresql.auth.password (include "agentapi.fullname" .) .Values.postgresql.auth.database }}
{{- end }}
{{- end }}

{{/*
Redis URL construction
*/}}
{{- define "agentapi.redisUrl" -}}
{{- if .Values.externalRedis.enabled }}
{{- if .Values.externalRedis.password }}
{{- printf "redis://:%s@%s:%d/%d" .Values.externalRedis.password .Values.externalRedis.host (.Values.externalRedis.port | int) (.Values.externalRedis.database | int) }}
{{- else }}
{{- printf "redis://%s:%d/%d" .Values.externalRedis.host (.Values.externalRedis.port | int) (.Values.externalRedis.database | int) }}
{{- end }}
{{- else if .Values.redis.enabled }}
{{- printf "redis://:%s@%s-redis-master:6379/0" .Values.redis.auth.password (include "agentapi.fullname" .) }}
{{- end }}
{{- end }}
