# litellm-pgvector Helm Chart

This chart deploys the [litellm-pgvector](https://github.com/BerriAI/litellm-pgvector) sample service together with a PostgreSQL database configured with the `pgvector` extension. It is intended as a starting point for the VibeCode platform to demonstrate Retrieval Augmented Generation (RAG) features using OpenRouter/OpenAI compatible endpoints.

## Features

- Deploys the LiteLLM API container with optional ingress.
- Bundles a Bitnami PostgreSQL sub-chart with pgvector enabled.
- Allows secrets for OpenRouter/OpenAI keys to be referenced via existing Kubernetes secrets.
- Provides hooks for an optional migration/seed job.

## Installing

```bash
helm dependency update charts/litellm-pgvector
helm install litellm charts/litellm-pgvector \
  --namespace ai-platform --create-namespace \
  --set envSecretName=litellm-secrets \
  --set postgresql.auth.existingSecret=litellm-postgresql
```

Create the required secrets before installing:

```bash
kubectl create secret generic litellm-secrets \
  --from-literal=OPENROUTER_API_KEY="sk-or-..." \
  --namespace ai-platform

kubectl create secret generic litellm-postgresql \
  --from-literal=password="supersecret" \
  --namespace ai-platform
```

## Configuration

| Value | Description | Default |
| ----- | ----------- | ------- |
| `image.repository` | Container image for the LiteLLM API | `ghcr.io/berriai/litellm-pgvector` |
| `env.DEFAULT_MODEL` | Default model the service should use | `openai/gpt-oss-20b:free` |
| `envSecretName` | Name of an existing secret containing `OPENROUTER_API_KEY` | `""` |
| `postgresql.enabled` | Toggle bundled PostgreSQL dependency | `true` |
| `postgresql.auth.username` | Database user | `litellm` |
| `postgresql.auth.database` | Database name | `litellm` |
| `migrations.enabled` | Enables the placeholder migration job | `false` |

See `values.yaml` for the full list of configurable options.

## License

The chart is distributed under the MIT License.
