import type { ElementCategory } from '@/core/types/element';

/** Строки интерфейса. Названия логических элементов (AND, OR, …) сюда не входят — они международные. */
export const ru = {
  app: {
    title: 'Логический симулятор',
    subtitle: 'Редактор и симулятор цифровых логических схем',
  },
  categories: {
    io: 'Ввод и вывод',
    gates: 'Логические вентили',
    combinational: 'Комбинационные схемы',
    sequential: 'Триггеры и память',
  } satisfies Record<ElementCategory, string>,
  palette: {
    title: 'Элементы',
    hint: 'Перетащите элемент на поле или нажмите, чтобы добавить в центр',
  },
  toolbar: {
    undo: 'Отменить',
    redo: 'Повторить',
    copy: 'Копировать',
    paste: 'Вставить',
    delete: 'Удалить выделенное',
    clear: 'Очистить схему (можно отменить)',
    togglePalette: 'Показать или скрыть палитру',
  },
  zoom: {
    zoomIn: 'Увеличить',
    zoomOut: 'Уменьшить',
    fitView: 'Вписать схему в экран',
  },
  menu: {
    paste: 'Вставить',
    selectAll: 'Выделить всё',
    fitView: 'Вписать в экран',
    copy: 'Копировать',
    cut: 'Вырезать',
    duplicate: 'Дублировать',
    delete: 'Удалить',
    deleteWire: 'Удалить провод',
    toggle: 'Переключить',
    rename: 'Переименовать',
    renamePlaceholder: 'Подпись',
  },
  node: {
    toggleInput: 'Переключить вход',
  },
  status: {
    components: 'Элементов',
    wires: 'Проводов',
    stable: 'Схема устойчива',
    oscillation: 'Колебания',
    unknown: (count: number) => `Неопределённых сигналов (X): ${count}`,
    floating: (count: number) => `Неподключённых входов: ${count}`,
    empty: 'Перетащите элементы из палитры на поле',
  },
} as const;
