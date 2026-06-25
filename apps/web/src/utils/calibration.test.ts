import { describe, it, expect } from 'vitest';
import { computeVfaMaxSpeed, applyVfaResult } from './calibration';

describe('computeVfaMaxSpeed', () => {
  it('applies start + step * (notch - 1)', () => {
    expect(computeVfaMaxSpeed({ startSpeed: 160, step: 20, notch: 11 })).toBe(360);
  });
  it('returns the start speed at notch 1', () => {
    expect(computeVfaMaxSpeed({ startSpeed: 160, step: 20, notch: 1 })).toBe(160);
  });
  it('rejects invalid input', () => {
    expect(computeVfaMaxSpeed({ startSpeed: null, step: 20, notch: 11 })).toBeNull();
    expect(computeVfaMaxSpeed({ startSpeed: 160, step: 0, notch: 11 })).toBeNull();
    expect(computeVfaMaxSpeed({ startSpeed: 160, step: 20, notch: 0 })).toBeNull();
  });
});

describe('applyVfaResult', () => {
  it('adds a new conditional rule for a new temperature and raises printSpeedMax', () => {
    const r = applyVfaResult({ vmax: 360, temp: 220, currentPrintSpeedMax: 300, currentRules: [] });
    expect(r.printSpeedMax).toBe(360);
    expect(r.replacedExistingTemp).toBe(false);
    expect(r.conditionalTemperatureRules).toEqual([
      { speedMinMmS: null, speedMaxMmS: 360, nozzleTempMin: 220, nozzleTempMax: 220 },
    ]);
  });
  it('replaces speedMaxMmS when a rule already exists for that temperature', () => {
    const r = applyVfaResult({
      vmax: 420, temp: 220, currentPrintSpeedMax: 360,
      currentRules: [{ speedMinMmS: null, speedMaxMmS: 360, nozzleTempMin: 220, nozzleTempMax: 220 }],
    });
    expect(r.replacedExistingTemp).toBe(true);
    expect(r.conditionalTemperatureRules).toHaveLength(1);
    expect(r.conditionalTemperatureRules[0].speedMaxMmS).toBe(420);
  });
  it('keeps the higher printSpeedMax when current is already higher', () => {
    const r = applyVfaResult({ vmax: 300, temp: 240, currentPrintSpeedMax: 420, currentRules: [] });
    expect(r.printSpeedMax).toBe(420);
  });
});
