import { z } from "zod";
import { Pipeline } from "./pipeline";
import { Step } from "./step";
import type {
  ConsensusStrategy,
  EventEmitter,
  PipelineEvent,
  PipelineTransition,
  RedFlagRule,
  StepConfig,
  StepEvent,
  VoteTally,
} from "./types";

const forge = {
  step: <Input, Output>(config: StepConfig<Input, Output>) => new Step(config),
  pipeline: <State>() => new Pipeline<State>(),
  z,
};

export {
  forge,
  Pipeline,
  Step,
  z,
  type ConsensusStrategy,
  type EventEmitter,
  type PipelineEvent,
  type PipelineTransition,
  type RedFlagRule,
  type StepConfig,
  type StepEvent,
  type VoteTally,
};
