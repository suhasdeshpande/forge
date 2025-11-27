# Forge + Hono SSE example

A minimal Hono server that streams pipeline events using Server-Sent Events. The default prompt is "Generate Hello World React app", but you can override it via a query parameter.

## Run

```bash
bun install
bun run dev
```

Then open your browser at `http://localhost:8787/generate` or use `curl`:

```bash
curl -N http://localhost:8787/generate
```

You can provide a custom prompt:

```bash
curl -N "http://localhost:8787/generate?prompt=Build%20Todo%20app"
```
