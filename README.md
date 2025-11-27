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

## Roadmap

- HTTP helpers for Hono and Express
- NDJSON/SSE builders
- Typed client generation for pipelines
- Resume/checkpoint support for long-running workflows

## License

MIT
