# MicroVM Benchmark DogStatsD Plan – Day 0 Draft

## Objectives
- Emit per-run metrics for boot latency, HTTP handshake success rate, and error counts.
- Integrate with Datadog dashboards defined in issue #550.
- Trigger benchmarks automatically after successful packaging CI (see #553).

## Metrics (proposed)
| Metric | Type | Tags | Description |
|--------|------|------|-------------|
| `vibecode.microvm.boot_latency` | histogram | vm=openvscode, build=stable/insiders | Measured boot time in ms.
| `vibecode.microvm.handshake_success` | count | vm=openvscode | Increment on successful HTTP check.
| `vibecode.microvm.handshake_failure` | count | vm=openvscode, error | Increment per failure (with error class tag).
| `vibecode.microvm.benchmark_duration` | histogram | vm=openvscode | Total benchmark runtime.

## CI Integration Outline
1. Add job `microvm-bench` after handshake fix validation.
2. Steps:
   - Checkout repo.
   - Build or download latest microVM image.
   - Run `scripts/benchmarks/boot_latency_bench.py --dogstatsd`.
   - Run new handshake smoke test.
   - Upload JSON report to `performance-results/` artifact.
3. Fail job if handshake fails or metrics missing.

## Next Steps
- Implement metrics emission in benchmark scripts.
- Coordinate tags with Observability persona.
- Provide sample JSON output for review.
