import { CircuitBuilder } from './circuitBuilder';

/*
 * Эталонные схемы для тестов движка.
 */

/** Полусумматор: S = A ⊕ B, C = A·B. */
export function halfAdder() {
  return new CircuitBuilder()
    .input('A')
    .input('B')
    .gate('X', 'XOR')
    .gate('C', 'AND')
    .wire('A', 'X.in0')
    .wire('B', 'X.in1')
    .wire('A', 'C.in0')
    .wire('B', 'C.in1')
    .output('SUM')
    .output('CARRY')
    .wire('X', 'SUM')
    .wire('C', 'CARRY');
}

/** Добавляет полный сумматор с префиксом `p`. Возвращает id элементов суммы и переноса. */
export function addFullAdder(b: CircuitBuilder, p: string, a: string, bIn: string, cin: string) {
  b.gate(`${p}x1`, 'XOR')
    .gate(`${p}s`, 'XOR')
    .gate(`${p}a1`, 'AND')
    .gate(`${p}a2`, 'AND')
    .gate(`${p}co`, 'OR')
    .wire(a, `${p}x1.in0`)
    .wire(bIn, `${p}x1.in1`)
    .wire(`${p}x1`, `${p}s.in0`)
    .wire(cin, `${p}s.in1`)
    .wire(a, `${p}a1.in0`)
    .wire(bIn, `${p}a1.in1`)
    .wire(`${p}x1`, `${p}a2.in0`)
    .wire(cin, `${p}a2.in1`)
    .wire(`${p}a1`, `${p}co.in0`)
    .wire(`${p}a2`, `${p}co.in1`);
  return { sum: `${p}s`, carry: `${p}co` };
}

/** n-разрядный сумматор с последовательным переносом. Входы A0.., B0.., CIN; выходы S0.., COUT. */
export function rippleCarryAdder(bits: number) {
  const b = new CircuitBuilder().input('CIN');
  let carry = 'CIN';
  for (let i = 0; i < bits; i++) {
    b.input(`A${i}`).input(`B${i}`);
    const fa = addFullAdder(b, `fa${i}_`, `A${i}`, `B${i}`, carry);
    b.output(`S${i}`).wire(fa.sum, `S${i}`);
    carry = fa.carry;
  }
  return b.output('COUT').wire(carry, 'COUT');
}

/** RS-защёлка на NOR: Q = NOR(R, Q̄), Q̄ = NOR(S, Q). Активный уровень входов — 1. */
export function norLatch() {
  return new CircuitBuilder()
    .input('S')
    .input('R')
    .gate('Q', 'NOR')
    .gate('QN', 'NOR')
    .wire('R', 'Q.in0')
    .wire('QN', 'Q.in1')
    .wire('S', 'QN.in0')
    .wire('Q', 'QN.in1');
}

/** RS-защёлка на NAND: Q = NAND(S̄, Q̄), Q̄ = NAND(R̄, Q). Активный уровень входов — 0. */
export function nandLatch() {
  return new CircuitBuilder()
    .input('SN')
    .input('RN')
    .gate('Q', 'NAND')
    .gate('QN', 'NAND')
    .wire('SN', 'Q.in0')
    .wire('QN', 'Q.in1')
    .wire('RN', 'QN.in0')
    .wire('Q', 'QN.in1');
}

/** D-защёлка на NAND: при E = 1 Q повторяет D, при E = 0 хранит значение. */
export function nandDLatch() {
  return new CircuitBuilder()
    .input('D')
    .input('E')
    .gate('ND', 'NOT')
    .gate('GS', 'NAND')
    .gate('GR', 'NAND')
    .gate('Q', 'NAND')
    .gate('QN', 'NAND')
    .wire('D', 'ND')
    .wire('D', 'GS.in0')
    .wire('E', 'GS.in1')
    .wire('ND', 'GR.in0')
    .wire('E', 'GR.in1')
    .wire('GS', 'Q.in0')
    .wire('QN', 'Q.in1')
    .wire('GR', 'QN.in0')
    .wire('Q', 'QN.in1');
}

/**
 * D-защёлка на мультиплексоре: Q = D·E + Q·Ē (+ D·Q).
 * Согласующий терм D·Q устраняет статический риск при спаде E. Без него схема
 * в реальном железе может потерять состояние или колебаться — исход зависит от задержек.
 */
export function muxDLatch({ consensus = true } = {}) {
  const b = new CircuitBuilder()
    .input('D')
    .input('E')
    .gate('NE', 'NOT')
    .gate('A1', 'AND')
    .gate('A2', 'AND')
    .gate('Q', 'OR', consensus ? 3 : 2)
    .wire('E', 'NE')
    .wire('D', 'A1.in0')
    .wire('E', 'A1.in1')
    .wire('Q', 'A2.in0')
    .wire('NE', 'A2.in1')
    .wire('A1', 'Q.in0')
    .wire('A2', 'Q.in1');
  if (consensus) {
    b.gate('A3', 'AND').wire('D', 'A3.in0').wire('Q', 'A3.in1').wire('A3', 'Q.in2');
  }
  return b;
}

/** Кольцо из `n` инверторов N0 → N1 → … → N0. Нечётное n — генератор, чётное — защёлка. */
export function inverterRing(n: number, b = new CircuitBuilder()) {
  for (let i = 0; i < n; i++) b.gate(`N${i}`, 'NOT');
  for (let i = 0; i < n; i++) b.wire(`N${i}`, `N${(i + 1) % n}`);
  return b;
}

/** Кольцевой генератор с разрешением: G = NAND(EN, N1), N0 = NOT(G), N1 = NOT(N0). При EN = 1 колеблется. */
export function enabledRingOscillator(b = new CircuitBuilder()) {
  return b
    .input('EN')
    .gate('G', 'NAND')
    .gate('N0', 'NOT')
    .gate('N1', 'NOT')
    .wire('EN', 'G.in0')
    .wire('N1', 'G.in1')
    .wire('G', 'N0')
    .wire('N0', 'N1');
}
