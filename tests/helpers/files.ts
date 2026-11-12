import { insertFragment } from '@/core/circuit';
import type { ElementRegistry } from '@/core/elements';
import { EMPTY_CIRCUIT, type Circuit } from '@/core/types/circuit';

/** Схема в том виде, в каком её хранит редактор: свойства нормализованы, недопустимые провода удалены. */
export function normalized(circuit: Circuit, registry: ElementRegistry): Circuit {
  return insertFragment(EMPTY_CIRCUIT, registry, circuit);
}

/** Корректный документ версии 1 для проверки ошибок: тесты меняют в нём отдельные поля. */
export function validDocument(): Record<string, unknown> {
  return {
    format: 'logic-sim',
    version: 1,
    name: 'Тест',
    components: [
      { id: 'a', type: 'INPUT', position: { x: 0, y: 0 }, label: 'X1', props: { value: true } },
      { id: 'g', type: 'AND', position: { x: 100, y: 0 }, props: { inputCount: 2 } },
      { id: 'y', type: 'OUTPUT', position: { x: 200, y: 0 }, props: {} },
    ],
    wires: [
      { id: 'w1', from: { componentId: 'a', pinId: 'out0' }, to: { componentId: 'g', pinId: 'in0' } },
      { id: 'w2', from: { componentId: 'g', pinId: 'out0' }, to: { componentId: 'y', pinId: 'in0' } },
    ],
  };
}

export const toText = (document: unknown) => JSON.stringify(document);
