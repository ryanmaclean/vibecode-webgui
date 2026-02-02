# Docker Consolidation Migration Guide

This guide helps you migrate from the old scattered Dockerfiles to the new consolidated structure.

## What Changed

### Before (15+ Dockerfiles)
```
Dockerfile
Dockerfile.prod
Dockerfile.dev
Dockerfile.production
Dockerfile.fast
Dockerfile.multiarch
Dockerfile.aks
Dockerfile.local
Dockerfile.ingest
Dockerfile.test
Dockerfile.backup
Dockerfile.lightningcss-only
Dockerfile.simple
Dockerfile.tailwind-test
```

### After (1 Dockerfile + 4 Compose Files)
```
docker/
├── Dockerfile                    # Consolidated multi-stage
├── docker-compose.dev.yml       # Development
├── docker-compose.prod.yml      # Production
├── docker-compose.test.yml       # Testing
├── docker-compose.aks.yml        # AKS with Datadog
├── build.sh                     # Build script
├── deploy.sh                    # Deployment script
└── README.md                    # Documentation
```

## Migration Steps

### 1. Update CI/CD Workflows

#### GitHub Actions (build-and-push-image.yml)
```yaml
# OLD
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    file: ./Dockerfile.production

# NEW
- name: Build and push Docker image
  run: docker/build.sh prod --tag $IMAGE --push
```

#### Local Development
```bash
# OLD
docker build -f Dockerfile.dev -t vibecode-dev .

# NEW
cd docker && ./build.sh dev
```

#### Production Deployment
```bash
# OLD
docker build -f Dockerfile.production -t vibecode-prod .

# NEW
cd docker && ./deploy.sh prod
```

### 2. Update Scripts

#### Scripts that reference old Dockerfiles
- `scripts/min-kind-bootstrap.sh`
- `scripts/build-multiarch.sh`
- `scripts/tofu-aks-deploy.sh`
- `scripts/local-kind-setup.sh`

Update these to use the new build script:
```bash
# OLD
docker build -f Dockerfile.local -t vibecode-webgui:local-test .

# NEW
docker/build.sh dev --tag vibecode-webgui:local-test
```

### 3. Update Documentation

Update any documentation that references old Dockerfiles:
- `docs/azure-aks-deployment.md`
- `docs/TROUBLESHOOTING.md`
- Various README files

### 4. Test New Structure

```bash
# Test development build
cd docker
./build.sh dev --tag test-dev

# Test production build
./build.sh prod --tag test-prod

# Test deployment
./deploy.sh dev
```

### 5. Remove Old Dockerfiles

After successful migration and testing:

```bash
# Remove old Dockerfiles (keep backups initially)
rm Dockerfile.prod
rm Dockerfile.dev
rm Dockerfile.production
rm Dockerfile.fast
rm Dockerfile.multiarch
rm Dockerfile.aks
rm Dockerfile.local
rm Dockerfile.ingest
rm Dockerfile.test
rm Dockerfile.backup
rm Dockerfile.lightningcss-only
rm Dockerfile.simple
rm Dockerfile.tailwind-test

# Keep the main Dockerfile as backup
mv Dockerfile Dockerfile.backup
```

## Build Target Mapping

| Old Dockerfile | New Target | Build Command |
|----------------|------------|---------------|
| `Dockerfile` | production | `./build.sh prod` |
| `Dockerfile.prod` | production | `./build.sh prod` |
| `Dockerfile.dev` | development | `./build.sh dev` |
| `Dockerfile.production` | production | `./build.sh prod` |
| `Dockerfile.fast` | production | `./build.sh prod` |
| `Dockerfile.multiarch` | production | `./build.sh prod --platform linux/amd64,linux/arm64` |
| `Dockerfile.aks` | production | `./build.sh aks` |
| `Dockerfile.local` | development | `./build.sh dev` |
| `Dockerfile.ingest` | ingestion | `./build.sh ingestion` |
| `Dockerfile.test` | testing | `./build.sh test` |

## Environment Variables

The new structure uses consistent environment variables across all environments:

### Development
```bash
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1
DATABASE_URL=postgresql://postgres:password@postgres:5432/vibecode_dev
REDIS_URL=redis://redis:6379
```

### Production
```bash
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=${NEXTAUTH_URL}
```

### AKS (with Datadog)
```bash
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
DD_API_KEY=${DD_API_KEY}
DD_SITE=${DD_SITE:-datadoghq.com}
DD_SERVICE=vibecode-webgui
DD_ENV=production
DD_VERSION=${DD_VERSION:-latest}
```

## Troubleshooting

### Build Issues
- Check build arguments match your needs
- Verify base OS compatibility
- Ensure all required dependencies are included

### Deployment Issues
- Verify environment variables are set
- Check registry permissions for push
- Ensure Kubernetes context is correct for AKS

### Performance Issues
- Use BuildKit for faster builds
- Enable cache mounts for npm/yarn
- Use multi-stage builds efficiently

## Benefits After Migration

1. **Reduced Maintenance** - One Dockerfile instead of 15+
2. **Consistent Builds** - Same base image across environments
3. **Better Caching** - Shared layers reduce build times
4. **Easier Debugging** - Clear separation of concerns
5. **Simplified CI/CD** - Standardized build process
6. **Better Documentation** - Clear usage instructions

## Rollback Plan

If issues arise, you can quickly rollback:

1. Restore old Dockerfiles from git history
2. Revert CI/CD workflow changes
3. Update scripts to use old Dockerfiles
4. Test thoroughly before re-attempting migration

## Support

For issues with the new Docker structure:
1. Check the `docker/README.md` for detailed usage
2. Run `docker/validate.sh` to check structure
3. Test with `docker/build.sh --help` for options
4. Review build logs for specific errors
