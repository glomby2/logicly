import { Handle } from '@xyflow/react';
import { memo, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { handlePosition } from '../adapters/flowMapping';
import { useIsFloating, usePinConnectState, usePinSignal } from '../hooks/useSignals';
import type { ElementGeometry, PinGeometry } from '../layout/geometry';
import { signalColor } from '../signalStyle';

const PinHandle = memo(function PinHandle({ nodeId, pin }: { nodeId: string; pin: PinGeometry }) {
  const signal = usePinSignal(nodeId, pin.id);
  const floating = useIsFloating(nodeId, pin.id);
  const connect = usePinConnectState(nodeId, pin.id);
  const color = signalColor(signal);

  const placement: CSSProperties =
    pin.side === 'left' || pin.side === 'right' ? { top: pin.y } : { left: pin.x };
  const style: CSSProperties = {
    ...placement,
    // Неподключённый вход — полый кружок.
    background: floating ? 'transparent' : color,
    borderColor: floating ? '#94a3b8' : color,
  };

  return (
    <Handle
      id={pin.id}
      type={pin.direction === 'input' ? 'target' : 'source'}
      position={handlePosition(pin)}
      style={style}
      className={cn(
        'pin-handle',
        connect === 'valid' && 'pin-handle--valid',
        connect === 'invalid' && 'pin-handle--invalid',
        connect === 'source' && 'pin-handle--source',
      )}
      title={pin.label}
      data-testid={`pin-${nodeId}-${pin.id}`}
      data-signal={String(signal)}
      data-floating={floating || undefined}
      data-connect={connect ?? undefined}
    />
  );
});

/** Все пины узла по его геометрии. */
export function PinHandles({ nodeId, geometry }: { nodeId: string; geometry: ElementGeometry }) {
  return geometry.pins.map((pin) => <PinHandle key={pin.id} nodeId={nodeId} pin={pin} />);
}
