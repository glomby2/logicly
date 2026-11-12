import { useConnection } from '@xyflow/react';
import type { Signal } from '@/core/logic/signal';
import type { PinRef } from '@/core/types/circuit';
import { selectIsFloating, selectPinSignal } from '@/store';
import { appStores, useCircuitStore, useSimulationStore } from '@/store/hooks';
import { canConnect } from '../connectionRules';

/** Сигнал пина из simulationStore. Компонент перерисовывается только при изменении этого значения. */
export function usePinSignal(componentId: string, pinId: string): Signal {
  return useSimulationStore((state) => selectPinSignal(state, { componentId, pinId }));
}

export function useIsFloating(componentId: string, pinId: string): boolean {
  return useSimulationStore((state) => selectIsFloating(state, { componentId, pinId }));
}

export type PinConnectState = 'source' | 'valid' | 'invalid';

const SEPARATOR = '\u0000';

/** Роль пина во время протягивания провода; `null`, если провод не протягивается. */
export function usePinConnectState(componentId: string, pinId: string): PinConnectState | null {
  // Строковый ключ не меняется во время протягивания — пин не перерисовывается на каждое движение мыши.
  const from = useConnection((c) => (c.inProgress ? `${c.fromHandle.nodeId}${SEPARATOR}${c.fromHandle.id ?? ''}` : null));
  return useCircuitStore((state) => {
    if (from === null) return null;
    const [fromComponent = '', fromPin = ''] = from.split(SEPARATOR);
    if (fromComponent === componentId && fromPin === pinId) return 'source';
    const source: PinRef = { componentId: fromComponent, pinId: fromPin };
    return canConnect(state.circuit, appStores.registry, source, { componentId, pinId }) ? 'valid' : 'invalid';
  });
}
