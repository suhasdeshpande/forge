import { describe, expect, it } from "bun:test";
import { forge, Step, type StepEvent } from "../src/index";

const z = forge.z;

describe("Step", () => {
  it("validates input/output and emits consensus events", async () => {
    const step = new Step({
      name: "echo",
      input: z.object({ text: z.string() }),
      output: z.object({ text: z.string() }),
      handler: ({ text }) => ({ text }),
      strategy: { initialSamples: 2, k: 1, maxSamples: 3 },
    });

    const events: string[] = [];
    const result = await step.execute({ text: "hi" }, (event) => {
      events.push(event.type);
    });

    expect(result.output).toEqual({ text: "hi" });
    expect(result.samples.length).toBeGreaterThanOrEqual(1);
    expect(events).toContain("step_start");
    expect(events).toContain("sample");
    expect(events).toContain("vote_update");
    expect(events).toContain("step_decided");
  });

  it("skips red-flagged samples and still returns a winner", async () => {
    let count = 0;
    const step = forge.step({
      name: "flagged",
      input: z.object({ unit: z.string() }),
      output: z.object({ value: z.number() }),
      handler: () => ({ value: ++count }),
      strategy: { initialSamples: 2, k: 1, maxSamples: 4 },
      redFlags: [
        {
          description: "even values are invalid",
          test: (sample) => sample.value % 2 === 0,
        },
      ],
    });

    const events: Array<{ type: string }> = [];
    const result = await step.execute({ unit: "m" }, (event) => {
      events.push({ type: event.type });
    });

    expect(result.samples.every((s) => s.value % 2 === 1)).toBe(true);
    expect(events.some((e) => e.type === "red_flag")).toBe(true);
    expect(result.output.value % 2).toBe(1);
  });

  it("continues sampling when schema validation fails", async () => {
    let called = 0;
    const step = forge.step({
      name: "fragile",
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
      handler: () => {
        called += 1;
        if (called === 1) {
          // Bad payload that will be rejected by the output schema
          return { ok: "nope" } as unknown as { ok: boolean };
        }
        return { ok: true };
      },
      strategy: { initialSamples: 1, maxSamples: 3 },
    });

    const events: StepEvent<unknown>[] = [];
    const result = await step.execute({}, (event) => events.push(event));

    expect(result.output.ok).toBe(true);
    expect(events.some((e) => e.type === "invalid_sample")).toBe(true);
  });

  it("throws when no valid samples are produced", async () => {
    const step = forge.step({
      name: "always-red-flag",
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
      handler: () => ({ ok: false }),
      strategy: { initialSamples: 1, k: 1, maxSamples: 2 },
      redFlags: [
        { description: "reject all", test: () => true },
      ],
    });

    await expect(step.execute({})).rejects.toThrow(/no valid samples/);
  });
});
