import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { forge, z } from "../../src";

const planAppStep = forge.step({
  name: "plan-app",
  input: z.object({
    prompt: z.string(),
  }),
  output: z.object({
    plan: z.array(z.string()),
  }),
  prompt: ({ prompt }) => `Create a concise React plan for: ${prompt}`,
  handler: async ({ prompt }) => ({
    plan: [
      `Initialize project structure for "${prompt}"`,
      "Set up a simple React entrypoint and render Hello World",
    ],
  }),
});

const outlineFilesStep = forge.step({
  name: "outline-files",
  input: z.object({
    plan: z.array(z.string()),
  }),
  output: z.object({
    files: z.array(z.object({
      path: z.string(),
      contents: z.string(),
    })),
  }),
  prompt: ({ plan }) =>
    `Generate files for a React app given the plan: ${plan.join(" | ")}`,
  handler: async ({ plan }) => ({
    files: [
      {
        path: "src/main.tsx",
        contents: [
          "import React from 'react';",
          "import { createRoot } from 'react-dom/client';",
          "import './styles.css';",
          "",
          "const App = () => <h1>Hello World from Forge!</h1>;",
          "",
          "const root = createRoot(document.getElementById('root')!);",
          "root.render(<App />);",
        ].join("\n"),
      },
      {
        path: "src/styles.css",
        contents: [
          "body {",
          "  font-family: system-ui, sans-serif;",
          "  display: grid;",
          "  place-items: center;",
          "  height: 100vh;",
          "  margin: 0;",
          "  background: radial-gradient(circle at 20% 20%, #e0f4ff, #f8fbff);",
          "}",
          "",
          "h1 {",
          "  color: #0f172a;",
          "  letter-spacing: 0.02em;",
          "}",
        ].join("\n"),
      },
    ],
  }),
});

const summarizeStep = forge.step({
  name: "summarize",
  input: z.object({
    plan: z.array(z.string()),
    files: z.array(z.object({
      path: z.string(),
      contents: z.string(),
    })),
  }),
  output: z.object({
    summary: z.string(),
  }),
  handler: async ({ plan, files }) => ({
    summary: [
      "React Hello World ready!",
      `Plan items: ${plan.length}`,
      `Generated files: ${files.map((file) => file.path).join(", ")}`,
    ].join(" \n"),
  }),
});

type AppState = {
  prompt: string;
  plan?: string[];
  files?: Array<{ path: string; contents: string }>;
  summary?: string;
};

const pipeline = forge
  .pipeline<AppState>()
  .step(planAppStep, {
    input: (state) => ({ prompt: state.prompt }),
    apply: (state, output) => ({ ...state, plan: output.plan }),
  })
  .step(outlineFilesStep, {
    input: (state) => ({ plan: state.plan ?? [] }),
    apply: (state, output) => ({ ...state, files: output.files }),
    condition: (state) => (state.plan?.length ?? 0) > 0,
  })
  .step(summarizeStep, {
    input: (state) => ({
      plan: state.plan ?? [],
      files: state.files ?? [],
    }),
    apply: (state, output) => ({ ...state, summary: output.summary }),
    condition: (state) => Boolean(state.files?.length),
  });

const app = new Hono();

app.get("/generate", (c) => {
  const prompt = c.req.query("prompt") ?? "Generate Hello World React app";
  const initialState: AppState = { prompt };

  return streamSSE(c, async (stream) => {
    await pipeline.run(initialState, (event) => {
      stream.writeSSE({ event: "pipeline", data: JSON.stringify(event) });
    });

    stream.writeSSE({
      event: "done",
      data: JSON.stringify({ message: "Pipeline completed" }),
    });
    stream.close();
  });
});

app.get("/", (c) => c.text("Forge Hono SSE example running. Hit /generate to stream."));

const port = Number(process.env.PORT ?? 8787);
console.log(`Listening on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
