import { hasPersistentIntelligence } from './persistent-intelligence';

describe('hasPersistentIntelligence', () => {
  it('autorise les plans élevés', () => {
    expect(hasPersistentIntelligence('pro', null)).toBe(true);
    expect(hasPersistentIntelligence('enterprise', null)).toBe(true);
    expect(hasPersistentIntelligence('beta', null)).toBe(true);
  });

  it('refuse le plan free sans rôle admin', () => {
    expect(hasPersistentIntelligence('free', null)).toBe(false);
    expect(hasPersistentIntelligence('free', { systemRole: 'user' })).toBe(false);
    expect(hasPersistentIntelligence(undefined, undefined)).toBe(false);
  });

  it('autorise les admins quel que soit le plan', () => {
    expect(hasPersistentIntelligence('free', { isSuperAdmin: true })).toBe(true);
    expect(hasPersistentIntelligence('free', { systemRole: 'admin' })).toBe(true);
    expect(hasPersistentIntelligence('free', { systemRole: 'super_admin' })).toBe(true);
    expect(hasPersistentIntelligence('free', { systemRole: 'moderator' })).toBe(true);
  });
});
