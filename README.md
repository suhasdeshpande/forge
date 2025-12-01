# Forge SDK (pre-alpha)

Forge is a lightweight reliability layer for LLM pipelines. It focuses on
structural correctness, schema validation, and typed streaming primitives rather
than full-blown agent orchestration.

## Why

LLM outputs drift, hallucinate fields, and often break downstream systems. Forge
provides a typed `step` abstraction backed by Zod schemas and a composable
`pipeline` builder to keep multi-step workflows reliable.

## Features

- Typed steps with input/output schemas and prompt builders
- Multi-sample consensus with ahead-by-<em>k</em> early stopping
- Red-flag filtering for unsafe or malformed samples
- Pipeline runner that wires state between steps and emits structured events
- Framework-agnostic: use in Express, Hono, serverless functions, and more

## Getting started

Install dependencies with Bun (Forge depends only on `zod` at runtime):

```bash
bun install
bun run build
```

### Define a step

```ts
import { forge } from "forge";

const DraftPatch = forge.step({
  name: "draft-patch",
  input: forge.z.object({
    plan: forge.z.array(forge.z.string()),
    source: forge.z.string(),
  }),
  output: forge.z.object({
    patch: forge.z.string(),
  }),
  prompt: ({ plan, source }) => `Rewrite source based on: ${plan.join("; ")}`,
  strategy: { initialSamples: 3, k: 2, maxSamples: 5 },
  redFlags: [
    {
      description: "Patch must not be empty",
      test: (sample) => sample.patch.trim().length === 0,
    },
  ],
  handler: async (input) => {
    // Call your model here. For now this is a stub.
    return { patch: `// todo: apply plan to ${input.source}` };
  },
});
```

### Compose a pipeline

```ts
import { forge } from "forge";

interface CodeState {
  plan: string[];
  patch?: string;
}

const pipeline = forge
  .pipeline<CodeState>()
  .step(DraftPatch, {
    input: (state) => ({ plan: state.plan, source: state.plan.join("\n") }),
    apply: (state, output) => ({ ...state, patch: output.patch }),
  });
```

### Run with events

```ts
const events: any[] = [];
const finalState = await pipeline.run(
  { plan: ["add logging", "tighten types"] },
  (event) => events.push(event)
);
```

`events` will include structured `step_start`, `sample`, `vote_update`, and
`pipeline_end` entries you can stream over SSE/NDJSON.

### Validate locally

Run type checking and tests with Bun:

```bash
bun run lint
bun test
```

### Examples

**Hono SSE pipeline**

Try the example server that streams a pipeline for generating a Hello World
React app:

```bash
cd examples/hono-sse
bun install
bun run dev
```

Then open `http://localhost:8787/generate` to watch pipeline events over SSE.

**TanStack Start client**

Use a TanStack Router SPA to consume the SSE stream and render pipeline events
on the client:

```bash
cd examples/tanstack-start
bun install
bun run dev
```

With the Hono example running on port `8787`, open `http://localhost:5173` and
press **Stream pipeline** to see live updates. Set `VITE_PIPELINE_ENDPOINT` to
point the client at any compatible SSE endpoint.

**Benchmarks (synthetic + real LLM)**

Show the reliability delta between raw model calls and a Forge step:

```bash
bun run examples/benchmark/bench.ts
```

The synthetic script uses a noisy model that sometimes emits invalid JSON or
missing fields and prints how many requests survive when Forge enforces schema
validation, red-flag filtering, and consensus.

To try the same comparison against an actual chat model (OpenAI-compatible):

```bash
export OPENAI_API_KEY=sk-...
# Optional: OPENAI_MODEL=gpt-4o-mini
# Optional: OPENAI_BASE_URL=https://api.openai.com/v1/chat/completions
bun run examples/benchmark/bench-openai.ts
```

You’ll see separate summaries for raw model calls and the Forge step with
consensus so you can compare how many responses stay schema-valid.

## Roadmap

- HTTP helpers for Hono and Express
- NDJSON/SSE builders
- Typed client generation for pipelines
- Resume/checkpoint support for long-running workflows

## License

MIT
