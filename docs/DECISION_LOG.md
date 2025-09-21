# Decision Log

## 2025-09-20 — Multi-Platform Ingestion Strategy
- **Context**: Need low-cost PaaS deployment alongside AKS option while maintaining feature parity.
- **Decision**: Standardize on queue-based PDF ingestion using Azure Storage + Azure OpenAI + PostgreSQL Flexible Server. Both App Service and AKS deployments will reuse this workflow.
- **Consequences**: Introduced shared storage/queue helpers, new `/api/uploads/pdf` API, and Azure Functions worker scaffolding. Future feature work must keep message schema stable across platforms.

## 2025-09-20 — Resume AKS Track in Parallel
- **Context**: AKS cluster `vibecode-prod-aks-6c3db0e6` has been recreated; need to keep Kubernetes option available for teams requiring full control.
- **Decision**: Continue maintaining AKS infrastructure (Ingress, Datadog agents) while new workloads are built, ensuring App Service and AKS share the same ingestion pipeline and observability standards.
- **Consequences**: TODO updated to reflect AKS readiness; observability tasks (DBM, LLM obs, APM) remain blocked on workload redeployments but Datadog agents are ready once Postgres/web app return.

## 2025-09-20 — Container Architecture Mismatch During Redeploy
- **Context**: Redeploying the web app on AKS using `vibecodecr6c3db0e6.azurecr.io/vibecode-webgui:latest` caused repeated `exec format error` crashes.
- **Decision**: Identify that the ACR image is arm64-only; redeployment on x86 AKS nodes requires an amd64 (or multi-arch) build. Next step is to publish an amd64-compatible image before retrying the Helm rollout.
- **Consequences**: Application pods remain in CrashLoopBackoff; migrations Job fails for the same reason. Postgres is running and secrets populated with temporary placeholders pending a new image.

## 2025-09-20 — Low-Cost Runtime Options Assessment
- **Context**: Budget pressure means we need an inexpensive way to keep production (or extended demos) online while AKS quotas are pending. Options floated: Azure App Service + managed Postgres, KinD on a single VM, Azure Container Instances/Container Apps, and on-prem (`studio.local`) clusters.
- **Decision**: Document cost & ops trade-offs so leadership can choose the runway. Headline numbers (East US 2):
  - **App Service (B1) + PostgreSQL Flexible (B1ms) + Storage/Queue** ≈ $110–$120/month baseline; Azure OpenAI usage billed separately. Lowest ops load, built-in HTTPS, easy scaling.
  - **KinD on Azure VM** (B2s with Premium SSD) ≈ $35–$45/month + optional $25 if we keep managed Postgres. Cheap, keeps Kubernetes manifests, but single point of failure and full ops burden (patching, TLS, backups).
  - **ACI / Container Apps + managed Postgres** ≈ $70–$90/month for steady workloads (App Container ≈ $50, Postgres ~$35, Storage ~$8). Less control than AKS, more curated than KinD, but network/CI integration needs scripting.
  - **studio.local cluster** ≈ $0 cloud spend. Requires VPN/bastion, hardware upkeep, and has no SLA—good for demos or short-term failover, not a long-term production answer.
- **Consequences**: Added to TODO so we can finalise a recommendation. In the interim we continue building the App Service stack (lowest ops) while keeping KinD VM scripts handy in case finance mandates further cost trimming or quota resets linger.
