/**
 * P = P_max × max(0, C_selected/C_total - I_selected/I_total)
 * I_total = 0 → penalty = 0. C_total = 0 → 0 điểm.
 */
export function scoreMultipleChoiceRewardPenalty(
  pMax: number,
  cTotal: number,
  iTotal: number,
  cSelected: number,
  iSelected: number
): number {
  if (pMax <= 0 || cTotal <= 0) return 0;
  const reward = cSelected / cTotal;
  const penalty = iTotal > 0 ? iSelected / iTotal : 0;
  const raw = Math.max(0, reward - penalty);
  return Math.round(pMax * raw * 100) / 100;
}
