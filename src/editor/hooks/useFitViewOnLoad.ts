import { useReactFlow } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import { appStores, useCircuitStore } from '@/store/hooks';
import { DEFAULT_VIEWPORT, FIT_VIEW_OPTIONS } from '../viewport';

/**
 * При смене документа (`documentVersion`: открытие файла, новая схема) вписывает схему в экран,
 * а пустую схему показывает в начальном виде. Обычные правки вид не меняют.
 */
export function useFitViewOnLoad() {
  const documentVersion = useCircuitStore((s) => s.documentVersion);
  const { fitView, setViewport } = useReactFlow();
  const initial = useRef(documentVersion);

  useEffect(() => {
    if (documentVersion === initial.current) return;
    // Эффект выполняется после того, как React Flow получил новые узлы; кадр — запас на их обработку.
    const frame = requestAnimationFrame(() => {
      if (appStores.circuit.getState().circuit.components.length === 0) void setViewport(DEFAULT_VIEWPORT);
      else void fitView(FIT_VIEW_OPTIONS);
    });
    return () => cancelAnimationFrame(frame);
  }, [documentVersion, fitView, setViewport]);
}
