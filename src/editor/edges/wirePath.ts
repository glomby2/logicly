/** Отступ петли от выхода, от входа и от верхнего края элемента, px. */
export const SELF_LOOP_MARGIN = 14;

/**
 * Путь провода, соединяющего выход элемента с его же входом: ортогональная петля над элементом,
 * чтобы провод не проходил через символ.
 */
export function selfLoopPath(sourceX: number, sourceY: number, targetX: number, targetY: number, nodeTop: number) {
  const top = nodeTop - SELF_LOOP_MARGIN;
  const right = sourceX + SELF_LOOP_MARGIN;
  const left = targetX - SELF_LOOP_MARGIN;
  return `M ${sourceX} ${sourceY} H ${right} V ${top} H ${left} V ${targetY} H ${targetX}`;
}
