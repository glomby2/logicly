import { ru } from '@/i18n/ru';
import type { PinEndpoint } from './inspectorModel';

/** «AND #1 · Вход 2» — элемент и пин для показа в инспекторе. */
export function endpointText(endpoint: PinEndpoint): string {
  const pin =
    endpoint.pinLabel ??
    (endpoint.direction === 'input' ? ru.inspector.input(endpoint.index) : ru.inspector.output(endpoint.index));
  return `${endpoint.componentName} · ${pin}`;
}
