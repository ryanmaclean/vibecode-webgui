# bench.v1 fixtures

Verbatim copies from the canonical contract, used to detect drift between the
upstream JSON Schema and the zod mirror in `src/lib/bench/v1.ts`.

- `bench.v1.schema.json` <- ryanmaclean/skills `schemas/bench.v1.schema.json`
  (blob matches commit `720502f92cd781a04289e289e95b497ce6c9bea4`)
- `bench.v1.example.json` <- ryanmaclean/skills `examples/bench.v1.example.json`
  (blob first appears in commit `4e716b8e51e5e7b6a4e0145a563d81b370ea1fc8`; it is not in `720502f`)
- `docs/architecture/BENCH_V1_INTEGRATION.md` summarises `docs/BENCHMARKING.md`, which
  first appears in ryanmaclean/skills commit `3800845ace3851bc00b41fe8636eaac6221db381`.

Refresh by re-copying both files; `v1.test.ts` fails if the metric set or
required fields diverge from the zod schema.
