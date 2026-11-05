import type { Signal } from '../../logic/signal';
import type { ElementDefinition, ElementPins } from '../../types/element';
import { indexedPins, inputPinId, outputPinId } from '../pins';

export type GateProps = { readonly inputCount: number };
export type NoProps = Readonly<Record<string, never>>;

export const MIN_GATE_INPUTS = 2;
export const MAX_GATE_INPUTS = 8;

const GATE_OUTPUTS = indexedPins(1, outputPinId);

interface GateConfig {
  readonly type: string;
  readonly description: string;
  readonly operation: (inputs: readonly Signal[]) => Signal;
}

/** Вентиль с настраиваемым числом входов (2–8) и одним выходом. */
export function defineGate({ type, description, operation }: GateConfig): ElementDefinition<GateProps> {
  return {
    type,
    label: type,
    description,
    category: 'gates',
    defaultProps: { inputCount: MIN_GATE_INPUTS },
    propSchema: [
      {
        key: 'inputCount',
        label: 'Количество входов',
        kind: 'integer',
        min: MIN_GATE_INPUTS,
        max: MAX_GATE_INPUTS,
      },
    ],
    pins: ({ inputCount }) => ({ inputs: indexedPins(inputCount, inputPinId), outputs: GATE_OUTPUTS }),
    evaluate: ({ inputs }) => ({ outputs: [operation(inputs)] }),
  };
}

interface UnaryGateConfig {
  readonly type: string;
  readonly description: string;
  readonly operation: (input: Signal) => Signal;
}

const UNARY_PINS: ElementPins = { inputs: indexedPins(1, inputPinId), outputs: GATE_OUTPUTS };

/** Вентиль с одним входом и одним выходом (NOT, BUFFER). */
export function defineUnaryGate({ type, description, operation }: UnaryGateConfig): ElementDefinition<NoProps> {
  return {
    type,
    label: type,
    description,
    category: 'gates',
    defaultProps: {},
    pins: () => UNARY_PINS,
    evaluate: ({ inputs }) => ({ outputs: [operation(inputs[0] ?? 0)] }),
  };
}
