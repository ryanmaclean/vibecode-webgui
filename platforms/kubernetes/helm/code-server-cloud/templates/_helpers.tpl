{{- define "code-server-cloud.name" -}}
{{- default (.Chart.Name) .Values.nameOverride -}}
{{- end -}}

{{- define "code-server-cloud.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "code-server-cloud.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "code-server-cloud.labels" -}}
{{ include "code-server-cloud.selectorLabels" . }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
tags.datadoghq.com/env: {{ .Values.env | default "development" | quote }}
tags.datadoghq.com/service: {{ .Chart.Name | quote }}
tags.datadoghq.com/version: {{ .Chart.AppVersion | default "1.0.0" | quote }}
{{- end -}}

{{- define "code-server-cloud.selectorLabels" -}}
app.kubernetes.io/name: {{ include "code-server-cloud.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
