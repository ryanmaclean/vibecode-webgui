# ryanlab.bench.v1 integration

Status: implemented (issue #2132). Related: #2126, #2130, #2131.

## Decision

VibeCode **consumes** the shared benchmark record `ryanlab.bench.v1`. It does
not define a canonical benchmark format of its own, and it does not store
benchmark records.

- Canonical schema: `ryanmaclean/skills:schemas/bench.v1.schema.json`
- Contract notes: `ryanmaclean/skills:docs/BENCHMARKING.md`
- Producers: smolFire, BOP, Moth, agent-jail, autoresearch

Per the shared constraints ("derived views are disposable"; "identity, order,
content hash and presentation remain distinct"), everything VibeCode computes
from a record is presentation. The raw record stays the only benchmark fact.

## Surfaces

| Surface | Path | Role |
|---|---|---|
| Validator (zod mirror of the JSON Schema) | `src/lib/bench/v1.ts` | Parse JSON record, array, `{records}` envelope or NDJSON; keep valid records, report invalid ones by index and path |
| Presentation projection | `src/lib/bench/view.ts` | Group by `project/runtime/filesystem/workload`, sort by time, latest-vs-previous deltas, unit formatting |
| Agent API | `GET/POST /api/v1/bench/view` | `GET`: descriptor (`vibecode.endpoint.v1`). `POST`: records -> `vibecode.bench-view.v1`. Stateless, 1 MiB / 5000-record cap |
| UI | `src/components/bench/`, `/monitoring/benchmarks` | Paste or load a file; parsed in the browser; never uploaded |

## Contract rules carried into the code

- `null` metrics mean "not measured". They render as "not measured" and are
  never coerced to 0 or included in deltas.
- `metrics` is open for extension. Extension metrics are preserved and shown
  with a neutral spec (direction `unknown`, verdict `changed`, never
  better/worse).
- Unknown top-level fields are preserved (`additionalProperties: true`).
- All ten core metrics are lower-is-better.
- A metric measured on only one side of a comparison is `not-comparable`,
  not a regression.
- Datadog metric names from `BENCHMARKING.md` are recorded in
  `CORE_METRIC_SPECS` **for linking only**. VibeCode does not emit them;
  projection to Datadog belongs to producers (see #2130 / #2131).

## Drift protection

`src/lib/bench/__tests__/fixtures/` holds verbatim copies of the upstream
schema and example (source commit recorded in its README). `v1.test.ts` fails
if the core metric set, top-level properties, required fields, schema id or
`$id` diverge from the zod mirror. To pick up a new upstream version, re-copy
both files and update `v1.ts` until the drift tests pass.

## Existing benchmark shapes in this repo

| Shape | Location | Disposition |
|---|---|---|
| OpenVSCode microVM benchmark JSON (`benchmark_id`, `boot_times[]`, `memory_usage[]`, `summary.boot_time_avg_ms`, `summary.memory_avg_mb`) | `scripts/benchmarks/openvscode_benchmark.py` | **Not imported.** The script substitutes random values when it cannot measure (boot sleep 0.8–1.2 s; memory 384–512 MB). Its output cannot tell measured from simulated values, so converting it would put invented data into the shared format. Follow-up: make the producer emit `ryanlab.bench.v1` with `null` for unmeasured metrics, or move the benchmark to smolFire. |
| M-series performance `BenchmarkResult` | `scripts/benchmarks/m_series_performance_test.py` | Host/editor timing, not runtime/storage. Keep local; not a bench.v1 producer. |
| `VectorCacheBenchmark` results (`averageTimeMs`, `p95TimeMs`, `cacheHitRate`) | `src/lib/cache/vector-cache-benchmark.ts` | In-app cache micro-benchmark. UI-specific; keep. Could emit bench.v1 with extension metrics later if it is shown alongside runtime benchmarks. |
| AI model benchmark scores | `src/types/model-comparison.ts`, `src/components/ai/ModelComparison.tsx` | Model quality scores (MMLU etc.), a different domain. Keep; out of scope for bench.v1. |

## Non-goals

- No persistence of benchmark records in VibeCode (no Prisma model, no cache).
- No Datadog/OpenLineage emission from VibeCode.
- No VibeCode-specific benchmark schema.
