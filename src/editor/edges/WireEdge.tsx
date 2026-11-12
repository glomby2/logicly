import { BaseEdge, getSmoothStepPath, useInternalNode, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import type { WireEdge } from '../adapters/flowMapping';
import { usePinSignal } from '../hooks/useSignals';
import { SIGNAL_COLORS, signalTone } from '../signalStyle';
import { selfLoopPath } from './wirePath';

/** Провод: цвет по сигналу на выходе-источнике, X — предупреждающий пунктир. */
export const WireEdgeView = memo(function WireEdgeView(props: EdgeProps<WireEdge>) {
  const { id, source, target, sourceHandleId, selected, sourceX, sourceY, targetX, targetY } = props;
  const signal = usePinSignal(source, sourceHandleId ?? '');
  const tone = signalTone(signal);
  const sourceNode = useInternalNode(source);

  const path =
    source === target && sourceNode
      ? selfLoopPath(sourceX, sourceY, targetX, targetY, sourceNode.internals.positionAbsolute.y)
      : getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition: props.sourcePosition,
          targetX,
          targetY,
          targetPosition: props.targetPosition,
          borderRadius: 6,
          offset: 12,
        })[0];

  return (
    <>
      {selected && <BaseEdge path={path} style={{ stroke: '#38bdf8', strokeWidth: 7, strokeOpacity: 0.35 }} />}
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={16}
        style={{
          stroke: SIGNAL_COLORS[tone],
          strokeWidth: tone === 'high' ? 3 : 2,
          strokeDasharray: tone === 'unknown' ? '6 4' : undefined,
        }}
        data-testid={`wire-${id}`}
        data-signal={String(signal)}
      />
    </>
  );
});
