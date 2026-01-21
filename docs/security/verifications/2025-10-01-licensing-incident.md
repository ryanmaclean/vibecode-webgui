# Licensing Incident – October 1, 2025
- Detected GNU Emacs (GPL) content across v1.1.0 images.
- Mitigation: removed Emacs, hardened Node/Go downloads, staged cosign.
- Status: rebuild blocked pending GitHub Actions dispatch (workflow_dispatch disabled) and local Docker daemon.
- Follow-ups: start Docker/OrbStack or trigger workflow via UI; ensure delete:packages scope for GHCR/Docker Hub cleanup; finish documentation suite; track 49.71GB storage reclaimed.
