import { describe, expect, it } from "bun:test";
import { forge } from "../src/index";

type State = { count: number; log: string[] };

const z = forge.z;

describe("Pipeline", () => {
  it("runs steps sequentially and emits pipeline events", async () => {
    const Increment = forge.step({
      name: "increment",
      input: z.object({ count: z.number() }),
      output: z.object({ count: z.number() }),
      handler: ({ count }) => ({ count: count + 1 }),
    });

    const Log = forge.step({
      name: "log",
      input: z.object({ count: z.number(), log: z.array(z.string()) }),
      output: z.object({ log: z.array(z.string()) }),
      handler: ({ count, log }) => ({ log: [...log, `count=${count}`] }),
    });

    const pipeline = forge
      .pipeline<State>()
      .step(Increment, {
        input: (state) => ({ count: state.count }),
        apply: (state, output) => ({ ...state, count: output.count }),
      })
      .step(Log, {
        input: (state) => ({ count: state.count, log: state.log }),
        apply: (state, output) => ({ ...state, log: output.log }),
      });

    const events: string[] = [];
    const finalState = await pipeline.run({ count: 0, log: [] }, (event) => {
      events.push(event.type);
    });

    expect(finalState.count).toBe(1);
    expect(finalState.log).toEqual(["count=1"]);
    expect(events).toEqual([
      "pipeline_start",
      "step_start",
      "step_event",
      "step_event",
      "step_event",
      "step_event",
      "step_end",
      "step_start",
      "step_event",
      "step_event",
      "step_event",
      "step_event",
      "step_end",
      "pipeline_end",
    ]);
  });

  it("skips conditional steps when condition is false", async () => {
    const step = forge.step({
      name: "noop",
      input: z.object({ count: z.number() }),
      output: z.object({ count: z.number() }),
      handler: ({ count }) => ({ count: count + 10 }),
    });

    const pipeline = forge
      .pipeline<State>()
      .step(step, {
        input: (state) => ({ count: state.count }),
        apply: (state, output) => ({ ...state, count: output.count }),
        condition: (state) => state.count > 0,
      });

    const finalState = await pipeline.run({ count: 0, log: [] });
    expect(finalState.count).toBe(0);
  });
});
