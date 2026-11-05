import type { ElementDefinition } from '../types/element';

/** Реестр типов элементов. Порядок регистрации сохраняется (используется палитрой). */
export class ElementRegistry {
  private readonly definitions = new Map<string, ElementDefinition>();

  constructor(definitions: Iterable<ElementDefinition> = []) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  register(definition: ElementDefinition): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Элемент "${definition.type}" уже зарегистрирован`);
    }
    this.definitions.set(definition.type, definition);
  }

  has(type: string): boolean {
    return this.definitions.has(type);
  }

  get(type: string): ElementDefinition | undefined {
    return this.definitions.get(type);
  }

  require(type: string): ElementDefinition {
    const definition = this.definitions.get(type);
    if (!definition) {
      throw new Error(`Неизвестный тип элемента "${type}"`);
    }
    return definition;
  }

  list(): readonly ElementDefinition[] {
    return [...this.definitions.values()];
  }
}
