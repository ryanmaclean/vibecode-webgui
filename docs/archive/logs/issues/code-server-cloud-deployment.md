# Issue: Affordable Cloud Workspaces (GCP & AWS)

## Summary

## Release Cadence & Checklists (2025-10-01)
- Ship window: Wednesdays 17:00 UTC (see `docs/handoff/code-server-release.md`).
- Nightly validation: `codeserver-multiarch` schedule 05:15 UTC; note results in `docs/handoff/shipping-dashboard.md`.
- Pre-release gates: multi-arch workflow green, KinD smoke pass, observability dashboards reviewed.
- Post-release tasks: update release digest, confirm cloud cost dashboards, archive TODO entries.

## Shipping Checklist
1. Verify GHCR digests match latest run (see handoff doc).
2. Re-run `scripts/build-codeserver-multiarch.sh push ghcr.io/ryanmaclean` if cloud deployment requires manual rebuild.
3. Validate Docker Compose + KinD flows before touching GCP/AWS Terraform modules.
4. Update shipping dashboard Build/Test/Deploy rows and call out any blocked cloud targets.

Design and implement resumable code-server deployments on GCP and AWS that keep monthly costs low while preserving developer sessions. The plan relies on spot/preemptible compute, persistent workspace volumes, and automated stop/start flows based on activity.

## Goals
- Run code-server for individual developers at \$20–30/month (or less) using preemptible/spot capacity.
- Persist workspaces on attachable storage (PD/EBS, Filestore/EFS) so sessions resume after shutdown.
- Provide scripts/manifests for Docker, Docker Compose, KinD, GKE, and EKS deployments.
- Automate idle detection and scheduled shutdown/startup (Cloud Scheduler/EventBridge + Functions/Lambda).

## Work Breakdown
1. **Docs & Tooling**
   - [x] Document VM-based workflow (GCP/AWS) with start/stop scripts (`scripts/cloud/gcp`, `scripts/cloud/aws`).
   - [x] Create Docker Compose bundle that mounts persistent storage and supports resumable state (`docker/code-server/docker-compose.cloud.yml`, `scripts/cloud/docker`).
   - [x] Author Helm charts + OpenTofu/Terraform modules for managed Kubernetes deployments.
   - [x] Write KinD smoke tests mirroring GKE/EKS manifests - Comprehensive test suite implemented.

2. **GCP Implementation**
   - [x] Preemptible VM template + PD attachment script (`start-workspace.sh`, `stop-workspace.sh`).
   - [x] GKE Autopilot manifests (StatefulSet + Filestore/PD) - Terraform module completed.
   - [x] Cloud Scheduler/Function to wake/suspend workspaces - Implemented in Terraform module.

3. **AWS Implementation**
   - [x] EC2 Spot template with EBS reattachment (`scripts/cloud/aws/start-workspace.sh`, `stop-workspace.sh`).
   - [x] ECS Fargate Spot task definition + EFS mount - Complete Terraform module implemented.
   - [x] EventBridge Scheduler + Lambda for idle shutdown/startup - EventBridge Scheduler implemented, Lambda optional.

4. **Authentication & Networking**
   - [ ] Configure IAP (GCP) and ALB + Cognito (AWS) for SSO access.
   - [ ] Provide optional OAuth proxy sidecar for Kubernetes deployments.

5. **Monitoring & Cost Controls**
   - [ ] Emit metrics (CPU, workspace idle timers) to Datadog/Cloud Monitoring.
   - [ ] Document cost dashboards and alerting (monthly spend, idle runtimes).

## Release Checklist (Updated 2025-10-01)
- [ ] Confirm latest `codeserver-multiarch` workflow passed nightly smoke (KinD + port-forward).
- [ ] Validate `shipping-dashboard` weekly entry captures code-server cloud rollout status.
- [ ] Ensure Datadog monitors `codeserver.build.duration.p95` and `codeserver.kind.smoke.failure` have on-call owners assigned.
- [ ] Publish release digest under `docs/logs/releases/code-server/<date>.md` and link in `docs/handoff/code-server-release.md`.
- [ ] Verify Terraform/OpenTofu modules pin the new image tag for GCP/AWS blue/green deploys.
- [ ] Re-run `scripts/test-code-server-kind.sh` against staging cluster before production promotion.

## References
- TODO.md entries (2025-09-30) summarising autoscaling updates.
- README “Cloud Workspaces” section (added 2025-09-30).
- Agent activity log (2025-09-30) for resource baseline.
