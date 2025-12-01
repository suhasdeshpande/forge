# Forge benchmark

Benchmarks that contrast raw model calls with Forge's consensus and schema
validation.

## Synthetic benchmark

Uses a noisy synthetic generator that sometimes returns invalid JSON or missing
fields to emulate real LLM drift.

```bash
bun run examples/benchmark/bench.ts
```

The script prints a side-by-side summary showing how many requests produce valid
structured outputs with and without Forge's reliability layer.

## Real LLM benchmark (OpenAI-compatible)

Calls an actual chat model to highlight how Forge cleans up real responses with
consensus, validation, and red-flag filtering.

```bash
export OPENAI_API_KEY=sk-...
# Optional: OPENAI_MODEL=gpt-4o-mini or your chosen model
# Optional: OPENAI_BASE_URL=https://api.openai.com/v1/chat/completions
bun run examples/benchmark/bench-openai.ts
```

The script issues the same tasks as the synthetic version, first as raw model
calls and then through a Forge step configured with ahead-by-1 consensus. It
reports valid/invalid counts, invalid detail depth, samples consumed, and
red-flag skips so you can compare how the reliability layer behaves on live
model outputs.
