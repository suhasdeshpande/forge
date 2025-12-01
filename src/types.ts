import { ZodType } from "zod";

export type RedFlagRule<Output> = {
  description: string;
  test: (sample: Output) => boolean;
};

export type ConsensusStrategy = {
  /** Number of samples to collect before voting. */
  initialSamples: number;
  /** How far ahead a candidate must be to be selected early. */
  k?: number;
  /** Optional hard cap to avoid runaway sampling. */
  maxSamples?: number;
};

export interface StepConfig<Input, Output> {
  name: string;
  input: ZodType<Input>;
  output: ZodType<Output>;
  prompt?: (input: Input) => string;
  strategy?: ConsensusStrategy;
  handler: (input: Input) => Promise<Output> | Output;
  redFlags?: RedFlagRule<Output>[];
}

export type StepEvent<Output> =
  | { type: "step_start" }
  | { type: "prompt"; prompt: string }
  | { type: "invalid_sample"; index: number; reason: string }
  | { type: "sample"; sample: Output; index: number }
  | { type: "red_flag"; rule: string; index: number }
  | { type: "vote_update"; tally: Map<string, number>; index: number }
  | { type: "step_decided"; output: Output; samples: Output[] };

export interface PipelineTransition<State, Output> {
  /**
   * Map the current pipeline state to the input the step requires.
   */
  input: (state: State) => unknown;
  /**
   * Apply the step output to the current state to derive the next state.
   */
  apply: (state: State, output: Output) => State;
  /** Optional guard to control whether the step runs. */
  condition?: (state: State) => boolean;
}

export type PipelineEvent<State> =
  | { type: "pipeline_start"; state: State }
  | { type: "step_start"; step: string; state: State }
  | { type: "step_event"; step: string; event: StepEvent<unknown> }
  | { type: "step_end"; step: string; state: State }
  | { type: "pipeline_end"; state: State };

export type EventEmitter<Event> = (event: Event) => void;

export type VoteTally<Output> = Map<string, { count: number; sample: Output }>;
