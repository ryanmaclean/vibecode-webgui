{{/*
Expand the name of the chart.
*/}}
{{- define "openai-agents.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "openai-agents.fullname" -}}
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
{{- define "openai-agents.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "openai-agents.labels" -}}
helm.sh/chart: {{ include "openai-agents.chart" . }}
{{ include "openai-agents.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: vibecode
{{- end }}

{{/*
Selector labels
*/}}
{{- define "openai-agents.selectorLabels" -}}
app.kubernetes.io/name: {{ include "openai-agents.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app: openai-agents
component: runtime
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "openai-agents.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "openai-agents.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
