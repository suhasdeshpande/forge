import { forge } from "../../src/index";

const z = forge.z;

type PlanOutput = {
  title: string;
  steps: string[];
  estimateHours: number;
};

const outputSchema = z.object({
  title: z.string().min(3),
  steps: z.array(z.string().min(5)).min(2),
  estimateHours: z.number().int().min(1).max(120),
});

const tasks = [
  "Generate Hello World React app",
  "Create onboarding email flow",
  "Draft REST API spec for a todo service",
  "Outline unit tests for a math library",
  "Propose schema for a blog engine",
  "Draft Slack bot MVP milestones",
  "Design feature flags rollout plan",
  "Summarize observability setup for bun + hono",
];

type Metrics = {
  valid: number;
  invalid: number;
  invalidDetails: number;
  redFlags: number;
  samples: number;
};

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1/chat/completions";
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

if (!apiKey) {
  console.error("OPENAI_API_KEY is required to run the LLM benchmark.");
  process.exit(1);
}

async function callLLM(task: string): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "Return plans strictly as JSON matching {title, steps, estimateHours}.",
        },
        {
          role: "user",
          content: `Create a concise project plan for: ${task}. Include at least 3 steps and a realistic hourly estimate between 1 and 120 hours. Return only JSON.`,
        },
      ],
      temperature: 0.9,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("LLM response missing content");
  }
  return content;
}

function normalize(raw: string) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { error: String(error), raw };
  }
}

function emptyMetrics(): Metrics {
  return { valid: 0, invalid: 0, invalidDetails: 0, redFlags: 0, samples: 0 };
}

async function runBaseline(): Promise<Metrics> {
  const metrics = emptyMetrics();
  for (const task of tasks) {
    const raw = await callLLM(task);
    metrics.samples += 1;
    const parsed = outputSchema.safeParse(normalize(raw));
    if (parsed.success) {
      metrics.valid += 1;
    } else {
      metrics.invalid += 1;
      metrics.invalidDetails += parsed.error.errors.length;
    }
  }
  return metrics;
}

async function runForge(): Promise<Metrics> {
  const metrics = emptyMetrics();
  const planStep = forge.step({
    name: "plan-llm",
    input: z.object({ task: z.string() }),
    output: outputSchema,
    strategy: { initialSamples: 2, k: 1, maxSamples: 4 },
    redFlags: [
      { description: "Too few steps", test: (sample) => sample.steps.length < 3 },
      {
        description: "Unreasonable estimate",
        test: (sample) => sample.estimateHours < 1 || sample.estimateHours > 120,
      },
    ],
    handler: async ({ task }) => normalize(await callLLM(task)),
  });

  for (const task of tasks) {
    const events: Array<{ type: string }> = [];
    await planStep.execute({ task }, (event) => {
      events.push({ type: event.type });
      if (event.type === "red_flag") metrics.redFlags += 1;
      if (event.type === "invalid_sample") metrics.invalidDetails += 1;
    });

    metrics.samples += events.filter((e) => e.type === "sample").length;
    metrics.valid += 1;
    metrics.invalid += events.filter((e) => e.type === "invalid_sample").length;
  }

  return metrics;
}

function printSummary(label: string, metrics: Metrics) {
  const total = metrics.valid + metrics.invalid;
  console.log(`\n${label}`);
  console.table({
    "Valid outputs": metrics.valid,
    "Invalid outputs": metrics.invalid,
    "Avg invalid detail count": (metrics.invalidDetails / Math.max(1, metrics.invalid)).toFixed(2),
    "Samples evaluated": metrics.samples,
    "Valid %": `${((metrics.valid / Math.max(1, total)) * 100).toFixed(1)}%`,
    "Red-flag skips": metrics.redFlags,
  });
}

async function main() {
  console.log("Running real-LLM benchmark using", model);
  const baseline = await runBaseline();
  const reliable = await runForge();

  console.log("\nForge reliability benchmark (real model)");
  console.log(
    "Tasks:",
    tasks.length,
    "| Failure modes: invalid JSON, missing fields, unrealistic estimates",
    "| Consensus: 2-4 samples with ahead-by-1",
  );

  printSummary("Raw model calls", baseline);
  printSummary("Forge step with consensus + validation", reliable);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
