import { BOX_WIDTH } from '../layout/geometry';

/*
 * Функциональные блоки (IEEE Std 91: прямоугольник с названием) — DECODER, ENCODER,
 * PRIORITY ENCODER. Реестр по типу элемента, как у вентилей и MUX: вид узла `block`
 * и ширина корпуса. Ширина задаётся явно, потому что геометрия детерминирована
 * и не может измерять текст: название должно помещаться в полосу в одну строку.
 */

export interface BlockSymbol {
  readonly width: number;
}

export const BLOCK_SYMBOLS: ReadonlyMap<string, BlockSymbol> = new Map([
  ['DECODER', { width: BOX_WIDTH }],
  ['ENCODER', { width: BOX_WIDTH }],
  // 120 вмещает название в Segoe UI с запасом всего ≈ 3,5 px, а шрифт системный (system-ui):
  // на других ОС он шире. 140 — запас ≈ 24 px.
  ['PRIORITY_ENCODER', { width: 140 }],
]);

/** Ширина блока по типу; `undefined` — тип не блок. */
export function blockWidth(type: string): number | undefined {
  return BLOCK_SYMBOLS.get(type)?.width;
}
