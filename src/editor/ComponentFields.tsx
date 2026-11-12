import { findComponent } from '@/core/circuit';
import type { PropSpec } from '@/core/types/element';
import { PropField } from '@/components/ui/PropField';
import { TextField } from '@/components/ui/TextField';
import { ru } from '@/i18n/ru';
import { appStores, useCircuitStore } from '@/store/hooks';

/** Редактор свойства элемента, связанный с circuitStore. Используется инспектором и контекстным меню. */
export function ComponentPropField({
  componentId,
  spec,
  className,
}: {
  componentId: string;
  spec: PropSpec;
  className?: string;
}) {
  const value = useCircuitStore((s) => findComponent(s.circuit, componentId)?.props[spec.key]);
  return (
    <PropField
      spec={spec}
      value={value}
      className={className}
      onChange={(next) => appStores.circuit.getState().updateProps(componentId, { [spec.key]: next })}
    />
  );
}

/** Поле подписи элемента: применяется по Enter или при уходе из поля — одним шагом истории. */
export function ComponentLabelField({
  componentId,
  autoFocus,
  onFinish,
  testId,
}: {
  componentId: string;
  autoFocus?: boolean;
  onFinish?: () => void;
  testId?: string;
}) {
  const label = useCircuitStore((s) => findComponent(s.circuit, componentId)?.label ?? '');
  return (
    <TextField
      // Новый черновик для другого элемента или после внешнего изменения подписи (undo).
      key={`${componentId}:${label}`}
      value={label}
      autoFocus={autoFocus}
      onCommit={(next) => appStores.circuit.getState().renameComponent(componentId, next)}
      onFinish={onFinish}
      placeholder={ru.menu.renamePlaceholder}
      maxLength={24}
      aria-label={ru.menu.rename}
      data-testid={testId}
    />
  );
}
