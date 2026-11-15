import { samePinLayout } from '../circuit/pins';
import { resolveProps } from '../elements/props';
import { join } from '../logic/ops';
import { UNKNOWN, type Signal } from '../logic/signal';
import type { ComponentId, ElementProps, PinRef } from '../types/circuit';
import type { EvalResult } from '../types/element';
import { netIdOf, type NetId, type Netlist } from './netlist';
import { RankQueue } from './rankQueue';

export type SettleStatus = 'stable' | 'oscillation';

export interface SettleResult {
  /** `oscillation` — найдены колеблющиеся элементы, их выходы и зависимые от них сети получили X. */
  readonly status: SettleStatus;
  readonly evaluations: number;
  /** Все сети со значением X после расчёта. */
  readonly unknownNets: readonly NetId[];
}

/** Снимок состояния симуляции — для переноса в движок перекомпилированной схемы. */
export interface EngineState {
  readonly time: number;
  readonly nets: Readonly<Record<NetId, Signal>>;
  readonly componentStates: Readonly<Record<ComponentId, unknown>>;
}

export interface EngineOptions {
  readonly initialState?: EngineState;
  /**
   * Сколько раз элемент может быть вычислен за один `settle()`, прежде чем
   * будет признан колеблющимся. По умолчанию 64.
   */
  readonly oscillationThreshold?: number;
}

const DEFAULT_OSCILLATION_THRESHOLD = 64;

type OutputUpdate = (current: Signal, computed: Signal) => Signal;

const assign: OutputUpdate = (_, computed) => computed;
/** Уточняются только неопределённые значения. */
const refine: OutputUpdate = (current, computed) => (current === UNKNOWN ? computed : current);

/**
 * Событийный движок симуляции без задержек.
 *
 * `settle()` выполняет релаксацию: элементы берутся из очереди по рангу;
 * изменение сети ставит в очередь её читателей. Устойчивые петли (защёлки
 * на вентилях) сходятся к неподвижной точке.
 *
 * **Дельта-циклы.** Комбинационные элементы (без `initialState`) обновляют выходы сразу.
 * Элементы с состоянием (триггеры, защёлки, генераторы) обновляют состояние сразу,
 * а выходы публикуют на границе дельта-цикла — когда очередь опустела. Поэтому все
 * триггеры, сработавшие от одного фронта, захватывают данные из состояния до фронта,
 * а результат не зависит от порядка их вычисления.
 *
 * **Включение.** Сети равны 0, состояния — `initialState`, а выходы элементов с состоянием
 * сразу равны вычисленным из начального состояния (Q̄ = 1 до первого расчёта): иначе
 * переход 0 → 1 при включении выглядел бы как фронт. То же для элемента, добавленного
 * при перекомпиляции (его состояния нет в переносимом снимке).
 *
 * Элемент, вычисленный за один расчёт больше `oscillationThreshold` раз, признаётся
 * колеблющимся: его выходы до конца расчёта обновляются через `join` (могут только
 * перейти в X), а состояние замораживается. Колебание гаснет в X, остальная схема
 * продолжает обычную релаксацию — порог локален, поэтому генератор не отнимает
 * вычисления у независимых защёлок. Затем фаза уточнения заменяет X вычисленными
 * значениями там, где они однозначны.
 *
 * Расчёт конечен при любых `evaluate`: непомеченный элемент вычисляется не более
 * `oscillationThreshold` раз (отложенные выходы публикуются только после вычисления,
 * поэтому каждая публикация тоже ограничена порогом), помеченный меняет выходы не более
 * одного раза (в X, сразу, без откладывания), а при уточнении каждая сеть меняется не более
 * одного раза (из X).
 *
 * Мутирующие методы (`reset`, `setProps`) только планируют пересчёт — его выполняет `settle()`.
 */
export class SimulationEngine {
  readonly netlist: Netlist;
  private readonly values: Signal[];
  private readonly states: unknown[];
  private readonly props: ElementProps[];
  private readonly queue: RankQueue;
  private readonly threshold: number;
  private readonly evaluationCounts: Uint32Array;
  private readonly oscillating: Uint8Array;
  private readonly tickers: readonly number[];
  /** Элементы с состоянием: выходы публикуются на границе дельта-цикла. */
  private readonly deferred: Uint8Array;
  /** Отложенные выходы текущего дельта-цикла. */
  private readonly pending = new Map<number, readonly Signal[]>();
  private currentTime = 0;

  constructor(netlist: Netlist, options: EngineOptions = {}) {
    const { components } = netlist;
    this.netlist = netlist;
    this.values = new Array<Signal>(netlist.netIds.length).fill(0);
    this.props = components.map((c) => c.props);
    this.states = components.map((c) => c.definition.initialState?.(c.props));
    this.queue = new RankQueue(components.map((c) => c.rank));
    this.threshold = options.oscillationThreshold ?? DEFAULT_OSCILLATION_THRESHOLD;
    this.evaluationCounts = new Uint32Array(components.length);
    this.oscillating = new Uint8Array(components.length);
    this.tickers = components.filter((c) => c.definition.onTick).map((c) => c.index);
    this.deferred = Uint8Array.from(components, (c) => (c.definition.initialState ? 1 : 0));

    const restored = options.initialState ? this.restore(options.initialState) : new Set<number>();
    this.presetStatefulOutputs(restored);
    this.scheduleAll();
  }

  get time(): number {
    return this.currentTime;
  }

  /**
   * Состояние при включении: сети 0, начальные состояния элементов, выходы элементов
   * с состоянием — из начального состояния, время 0.
   */
  reset(): void {
    this.values.fill(0);
    this.netlist.components.forEach((c, i) => (this.states[i] = c.definition.initialState?.(this.props[i]!)));
    this.currentTime = 0;
    this.queue.clear();
    this.pending.clear();
    this.presetStatefulOutputs(new Set());
    this.scheduleAll();
  }

  /**
   * Меняет свойства элемента без перекомпиляции (например, значение INPUT).
   * Если меняется набор пинов, схему нужно перекомпилировать.
   */
  setProps(componentId: ComponentId, props: ElementProps): void {
    const index = this.requireIndex(componentId);
    const component = this.netlist.components[index]!;
    const resolved = resolveProps(component.definition, props);
    const pins = component.definition.pins(resolved);
    if (!samePinLayout(pins, { inputs: component.inputPins, outputs: component.outputPins })) {
      throw new Error(`Изменение пинов элемента "${componentId}" требует перекомпиляции схемы`);
    }
    this.props[index] = resolved;
    this.queue.push(index);
  }

  getProps(componentId: ComponentId): ElementProps {
    return this.props[this.requireIndex(componentId)]!;
  }

  settle(): SettleResult {
    this.evaluationCounts.fill(0);
    this.oscillating.fill(0);
    let evaluations = 0;
    let oscillation = false;

    while (this.queue.size > 0 || this.pending.size > 0) {
      while (this.queue.size > 0) {
        const index = this.queue.pop();
        evaluations++;
        if (!this.oscillating[index] && ++this.evaluationCounts[index]! > this.threshold) {
          this.oscillating[index] = 1;
          oscillation = true;
        }
        const result = this.evaluate(index);
        if (this.oscillating[index]) {
          // Колеблющийся элемент гасится сразу: выход может только перейти в X.
          this.pending.delete(index);
          this.applyOutputs(index, result.outputs, join);
        } else {
          if (result.state !== undefined) this.states[index] = result.state;
          if (this.deferred[index]) this.pending.set(index, result.outputs);
          else this.applyOutputs(index, result.outputs, assign);
        }
      }
      this.publishPending();
    }

    if (oscillation) evaluations += this.refineUnknown();
    return this.result(oscillation ? 'oscillation' : 'stable', evaluations);
  }

  /** Шаг времени: `onTick` у элементов, зависящих от времени (CLOCK), затем `settle()`. */
  tick(): SettleResult {
    this.currentTime++;
    for (const index of this.tickers) {
      const component = this.netlist.components[index]!;
      const next = component.definition.onTick!({
        props: this.props[index]!,
        state: this.states[index],
        time: this.currentTime,
      });
      if (next !== this.states[index]) {
        this.states[index] = next;
        this.queue.push(index);
      }
    }
    return this.settle();
  }

  getNetValue(netId: NetId): Signal | undefined {
    const net = this.netlist.netIndex.get(netId);
    return net === undefined ? undefined : this.values[net];
  }

  /** Значение пина. Неподключённый вход равен 0; несуществующий пин — `undefined`. */
  getPinValue(ref: PinRef): Signal | undefined {
    const index = this.netlist.componentIndex.get(ref.componentId);
    if (index === undefined) return undefined;
    const component = this.netlist.components[index]!;

    const outputIndex = component.outputPins.findIndex((pin) => pin.id === ref.pinId);
    if (outputIndex >= 0) return this.values[component.outputNets[outputIndex]!];

    const inputIndex = component.inputPins.findIndex((pin) => pin.id === ref.pinId);
    if (inputIndex < 0) return undefined;
    const net = component.inputNets[inputIndex];
    return net === null || net === undefined ? 0 : this.values[net];
  }

  /**
   * Значения всех пинов, ключ — `componentId:pinId` (формат `netIdOf`).
   * Для выходов совпадает с сетью, для входов — значение питающей сети или 0.
   */
  getPinSignals(): Record<string, Signal> {
    const signals: Record<string, Signal> = {};
    for (const component of this.netlist.components) {
      const key = (pinId: string) => netIdOf({ componentId: component.id, pinId });
      component.inputPins.forEach((pin, i) => {
        const net = component.inputNets[i];
        signals[key(pin.id)] = net === null || net === undefined ? 0 : this.values[net]!;
      });
      component.outputPins.forEach((pin, i) => {
        signals[key(pin.id)] = this.values[component.outputNets[i]!]!;
      });
    }
    return signals;
  }

  getSignals(): Record<NetId, Signal> {
    return Object.fromEntries(this.netlist.netIds.map((id, i) => [id, this.values[i]!]));
  }

  exportState(): EngineState {
    const componentStates: Record<ComponentId, unknown> = {};
    this.netlist.components.forEach((c, i) => {
      if (this.states[i] !== undefined) componentStates[c.id] = this.states[i];
    });
    return { time: this.currentTime, nets: this.getSignals(), componentStates };
  }

  /** Переносит снимок. Возвращает индексы элементов, чьё состояние было в снимке. */
  private restore(state: EngineState): Set<number> {
    const restored = new Set<number>();
    this.netlist.netIds.forEach((id, i) => {
      const value = state.nets[id];
      if (value !== undefined) this.values[i] = value;
    });
    this.netlist.components.forEach((c, i) => {
      if (!(c.id in state.componentStates)) return;
      this.states[i] = state.componentStates[c.id];
      restored.add(i);
    });
    this.currentTime = state.time;
    return restored;
  }

  /**
   * Выходы элементов с состоянием, кроме перенесённых из снимка, сразу получают значения,
   * вычисленные из текущего (начального) состояния. Новое состояние из этого вычисления
   * не сохраняется — его учтёт первый расчёт.
   */
  private presetStatefulOutputs(skip: ReadonlySet<number>): void {
    this.netlist.components.forEach((component, index) => {
      if (!this.deferred[index] || skip.has(index)) return;
      this.evaluate(index).outputs.forEach((value, i) => (this.values[component.outputNets[i]!] = value));
    });
  }

  /** Граница дельта-цикла: публикует отложенные выходы элементов с состоянием. */
  private publishPending(): void {
    if (this.pending.size === 0) return;
    const batch = [...this.pending];
    this.pending.clear();
    for (const [index, outputs] of batch) this.applyOutputs(index, outputs, assign);
  }

  private scheduleAll(): void {
    for (let i = 0; i < this.netlist.components.length; i++) this.queue.push(i);
  }

  private requireIndex(componentId: ComponentId): number {
    const index = this.netlist.componentIndex.get(componentId);
    if (index === undefined) throw new Error(`Элемент "${componentId}" отсутствует в схеме`);
    return index;
  }

  private evaluate(index: number): EvalResult<unknown> {
    const component = this.netlist.components[index]!;
    const inputs = component.inputNets.map((net) => (net === null ? 0 : this.values[net]!));
    const result = component.definition.evaluate({ inputs, props: this.props[index]!, state: this.states[index] });
    if (result.outputs.length !== component.outputNets.length) {
      throw new Error(
        `Элемент ${component.type} вернул ${result.outputs.length} выходов вместо ${component.outputNets.length}`,
      );
    }
    return result;
  }

  private applyOutputs(index: number, outputs: readonly Signal[], update: OutputUpdate): void {
    const nets = this.netlist.components[index]!.outputNets;
    nets.forEach((net, i) => {
      const next = update(this.values[net]!, outputs[i]!);
      if (next === this.values[net]) return;
      this.values[net] = next;
      for (const reader of this.netlist.netReaders[net]!) this.queue.push(reader);
    });
  }

  /**
   * Уточнение после погашенного колебания. После релаксации каждая сеть либо равна
   * вычисленному значению, либо равна X, поэтому для монотонных `evaluate` замена X
   * вычисленными значениями лишь сужает неопределённость. Состояние элементов не меняется.
   * Возвращает число вычислений.
   */
  private refineUnknown(): number {
    let evaluations = 0;
    this.scheduleAll();
    while (this.queue.size > 0) {
      const index = this.queue.pop();
      evaluations++;
      this.applyOutputs(index, this.evaluate(index).outputs, refine);
    }
    return evaluations;
  }

  private result(status: SettleStatus, evaluations: number): SettleResult {
    const unknownNets = this.netlist.netIds.filter((_, i) => this.values[i] === UNKNOWN);
    return { status, evaluations, unknownNets };
  }
}
