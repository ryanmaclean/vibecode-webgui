{{/*
Expand the name of the chart.
*/}}
{{- define "vibecode-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "vibecode-platform.fullname" -}}
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
{{- define "vibecode-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "vibecode-platform.labels" -}}
helm.sh/chart: {{ include "vibecode-platform.chart" . }}
{{ include "vibecode-platform.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "vibecode-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vibecode-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "vibecode-platform.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "vibecode-platform.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create code-server instance name for a specific user
*/}}
{{- define "vibecode-platform.codeServerName" -}}
{{- $userId := .userId | required "userId is required" }}
{{- printf "code-server-%s" $userId | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create code-server labels for a specific user
*/}}
{{- define "vibecode-platform.codeServerLabels" -}}
{{ include "vibecode-platform.labels" .root }}
app.kubernetes.io/component: code-server
vibecode.dev/user-id: {{ .userId | quote }}
{{- end }}

{{/*
Create code-server selector labels for a specific user
*/}}
{{- define "vibecode-platform.codeServerSelectorLabels" -}}
{{ include "vibecode-platform.selectorLabels" .root }}
app.kubernetes.io/component: code-server
vibecode.dev/user-id: {{ .userId | quote }}
{{- end }}

{{/*
Create PVC name for a specific user
*/}}
{{- define "vibecode-platform.pvcName" -}}
{{- $userId := .userId | required "userId is required" }}
{{- printf "workspace-%s" $userId | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create ingress host for a specific user
*/}}
{{- define "vibecode-platform.ingressHost" -}}
{{- $userId := .userId | required "userId is required" }}
{{- $host := .Values.codeServer.ingress.hosts | first }}
{{- if $host }}
{{- $host.host | replace "{USER_ID}" $userId }}
{{- else }}
{{- printf "%s.vibecode.local" $userId }}
{{- end }}
{{- end }}

{{/*
Create secret name for code-server config
*/}}
{{- define "vibecode-platform.secretName" -}}
{{- printf "%s-config" (include "vibecode-platform.fullname" .) }}
{{- end }}

{{/*
Create ConfigMap name
*/}}
{{- define "vibecode-platform.configMapName" -}}
{{- printf "%s-config" (include "vibecode-platform.fullname" .) }}
{{- end }}

{{/*
Create RBAC name
*/}}
{{- define "vibecode-platform.rbacName" -}}
{{- printf "%s-rbac" (include "vibecode-platform.fullname" .) }}
{{- end }}

{{/*
Create NetworkPolicy name for user workspace
*/}}
{{- define "vibecode-platform.networkPolicyName" -}}
{{- $userId := .userId | required "userId is required" }}
{{- printf "%s-netpol" (include "vibecode-platform.codeServerName" .) }}
{{- end }}

{{/*
Create resource quota name for user
*/}}
{{- define "vibecode-platform.resourceQuotaName" -}}
{{- $userId := .userId | required "userId is required" }}
{{- printf "%s-quota" (include "vibecode-platform.codeServerName" .) }}
{{- end }}
