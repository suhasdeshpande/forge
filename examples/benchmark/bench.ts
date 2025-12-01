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

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noisyModel(task: string, rng: () => number): unknown {
  const roll = rng();
  if (roll < 0.18) {
    // Completely invalid structure
    return "not-json: " + task;
  }
  if (roll < 0.42) {
    // Missing details
    return { title: task, steps: ["hello"], estimateHours: -1 } satisfies Partial<PlanOutput>;
  }
  const quality = rng();
  const steps = quality < 0.3 ? ["skip integration"] : [`setup ${task}`, "wire UI", "ship"];
  const estimateHours = Math.round(quality * 150);
  return { title: `${task} plan`, steps, estimateHours } satisfies PlanOutput;
}

function normalizeRaw(raw: unknown) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return { error: String(error), raw };
    }
  }
  return raw;
}

function runBaseline(iterations: number): Metrics {
  const metrics: Metrics = { valid: 0, invalid: 0, invalidDetails: 0, redFlags: 0, samples: 0 };

  tasks.forEach((task, index) => {
    const rng = mulberry32(iterations * 100 + index);
    const raw = noisyModel(task, rng);
    metrics.samples += 1;
    const parsed = outputSchema.safeParse(normalizeRaw(raw));
    if (parsed.success) {
      metrics.valid += 1;
    } else {
      metrics.invalid += 1;
      metrics.invalidDetails += parsed.error.errors.length;
    }
  });

  return metrics;
}

async function runForge(iterations: number): Promise<Metrics> {
  const metrics: Metrics = { valid: 0, invalid: 0, invalidDetails: 0, redFlags: 0, samples: 0 };
  const planStep = forge.step({
    name: "plan",
    input: z.object({ task: z.string(), seed: z.number() }),
    output: outputSchema,
    strategy: { initialSamples: 2, k: 1, maxSamples: 6 },
    redFlags: [
      { description: "Too few steps", test: (sample) => sample.steps.length < 3 },
      {
        description: "Unreasonable estimate",
        test: (sample) => sample.estimateHours < 1 || sample.estimateHours > 120,
      },
    ],
    handler: ({ task, seed }) => {
      const rng = mulberry32(seed);
      const raw = noisyModel(task, rng);
      if (typeof raw === "string") {
        // Let the step-level validation decide if parsing failed
        return JSON.parse(raw);
      }
      return raw as PlanOutput;
    },
  });

  for (const [index, task] of tasks.entries()) {
    const seed = iterations * 100 + index;
    const events: Array<{ type: string }> = [];
    const result = await planStep.execute({ task, seed }, (event) => {
      events.push({ type: event.type });
      if (event.type === "red_flag") metrics.redFlags += 1;
      if (event.type === "invalid_sample") metrics.invalidDetails += 1;
    });

    metrics.samples += events.filter((e) => e.type === "sample").length;
    metrics.valid += 1;
    metrics.invalid += events.filter((e) => e.type === "invalid_sample").length;
    // Count red flags separately; they represent samples we filtered away
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
  const iterations = 1;
  const baseline = runBaseline(iterations);
  const reliable = await runForge(iterations);

  console.log("\nForge reliability benchmark (synthetic)");
  console.log("Tasks:", tasks.length, "| Failure modes: invalid JSON, missing fields, unrealistic estimates");

  printSummary("Raw model calls", baseline);
  printSummary("Forge step with consensus + validation", reliable);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
