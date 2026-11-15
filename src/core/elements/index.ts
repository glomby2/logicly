import type { ElementDefinition } from '../types/element';
import { DEMUX } from './combinational/demux';
import { MUX } from './combinational/mux';
import { AND } from './gates/and';
import { BUFFER } from './gates/buffer';
import { NAND } from './gates/nand';
import { NOR } from './gates/nor';
import { NOT } from './gates/not';
import { OR } from './gates/or';
import { XNOR } from './gates/xnor';
import { XOR } from './gates/xor';
import { INPUT } from './io/input';
import { OUTPUT } from './io/output';
import { ElementRegistry } from './registry';

/** Встроенные элементы в порядке отображения в палитре. Новый элемент добавляется сюда. */
export const BUILTIN_ELEMENTS: readonly ElementDefinition[] = [
  INPUT,
  OUTPUT,
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
];

export function createDefaultRegistry(): ElementRegistry {
  return new ElementRegistry(BUILTIN_ELEMENTS);
}

export { AND, BUFFER, DEMUX, INPUT, MUX, NAND, NOR, NOT, OR, OUTPUT, XNOR, XOR };
export {
  channelCount,
  channelMatch,
  MAX_SELECT_BITS,
  MIN_SELECT_BITS,
  readAddress,
  SELECT_BITS_SPEC,
} from './combinational/select';
export type { SelectAddress, SelectProps } from './combinational/select';
export { ElementRegistry } from './registry';
export { resolveProps } from './props';
export { indexedPins, inputPinId, outputPinId } from './pins';
export { defineGate, defineUnaryGate, MAX_GATE_INPUTS, MIN_GATE_INPUTS } from './gates/gate';
export type { GateProps, NoProps } from './gates/gate';
export type { InputProps } from './io/input';
