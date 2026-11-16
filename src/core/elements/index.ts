import type { ElementDefinition } from '../types/element';
import { DECODER } from './combinational/decoder';
import { DEMUX } from './combinational/demux';
import { ENCODER } from './combinational/encoder';
import { MUX } from './combinational/mux';
import { PRIORITY_ENCODER } from './combinational/priorityEncoder';
import { AND } from './gates/and';
import { BUFFER } from './gates/buffer';
import { NAND } from './gates/nand';
import { NOR } from './gates/nor';
import { NOT } from './gates/not';
import { OR } from './gates/or';
import { XNOR } from './gates/xnor';
import { XOR } from './gates/xor';
import { D_FLIP_FLOP } from './sequential/dFlipFlop';
import { D_LATCH } from './sequential/dLatch';
import { JK_FLIP_FLOP } from './sequential/jkFlipFlop';
import { T_FLIP_FLOP } from './sequential/tFlipFlop';
import { CLOCK } from './io/clock';
import { CONSTANT } from './io/constant';
import { INPUT } from './io/input';
import { OUTPUT } from './io/output';
import { ElementRegistry } from './registry';

/** Встроенные элементы в порядке отображения в палитре. Новый элемент добавляется сюда. */
export const BUILTIN_ELEMENTS: readonly ElementDefinition[] = [
  INPUT,
  OUTPUT,
  CLOCK,
  CONSTANT,
  AND,
  OR,
  NOT,
  BUFFER,
  NAND,
  NOR,
  XOR,
  XNOR,
  MUX,
  DEMUX,
  DECODER,
  ENCODER,
  PRIORITY_ENCODER,
  D_LATCH,
  D_FLIP_FLOP,
  T_FLIP_FLOP,
  JK_FLIP_FLOP,
];

export function createDefaultRegistry(): ElementRegistry {
  return new ElementRegistry(BUILTIN_ELEMENTS);
}

export { AND, BUFFER, CLOCK, DEMUX, INPUT, MUX, NAND, NOR, NOT, OR, OUTPUT, XNOR, XOR };
export { MAX_HALF_PERIOD, MIN_HALF_PERIOD } from './io/clock';
export type { ClockProps, ClockState } from './io/clock';
export { CONSTANT } from './io/constant';
export type { ConstantProps } from './io/constant';
export {
  channelCount,
  channelMatch,
  MAX_SELECT_BITS,
  MIN_SELECT_BITS,
  readAddress,
  SELECT_BITS_SPEC,
} from './combinational/select';
export type { SelectAddress, SelectProps } from './combinational/select';
export { DECODER, ENCODER, PRIORITY_ENCODER };
export { CODE_BITS_SPEC, codePins, MAX_CODE_BITS, MIN_CODE_BITS } from './combinational/code';
export type { CodeProps } from './combinational/code';
export { D_FLIP_FLOP, D_LATCH, JK_FLIP_FLOP, T_FLIP_FLOP };
export { jkNext } from './sequential/jkFlipFlop';
export type { LatchState } from './sequential/dLatch';
export { clockEdge, clockedValue, rememberClock } from './sequential/edge';
export type { ClockEdge, ClockMemory } from './sequential/edge';
export { CLOCK_PIN, defineFlipFlop, LATCH_OUTPUTS } from './sequential/flipFlop';
export type { FlipFlopState } from './sequential/flipFlop';
export { ElementRegistry } from './registry';
export { resolveProps } from './props';
export { switchProp } from './port';
export { indexedPins, inputPinId, outputPinId } from './pins';
export { defineGate, defineUnaryGate, MAX_GATE_INPUTS, MIN_GATE_INPUTS } from './gates/gate';
export type { GateProps, NoProps } from './gates/gate';
export type { InputProps } from './io/input';
