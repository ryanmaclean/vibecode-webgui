{{- define "litellm-pgvector.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "litellm-pgvector.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "litellm-pgvector.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "litellm-pgvector.labels" -}}
helm.sh/chart: {{ include "litellm-pgvector.name" . }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "litellm-pgvector.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "litellm-pgvector.selectorLabels" -}}
app.kubernetes.io/name: {{ include "litellm-pgvector.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "litellm-pgvector.postgresql.secretName" -}}
{{- if .Values.postgresql.auth.existingSecret -}}
{{ .Values.postgresql.auth.existingSecret }}
{{- else -}}
{{- printf "%s-postgresql" (include "litellm-pgvector.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "litellm-pgvector.postgresql.host" -}}
{{ printf "%s-postgresql" (include "litellm-pgvector.fullname" .) }}
{{- end -}}

{{- define "litellm-pgvector.postgresql.port" -}}
5432
{{- end -}}

