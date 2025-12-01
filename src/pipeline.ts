import { Step } from "./step";
import { EventEmitter, PipelineEvent, PipelineTransition, StepEvent } from "./types";

export class Pipeline<State> {
  private readonly steps: Array<{
    name: string;
    step: Step<any, any>;
    transition: PipelineTransition<State, any>;
  }> = [];

  step<Input, Output>(
    step: Step<Input, Output>,
    transition: PipelineTransition<State, Output>
  ): Pipeline<State> {
    this.steps.push({ name: step.name, step, transition });
    return this;
  }

  async run(
    initialState: State,
    emit?: EventEmitter<PipelineEvent<State>>
  ): Promise<State> {
    let state = initialState;
    emit?.({ type: "pipeline_start", state });

    for (const { name, step, transition } of this.steps) {
      if (transition.condition && !transition.condition(state)) {
        continue;
      }

      emit?.({ type: "step_start", step: name, state });

      const onStepEvent: EventEmitter<StepEvent<unknown>> = (event) => {
        emit?.({ type: "step_event", step: name, event });
      };

      const input = transition.input(state);
      const { output } = await step.execute(input, onStepEvent);
      state = transition.apply(state, output);
      emit?.({ type: "step_end", step: name, state });
    }

    emit?.({ type: "pipeline_end", state });
    return state;
  }
}
