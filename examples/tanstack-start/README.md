# Forge + TanStack Start client example

A small TanStack Router app that consumes the Forge Hono SSE pipeline and renders
incoming events in real time. The UI connects to the SSE endpoint exposed by the
[`examples/hono-sse`](../hono-sse) server.

## Prerequisites

1. Start the Hono SSE server in another terminal:

   ```bash
   cd ../hono-sse
   bun install
   bun run dev
   ```

   By default it listens on `http://localhost:8787/generate`.

2. Install client dependencies:

   ```bash
   bun install
   ```

## Run the client

In this folder run:

```bash
bun run dev
```

Then open `http://localhost:5173` and click **Stream pipeline**. The client will
open an `EventSource` to the Hono endpoint, render each pipeline event, and
summarize the latest pipeline state.

Set `VITE_PIPELINE_ENDPOINT` to point at a different SSE endpoint if needed:

```bash
VITE_PIPELINE_ENDPOINT="https://example.com/generate" bun run dev
```
