# bench.v1 fixtures

Verbatim copies from the canonical contract, used to detect drift between the
upstream JSON Schema and the zod mirror in `src/lib/bench/v1.ts`.

- `bench.v1.schema.json` <- ryanmaclean/skills `schemas/bench.v1.schema.json`
- `bench.v1.example.json` <- ryanmaclean/skills `examples/bench.v1.example.json`

Source commit: `720502f92cd781a04289e289e95b497ce6c9bea4`.
Refresh by re-copying both files; `v1.test.ts` fails if the metric set or
required fields diverge from the zod schema.
