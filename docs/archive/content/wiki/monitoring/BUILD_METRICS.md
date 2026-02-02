# Code-Server Multi-Arch Build Metrics

## Overview
Comprehensive Datadog metrics instrumentation for the code-server multi-arch build pipeline, tracking build performance, image characteristics, and deployment health across profiles and architectures.

**Status:** Active
**Owner:** Platform Build + Observability
**Related:** Issue #412, docs/handoff/code-server-release.md

## Metrics Catalog

### Build Performance

#### codeserver.build.duration
- **Type:** Gauge (seconds)
- **Description:** Total time from build start to completion including push
- **Tags:**
  - `service:code-server`
  - `profile:[minimal|standard|ai|web|full]`
  - `version:[semantic version]`
  - `git_sha:[commit hash]`
  - `workflow:[workflow name]`
  - `status:[success|failure|cancelled]`
- **Alert Thresholds:**
  - Warning: >720s (12 min)
  - Critical: >1500s (25 min)
- **Dashboard:** Code-Server Build Performance

#### codeserver.build.status
- **Type:** Gauge (0=failure, 1=success)
- **Description:** Binary success/failure indicator for build completion
- **Tags:**
  - `service:code-server`
  - `profile:[minimal|standard|ai|web|full]`
  - `version:[semantic version]`
  - `git_sha:[commit hash]`
  - `workflow:[workflow name]`
  - `status:[success|failure|cancelled]`
- **Alert Thresholds:**
  - Warning: Success rate <98% over 6h
  - Critical: Any failure triggers immediate alert
- **Dashboard:** Code-Server Build Reliability

#### codeserver.build.push_duration
- **Type:** Gauge (seconds)
- **Description:** Time to push multi-arch manifest to container registry
- **Tags:**
  - `service:code-server`
  - `profile:[minimal|standard|ai|web|full]`
  - `version:[semantic version]`
  - `git_sha:[commit hash]`
  - `registry:[ghcr|dockerhub]`
- **Alert Thresholds:**
  - Warning: >180s (3 min)
  - Critical: >300s (5 min)
- **Dashboard:** Code-Server Registry Performance

### Image Characteristics

#### codeserver.build.image_size
- **Type:** Gauge (MB)
- **Description:** Compressed image size per architecture
- **Tags:**
  - `service:code-server`
  - `profile:[minimal|standard|ai|web|full]`
  - `architecture:[amd64|arm64]`
  - `version:[semantic version]`
  - `git_sha:[commit hash]`
- **Expected Ranges:**
  - minimal: 800-1200 MB
  - standard: 1500-2000 MB
  - ai: 2000-3000 MB
  - web: 1800-2500 MB
  - full: 3000-4000 MB
- **Alert Thresholds:**
  - Warning: >15% growth from previous version
  - Critical: >30% growth from previous version
- **Dashboard:** Code-Server Image Size Trends

#### codeserver.build.layers
- **Type:** Gauge (count)
- **Description:** Number of filesystem layers in the image
- **Tags:**
  - `service:code-server`
  - `profile:[minimal|standard|ai|web|full]`
  - `architecture:[amd64|arm64]`
  - `version:[semantic version]`
  - `git_sha:[commit hash]`
- **Expected Range:** 12-20 layers (optimized Dockerfile)
- **Alert Thresholds:**
  - Warning: >25 layers
  - Critical: >40 layers (indicates optimization regression)
- **Dashboard:** Code-Server Image Optimization

## Datadog Events

### Build Lifecycle Events

#### Build Started
```json
{
  "title": "Code-Server Build Started: [profile]",
  "text": "Build started for profile [profile] on architectures amd64,arm64",
  "tags": [
    "service:code-server",
    "profile:[profile]",
    "version:[version]",
    "git_sha:[sha]",
    "workflow:[workflow]",
    "run_id:[github_run_id]"
  ],
  "alert_type": "info"
}
```

#### Build Completed
```json
{
  "title": "Code-Server Build [status]: [profile]",
  "text": "Build [status] for profile [profile] in [duration]s",
  "tags": [
    "service:code-server",
    "profile:[profile]",
    "version:[version]",
    "git_sha:[sha]",
    "workflow:[workflow]",
    "status:[status]"
  ],
  "alert_type": "success|error"
}
```

## Dashboard Configurations

### Code-Server Build Performance Dashboard

**Purpose:** Real-time monitoring of build duration trends and bottleneck identification

**Widgets:**
1. **Build Duration by Profile** (Timeseries)
   - Metric: `avg:codeserver.build.duration{*} by {profile}`
   - Visualization: Line graph with 7-day trend
   - Threshold lines: 720s warning, 1500s critical

2. **Build Success Rate** (Query Value)
   - Metric: `(sum:codeserver.build.status{status:success}.as_count() / sum:codeserver.build.status{*}.as_count()) * 100`
   - Visualization: Large number with % formatting
   - Conditional formatting: Green >99%, Yellow 95-99%, Red <95%

3. **Push Duration Heatmap** (Heatmap)
   - Metric: `avg:codeserver.build.push_duration{*} by {profile,registry}`
   - Visualization: Color-coded cells by duration range

4. **Build Duration Distribution** (Distribution)
   - Metric: `histogram:codeserver.build.duration{*}`
   - Visualization: P50, P75, P90, P95, P99 percentiles

### Code-Server Image Size Dashboard

**Purpose:** Track image size growth and identify optimization opportunities

**Widgets:**
1. **Image Size Trend by Profile** (Timeseries)
   - Metric: `avg:codeserver.build.image_size{*} by {profile,architecture}`
   - Visualization: Stacked area chart
   - Rollup: Daily average

2. **Layer Count by Profile** (Bar Chart)
   - Metric: `latest:codeserver.build.layers{*} by {profile}`
   - Visualization: Horizontal bars
   - Threshold line: 25 layers warning

3. **Size Delta from Baseline** (Change)
   - Metric: `pct_change(avg:codeserver.build.image_size{*} by {profile},week_before(avg:codeserver.build.image_size{*} by {profile}))`
   - Visualization: Change percentage with arrow indicators

4. **Architecture Size Comparison** (Group Bar)
   - Metric: `avg:codeserver.build.image_size{*} by {profile,architecture}`
   - Visualization: Grouped bars comparing amd64 vs arm64

## Monitor Configurations

### Critical Monitors

#### Build Failure Monitor
```
Monitor: codeserver.build.status == 0
Name: Code-Server Build Failed
Message: |
  Build failed for profile {{profile.name}} on version {{version.name}}

  Git SHA: {{git_sha.name}}
  Workflow Run: https://github.com/ryanmaclean/vibecode-webgui/actions/runs/{{run_id.name}}

  @slack-platform-build @pagerduty-build-oncall
Tags: service:code-server, severity:critical
Threshold: alert on any failure
Recovery: alert when success resumes
```

#### Build Duration Monitor
```
Monitor: avg(last_1h):avg:codeserver.build.duration{*} by {profile}
Name: Code-Server Build Duration Elevated
Message: |
  Build duration for {{profile.name}} is elevated

  Current: {{value}} seconds
  Warning: 720s (12 min)
  Critical: 1500s (25 min)

  Check:
  - Buildx cache hit rate
  - Runner resource availability
  - Network connectivity to registries

  @slack-platform-observability
Tags: service:code-server, severity:warning
Thresholds:
  warning: 720
  critical: 1500
```

#### Image Size Growth Monitor
```
Monitor: pct_change(avg(last_1d):avg:codeserver.build.image_size{*} by {profile}, week_before(avg(last_1d):avg:codeserver.build.image_size{*} by {profile}))
Name: Code-Server Image Size Growth
Message: |
  Image size for {{profile.name}} has grown significantly

  Growth: {{value}}%
  Warning threshold: 15%
  Critical threshold: 30%

  Investigation checklist:
  - Check recent dependency updates
  - Review new tooling additions
  - Verify layer optimization (target: 12-20 layers)
  - Consider multi-stage build improvements

  @slack-platform-build
Tags: service:code-server, severity:warning
Thresholds:
  warning: 15
  critical: 30
```

#### Layer Count Monitor
```
Monitor: max(last_5m):max:codeserver.build.layers{*} by {profile}
Name: Code-Server Layer Count Elevated
Message: |
  Layer count for {{profile.name}} exceeds optimization target

  Current layers: {{value}}
  Target: 12-20 layers
  Warning: 25 layers
  Critical: 40 layers

  Indicates Dockerfile optimization regression. Review:
  - RUN command consolidation
  - COPY operation grouping
  - Multi-stage build efficiency

  @slack-platform-build
Tags: service:code-server, severity:warning
Thresholds:
  warning: 25
  critical: 40
```

## Integration Details

### Workflow Integration
Metrics are submitted via Datadog HTTP API from GitHub Actions workflow:
- API endpoint: `https://api.datadoghq.com/api/v2/series`
- Authentication: `DD-API-KEY` header with `DD_API_KEY` secret
- Retry logic: Best-effort submission with graceful failure
- Fallback: Workflow continues if Datadog submission fails

### Required Secrets
```yaml
DD_API_KEY: Datadog API key with metric submission permissions
DD_SITE: Datadog site (default: datadoghq.com, alternative: datadoghq.eu)
```

### Metric Submission Flow
```
1. Build Start → Record timestamp → Emit start event
2. Build + Push → Docker build-push-action
3. Push Complete → Record push timestamp
4. Calculate Durations → Compute build and push times
5. Collect Image Metrics → Inspect images for size and layers
6. Submit to Datadog → Batch submit all metrics with tags
7. Emit Completion Event → Success or failure event
```

## Query Examples

### Average Build Duration by Profile (Last 7 Days)
```
avg:codeserver.build.duration{*} by {profile}.rollup(avg, 86400)
```

### Build Success Rate (Rolling 24h)
```
(sum:codeserver.build.status{status:success}.as_count().rollup(sum, 3600) /
 sum:codeserver.build.status{*}.as_count().rollup(sum, 3600)) * 100
```

### Image Size Growth Week-over-Week
```
(avg:codeserver.build.image_size{*} by {profile} -
 week_before(avg:codeserver.build.image_size{*} by {profile})) /
week_before(avg:codeserver.build.image_size{*} by {profile}) * 100
```

### P95 Push Duration by Registry
```
p95:codeserver.build.push_duration{*} by {registry}
```

### Layer Count Anomalies
```
anomalies(avg:codeserver.build.layers{*} by {profile}, 'basic', 2)
```

## Alerting Strategy

### Severity Levels

**Critical (PagerDuty + Slack)**
- Build failure on main branch
- Build duration >25 minutes
- Image size growth >30%
- Layer count >40 (severe optimization regression)

**Warning (Slack only)**
- Build duration >12 minutes
- Success rate <98% over 6h
- Image size growth >15%
- Layer count >25

**Info (Dashboard annotations)**
- Build started events
- Successful build completions
- Version releases

### On-Call Rotation
- **Primary:** Platform Build team (build failures, duration issues)
- **Secondary:** Observability team (metric gaps, monitoring health)
- **Escalation:** Platform Ops (registry access, infrastructure)

## Troubleshooting Guide

### Metric Not Appearing in Datadog

**Symptom:** Metrics missing from dashboard after workflow run

**Investigation:**
1. Check workflow logs for "Datadog credentials not available" messages
2. Verify `DD_API_KEY` and `DD_SITE` secrets are configured in repository
3. Confirm API calls returned 2xx status codes in workflow logs
4. Check Datadog Metrics Explorer for metric existence with wildcard query

**Resolution:**
- Configure missing secrets in GitHub repository settings
- Verify Datadog API key has `metrics_write` permission
- Wait 5 minutes for metric ingestion delay
- Contact Datadog support if API returns 403 Forbidden

### Build Duration Spikes

**Symptom:** Sudden increase in `codeserver.build.duration` metric

**Investigation:**
1. Check Buildx cache hit rate in workflow logs
2. Review GitHub Actions runner availability and queue times
3. Inspect network latency to container registries
4. Compare layer count between versions (cache invalidation indicator)
5. Check for recent dependency updates that increased build time

**Resolution:**
- Clear and rebuild Buildx cache if corruption suspected
- Rotate to different GitHub-hosted runner if persistent
- Optimize Dockerfile RUN commands to improve layer caching
- Profile slow build steps with `docker buildx build --progress=plain`

### Image Size Growth

**Symptom:** `codeserver.build.image_size` trending upward beyond thresholds

**Investigation:**
1. Compare layer sizes between versions: `docker history [image]`
2. Review recent Dockerfile changes and dependency updates
3. Check for accidentally included build artifacts or cache files
4. Verify `.dockerignore` is preventing unnecessary context files
5. Inspect installed package sizes: `apt list --installed` in image

**Resolution:**
- Remove unnecessary dependencies from `apt-get install` lists
- Use multi-stage builds to exclude build-time dependencies
- Consolidate RUN commands to reduce layer count
- Add cleanup commands: `rm -rf /var/lib/apt/lists/*`
- Use `docker-slim` or similar tools for aggressive optimization

### Layer Count Regression

**Symptom:** `codeserver.build.layers` exceeds 25-40 threshold

**Investigation:**
1. Count Dockerfile RUN, COPY, ADD commands
2. Identify unconsolidated operations that could be merged
3. Check for changes that split previously combined RUN commands
4. Review multi-stage build efficiency

**Resolution:**
- Combine RUN commands with `&&` operators
- Group COPY operations for files with similar lifecycle
- Use multi-stage builds to isolate build dependencies
- Target: 12-20 layers total (optimized baseline)

## Maintenance

### Weekly Tasks
- Review dashboard for anomalies and trends
- Validate monitors are triggering appropriately
- Update expected ranges based on profile changes
- Archive old metric data per retention policy

### Monthly Tasks
- Audit alert thresholds against actual performance
- Review on-call escalation effectiveness
- Update dashboard widgets for new profiles
- Optimize queries for performance

### Quarterly Tasks
- Evaluate new Datadog features for build observability
- Benchmark against industry standards
- Update documentation with lessons learned
- Review and optimize metric retention costs

## Cost Optimization

### Metric Volume Estimate
- **Metrics:** 5 metrics × 5 profiles × 2 architectures (where applicable) = ~40 data points per build
- **Build Frequency:** ~10 builds/day (nightly + on-demand)
- **Monthly Volume:** ~12,000 custom metric samples
- **Estimated Cost:** ~$0.05 per 100 custom metrics = ~$6/month

### Retention Recommendations
- **High-resolution (1h rollup):** 15 days
- **Daily rollup:** 90 days
- **Weekly rollup:** 1 year
- **Monthly rollup:** Indefinite

## References

- **Workflow Source:** `.github/workflows/codeserver-profiles.yml`
- **Issue Tracking:** GitHub Issue #412
- **Release Runbook:** `docs/handoff/code-server-release.md`
- **Datadog Dashboard:** [Code-Server Build Performance](https://app.datadoghq.com/dashboard/code-server-builds)
- **Datadog Monitors:** [Code-Server Build Monitors](https://app.datadoghq.com/monitors/manage?q=service:code-server)

## Changelog

### 2025-10-01 - Initial Implementation
- Added `codeserver.build.duration` metric
- Added `codeserver.build.status` metric
- Added `codeserver.build.image_size` metric per architecture
- Added `codeserver.build.layers` metric per architecture
- Added `codeserver.build.push_duration` metric
- Configured build start and completion events
- Created monitoring dashboards and alerts
- Documented troubleshooting procedures
