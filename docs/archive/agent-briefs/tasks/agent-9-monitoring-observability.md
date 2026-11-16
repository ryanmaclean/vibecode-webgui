# Agent 9: Monitoring & Observability

## Goal
Set up comprehensive monitoring for OpenClaw in VM using Datadog (dd-trace already installed globally).

## Tasks
1. Configure dd-trace in VM environment
2. Install and configure Datadog agent in VM
3. Create OpenClaw-specific dashboards
4. Set up alerts for gateway health
5. Configure distributed tracing for OpenClaw requests
6. Test metrics collection and visualization

## Success Criteria
- dd-trace working in VM
- Datadog agent reporting metrics
- Dashboards show OpenClaw health
- Alerts trigger on failures
- Traces show request flow
- Metrics visible in Datadog UI

## Files
- `scripts/vz/setup-datadog-vm.sh` (new)
- `config/datadog/openclaw-dashboard.json` (new)
- `config/datadog/openclaw-alerts.yaml` (new)

## Dependencies
- Agent 3: Installation scripts (needs OpenClaw installed)
- Datadog API key configured

## Notes
- dd-trace already installed globally on host
- Need to install in VM and configure
- Gateway requests should be traced
- Health checks should generate metrics
