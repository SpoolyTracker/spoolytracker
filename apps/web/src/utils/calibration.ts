import type { ConditionalTemperatureRule } from '../api';

export function computeVfaMaxSpeed(input: {
  startSpeed: number | null;
  step: number | null;
  notch: number | null;
}): number | null {
  const { startSpeed, step, notch } = input;
  if (startSpeed === null || step === null || notch === null) return null;
  if (step <= 0 || notch < 1) return null;
  return Math.round(startSpeed + step * (notch - 1));
}

export function applyVfaResult(input: {
  vmax: number;
  temp: number;
  currentPrintSpeedMax: number | null;
  currentRules: ConditionalTemperatureRule[];
}): {
  printSpeedMax: number;
  conditionalTemperatureRules: ConditionalTemperatureRule[];
  replacedExistingTemp: boolean;
} {
  const { vmax, temp, currentPrintSpeedMax, currentRules } = input;
  const rules = currentRules.map((r) => ({ ...r }));
  const idx = rules.findIndex(
    (r) => r.nozzleTempMin === temp && r.nozzleTempMax === temp,
  );
  const replacedExistingTemp = idx >= 0;
  if (idx >= 0) {
    rules[idx] = { ...rules[idx], speedMaxMmS: vmax };
  } else {
    rules.push({ speedMinMmS: null, speedMaxMmS: vmax, nozzleTempMin: temp, nozzleTempMax: temp });
  }
  const printSpeedMax = Math.max(currentPrintSpeedMax ?? 0, vmax);
  return { printSpeedMax, conditionalTemperatureRules: rules, replacedExistingTemp };
}
