import {
  ConsensusStrategy,
  EventEmitter,
  RedFlagRule,
  StepConfig,
  StepEvent,
  VoteTally,
} from "./types";

const defaultStrategy: ConsensusStrategy = {
  initialSamples: 1,
  k: 1,
};

export class Step<Input, Output> {
  readonly name: string;
  readonly prompt?: (input: Input) => string;
  private readonly inputSchema: StepConfig<Input, Output>["input"];
  private readonly outputSchema: StepConfig<Input, Output>["output"];
  private readonly strategy: ConsensusStrategy;
  private readonly handler: StepConfig<Input, Output>["handler"];
  private readonly redFlags: RedFlagRule<Output>[];

  constructor(config: StepConfig<Input, Output>) {
    this.name = config.name;
    this.inputSchema = config.input;
    this.outputSchema = config.output;
    this.strategy = { ...defaultStrategy, ...config.strategy };
    this.prompt = config.prompt;
    this.handler = config.handler;
    this.redFlags = config.redFlags ?? [];
  }

  async execute(
    rawInput: unknown,
    emit?: EventEmitter<StepEvent<Output>>
  ): Promise<{ output: Output; samples: Output[] }> {
    const input = this.inputSchema.parse(rawInput);
    emit?.({ type: "step_start" });

    if (this.prompt) {
      emit?.({ type: "prompt", prompt: this.prompt(input) });
    }

    const samples: Output[] = [];
    const voteTally: VoteTally<Output> = new Map();

    const initialSamples = Math.max(1, this.strategy.initialSamples);
    const maxSamples = Math.max(initialSamples, this.strategy.maxSamples ?? initialSamples);

    for (let i = 0; i < maxSamples; i += 1) {
      let sample: Output;
      try {
        sample = await this.createValidatedSample(input);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "Unknown sample validation failure";
        emit?.({ type: "invalid_sample", index: i, reason });
        continue;
      }
      const hasRedFlag = this.redFlags.some((rule) => rule.test(sample));
      if (hasRedFlag) {
        const rule = this.redFlags.find((r) => r.test(sample));
        emit?.({ type: "red_flag", rule: rule?.description ?? "unknown", index: i });
        continue;
      }

      samples.push(sample);
      emit?.({ type: "sample", sample, index: i });
      this.updateTally(voteTally, sample);
      emit?.({
        type: "vote_update",
        tally: new Map(
          Array.from(voteTally.entries()).map(([key, value]) => [key, value.count])
        ),
        index: i,
      });

      const { leading, runnerUp } = this.leaders(voteTally);
      if (!leading) {
        continue;
      }
      const leadMargin = leading.count - (runnerUp?.count ?? 0);
      if (i + 1 >= initialSamples && leadMargin >= (this.strategy.k ?? 1)) {
        break;
      }
    }

    if (samples.length === 0) {
      throw new Error(`Step ${this.name} produced no valid samples`);
    }

    const output = this.selectWinner(voteTally, this.strategy.k ?? 1);
    emit?.({ type: "step_decided", output, samples });
    return { output, samples };
  }

  private async createValidatedSample(input: Input): Promise<Output> {
    const result = await this.handler(input);
    return this.outputSchema.parse(result);
  }

  private updateTally(tally: VoteTally<Output>, sample: Output) {
    const key = JSON.stringify(sample);
    const current = tally.get(key);
    if (!current) {
      tally.set(key, { count: 1, sample });
      return;
    }
    tally.set(key, { ...current, count: current.count + 1 });
  }

  private selectWinner(tally: VoteTally<Output>, aheadBy: number): Output {
    const { leading, runnerUp } = this.leaders(tally);

    if (!leading) {
      throw new Error(`No votes available for step ${this.name}`);
    }

    const leadMargin = leading.count - (runnerUp?.count ?? 0);
    if (leadMargin < aheadBy) {
      return leading.sample;
    }

    return leading.sample;
  }

  private leaders(tally: VoteTally<Output>): {
    leading?: { key: string; count: number; sample: Output };
    runnerUp?: { key: string; count: number; sample: Output };
  } {
    let leading: { key: string; count: number; sample: Output } | undefined;
    let runnerUp: { key: string; count: number; sample: Output } | undefined;

    for (const [key, entry] of tally.entries()) {
      if (!leading || entry.count > leading.count) {
        runnerUp = leading;
        leading = { key, count: entry.count, sample: entry.sample };
      } else if (!runnerUp || entry.count > runnerUp.count) {
        runnerUp = { key, count: entry.count, sample: entry.sample };
      }
    }

    return { leading, runnerUp };
  }
}
