import type { Circuit, CircuitComponent, ElementProps, PinRef, Wire } from '../types/circuit';
import {
  CURRENT_VERSION,
  FILE_FORMAT,
  normalizeDocumentName,
  type CircuitFileV1,
  type FileComponentV1,
  type FilePinRefV1,
  type FileWireV1,
} from './format';

const pinRef = (ref: PinRef): FilePinRefV1 => ({ componentId: ref.componentId, pinId: ref.pinId });

/** Ключи свойств упорядочены, чтобы одинаковая схема всегда давала одинаковый текст. */
function sortedProps(props: ElementProps): FileComponentV1['props'] {
  return Object.fromEntries(Object.keys(props).sort().map((key) => [key, props[key]!]));
}

function component(c: CircuitComponent): FileComponentV1 {
  return {
    id: c.id,
    type: c.type,
    position: { x: c.position.x, y: c.position.y },
    ...(c.label ? { label: c.label } : {}),
    props: sortedProps(c.props),
  };
}

const wire = (w: Wire): FileWireV1 => ({ id: w.id, from: pinRef(w.from), to: pinRef(w.to) });

/** Документ текущей версии формата. Поля перечислены явно — лишнее в файл не попадает. */
export function toCircuitFile(circuit: Circuit, name: string): CircuitFileV1 {
  return {
    format: FILE_FORMAT,
    version: CURRENT_VERSION,
    name: normalizeDocumentName(name),
    components: circuit.components.map(component),
    wires: circuit.wires.map(wire),
  };
}

/** Текст файла: детерминированный JSON с отступом 2 и переводом строки в конце. */
export function serializeCircuit(circuit: Circuit, name: string): string {
  return `${JSON.stringify(toCircuitFile(circuit, name), null, 2)}\n`;
}
