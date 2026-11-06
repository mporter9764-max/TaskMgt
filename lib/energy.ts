/*
 * TDEE model
 * ----------
 * TDEE = RMR + daily living + steps + lifting + thermic effect of food (TEF)
 *
 * - RMR: measured value (user setting).
 * - Daily living: non-step activity (standing, fidgeting, posture) as a % of RMR. Default 5%,
 *   calibrated so a low-step day (about 3,000 steps) lands near the standard "sedentary" 1.2 x RMR.
 * - Steps: net walking cost above rest, about 0.5 kcal per kg of body weight per km walked
 *   (ACSM walking equation at ~3 mph), with step length estimated as 0.415 x height.
 * - Lifting: flat net amount when a session is logged.
 * - TEF: share of eaten calories spent digesting food, from the macro mix
 *   (protein 25%, carbs 7.5%, fat 2%). Assumes eating at roughly maintenance, so
 *   TEF = rate x TDEE and TDEE = (everything else) / (1 - rate).
 */

export interface EnergySettings {
  weightLb: number;
  heightIn: number;
  rmr: number;
  liftKcal: number;
  proteinPct: number;
  carbPct: number;
  fatPct: number;
  livingPct: number;
}

export const DEFAULT_SETTINGS: EnergySettings = {
  weightLb: 208,
  heightIn: 70,
  rmr: 1900,
  liftKcal: 75,
  proteinPct: 30,
  carbPct: 40,
  fatPct: 30,
  livingPct: 5,
};

export interface EnergyLog {
  log_date: string;
  steps: number;
  lifted: boolean;
}

export interface Breakdown {
  rmr: number;
  living: number;
  steps: number;
  lifting: number;
  tef: number;
  tdee: number;
}

const NET_WALK_KCAL_PER_KG_KM = 0.5;
const TEF_PROTEIN = 0.25;
const TEF_CARB = 0.075;
const TEF_FAT = 0.02;

export function kcalPerStep(s: EnergySettings): number {
  const kg = s.weightLb * 0.45359237;
  const strideKm = (0.415 * s.heightIn * 0.0254) / 1000;
  return NET_WALK_KCAL_PER_KG_KM * kg * strideKm;
}

export function tefRate(s: EnergySettings): number {
  const total = s.proteinPct + s.carbPct + s.fatPct || 100;
  return (s.proteinPct * TEF_PROTEIN + s.carbPct * TEF_CARB + s.fatPct * TEF_FAT) / total;
}

export function computeTdee(steps: number, lifted: boolean, s: EnergySettings): Breakdown {
  const rmr = s.rmr;
  const living = (rmr * s.livingPct) / 100;
  const stepK = Math.max(0, steps) * kcalPerStep(s);
  const lifting = lifted ? s.liftKcal : 0;
  const base = rmr + living + stepK + lifting;
  const rate = Math.min(0.3, Math.max(0, tefRate(s)));
  const tdee = base / (1 - rate);
  return { rmr, living, steps: stepK, lifting, tef: tdee - base, tdee };
}

export function round(n: number): number {
  return Math.round(n);
}

export function fmtKcal(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
