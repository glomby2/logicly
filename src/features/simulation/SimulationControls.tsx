import { Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { ru } from '@/i18n/ru';
import { FREQUENCY_PRESETS } from '@/store';
import { appStores, useSimulationStore } from '@/store/hooks';

const { simulationController: controller } = appStores;

/**
 * Управление симуляцией. Reset доступен всегда; Start, Pause, Step и частота —
 * только если в схеме есть элементы времени (`hasTimeElements`).
 */
export function SimulationControls() {
  const hasTimeElements = useSimulationStore((s) => s.hasTimeElements);
  const running = useSimulationStore((s) => s.running);
  const frequency = useSimulationStore((s) => s.frequency);
  const time = useSimulationStore((s) => s.time);

  return (
    <div className="flex items-center gap-1" data-testid="simulation-controls">
      {hasTimeElements && (
        <>
          {running ? (
            <IconButton label={ru.simulation.pause} icon={Pause} active onClick={() => controller.pause()} data-testid="sim-pause" />
          ) : (
            <IconButton label={ru.simulation.start} icon={Play} onClick={() => controller.start()} data-testid="sim-start" />
          )}
          <IconButton label={ru.simulation.step} icon={StepForward} onClick={() => controller.step()} data-testid="sim-step" />
          <select
            value={frequency}
            onChange={(e) => controller.setFrequency(Number(e.target.value))}
            aria-label={ru.simulation.frequency}
            title={ru.simulation.frequency}
            className="h-8 rounded-md border border-slate-700 bg-slate-900 px-1.5 text-xs text-slate-200"
            data-testid="sim-frequency"
          >
            {FREQUENCY_PRESETS.map((value) => (
              <option key={value} value={value}>
                {ru.simulation.hertz(value)}
              </option>
            ))}
          </select>
          <span className="hidden w-14 font-mono text-xs text-slate-400 lg:inline" data-testid="sim-time">
            {ru.simulation.time(time)}
          </span>
        </>
      )}
      <IconButton label={ru.simulation.reset} icon={RotateCcw} onClick={() => controller.reset()} data-testid="sim-reset" />
    </div>
  );
}
