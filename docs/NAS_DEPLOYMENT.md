# Running VibeCode on Docker-capable NAS (Asustor, QNAP, Synology)

This guide shows how to deploy the Monaco 0.53 code-server build and the VibeCode web UI on popular NAS devices that support Docker (Asustor ADM, QNAP QTS/QuTS, Synology DSM).

## 0. Prerequisites

1. Enable Docker:
   - **Asustor**: App Central → install *Docker Engine* → open *Container Manager* (enable buildx if available).
   - **QNAP**: Control Panel → Applications → *Container Station* → install/open.
   - **Synology**: Package Center → install *Docker* (DSM 6) or *Container Manager* (DSM 7/7.2) → enable BuildKit.

2. Optional CLI access: SSH into the NAS (e.g. `ssh admin@nas-ip`) to run Docker/Compose commands directly.

3. Build or pull images with the correct architecture (x86_64 or arm64).

## 1. Build/Push Monaco 0.53 and VibeCode images

On your workstation:

```bash
# Monaco 0.53 editor image
REGISTRY=your-registry
TAG=monaco053

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t $REGISTRY/vibecode-code-server:$TAG \
  -f docker/code-server/Dockerfile.kind \
  --push .

# (Optional) VibeCode web UI
WEB_TAG=latest

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t $REGISTRY/vibecode-webgui:$WEB_TAG \
  -f Dockerfile.production \
  --push .
```

> If the NAS is x86_64, you can skip `--platform` or build locally on the NAS.

## 2. Deploy with Docker Compose

Example `docker-compose.nas.yml`:

```yaml
services:
  code-server:
    image: your-registry/vibecode-code-server:monaco053
    env_file:
      - nas.env
    environment:
      PASSWORD: "${CODE_SERVER_PASSWORD:-change-me}"
      OPENAI_API_KEY: "${OPENAI_API_KEY:-}"
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY:-}"
      OPENROUTER_API_KEY: "${OPENROUTER_API_KEY:-}"
      DD_API_KEY: "${DD_API_KEY:-}"
      DD_SITE: "${DD_SITE:-datadoghq.com}"
    ports:
      - "8443:8765"
    volumes:
      - cs-workspace:/home/coder/workspace
      - cs-settings:/home/coder/.local/share/code-server/User
    restart: unless-stopped

  vibecode-app: # optional web UI
    image: your-registry/vibecode-webgui:latest
    env_file:
      - nas.env
    environment:
      NODE_ENV: production
      DATABASE_URL: "postgres://user:pass@host:5432/db"
      OPENAI_API_KEY: "${OPENAI_API_KEY:-}"
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY:-}"
      OPENROUTER_API_KEY: "${OPENROUTER_API_KEY:-}"
      DD_API_KEY: "${DD_API_KEY:-}"
      DD_SITE: "${DD_SITE:-datadoghq.com}"
    ports:
      - "3000:3000"
    restart: unless-stopped

volumes:
  cs-workspace:
  cs-settings:
```

> Refer to `docker/code-server/README.md` → "Configuring AI API Keys" for provider-specific env var guidance. Store values in a `.env` file or the NAS secret manager; never commit keys to git.

1. Copy `nas.env.example` to `nas.env` and fill in real credentials. Compose will load it automatically.
2. Upload the updated `docker-compose.nas.yml` and `nas.env` through your NAS UI (or run `docker compose --env-file nas.env -f docker-compose.nas.yml up -d`).

Upload the file and deploy via the NAS UI:

- **Asustor**: Container Manager → *Stack* → Upload → Deploy.
- **QNAP**: Container Station → Create → *Create Application* → Import YAML.
- **Synology**: Container Manager → Projects → *Create* → Upload compose file.

CLI alternative:

```bash
docker compose -f docker-compose.nas.yml up -d
```

> **Troubleshooting:** Run `docker compose --env-file nas.env -f docker-compose.nas.yml config` to validate the stack before deploying. This catches missing environment variables or typos without starting containers.

## 3. Set up reverse proxy (optional)

Each NAS can front the service with HTTPS:

- **Asustor**: ADM → Settings → Reverse Proxy → map `https://code.yournas` to `http://127.0.0.1:8443`.
- **QNAP**: QuProxy/QuFirewall → add proxy rule.
- **Synology**: Control Panel → Application Portal → Reverse Proxy.

## 4. Verify the editor

```bash
curl -I https://nas-hostname:8443/healthz
# HTTP/1.1 200 OK
```

Open https://nas-hostname:8443 → log in with the `PASSWORD` (or set `--auth none` if you trust the network).

## 5. CLI editors & AI helpers (optional)

Inside the container:

```bash
docker exec -it vibecode-code-server /bin/bash
sudo apt-get update
pipx install aider-chat  # optional AI CLI helper
```

## 6. Integrations

Use the onboarding flow to link GitHub/GitLab, Datadog, OpenAI/Anthropic, etc. Configure secrets via environment variables or code-server’s settings file.

### Platform-specific notes

| Feature              | Asustor                         | QNAP                                | Synology                               |
|----------------------|---------------------------------|--------------------------------------|----------------------------------------|
| Docker UI            | Container Manager              | Container Station                    | Container Manager / Docker              |
| Compose support      | “Stack” tab                    | “Create Application” (Import YAML)   | Projects → Create                       |
| Storage path         | `/volume1/` (e.g. `/volume1/dev`)| `/share/` paths                      | `/volume1/`, `/volume2/`                |
| Reverse proxy        | ADM Reverse Proxy              | QuProxy / Apache                     | Control Panel → Application Portal      |
| Architecture         | x86 & ARM models               | Many ARM models (check before build) | Mix of x86/ARM (check before build)     |

Refer back to README’s “code-server in KinD” section for verification commands (`kubectl port-forward` or NodePort) if you prefer to test against a KinD cluster locally before shipping to the NAS.
