# Issue: Affordable Cloud Workspaces (GCP & AWS)

## Summary
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
   - [ ] Author Helm charts + OpenTofu/Terraform modules for managed Kubernetes deployments.
   - [ ] Write KinD smoke tests mirroring GKE/EKS manifests.

2. **GCP Implementation**
   - [x] Preemptible VM template + PD attachment script (`start-workspace.sh`, `stop-workspace.sh`).
   - [ ] GKE Autopilot manifests (StatefulSet + Filestore/PD).
   - [ ] Cloud Scheduler/Function to wake/suspend workspaces.

3. **AWS Implementation**
   - [x] EC2 Spot template with EBS reattachment (`scripts/cloud/aws/start-workspace.sh`, `stop-workspace.sh`).
   - [ ] ECS Fargate Spot task definition + EFS mount.
   - [ ] EventBridge Scheduler + Lambda for idle shutdown/startup.

4. **Authentication & Networking**
   - [ ] Configure IAP (GCP) and ALB + Cognito (AWS) for SSO access.
   - [ ] Provide optional OAuth proxy sidecar for Kubernetes deployments.

5. **Monitoring & Cost Controls**
   - [ ] Emit metrics (CPU, workspace idle timers) to Datadog/Cloud Monitoring.
   - [ ] Document cost dashboards and alerting (monthly spend, idle runtimes).

## References
- TODO.md entries (2025-09-30) summarising autoscaling updates.
- README “Cloud Workspaces” section (added 2025-09-30).
- Agent activity log (2025-09-30) for resource baseline.
