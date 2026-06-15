export const ELEVATED_PLANS = ['pro', 'enterprise', 'beta'];

export interface IntelligenceUser {
  isSuperAdmin?: boolean;
  systemRole?: string;
}

/**
 * L'intelligence persistante (apprentissage + mémoire) est réservée aux plans élevés
 * ou aux administrateurs. Le plan free garde uniquement les suggestions de base.
 */
export function hasPersistentIntelligence(
  plan?: string | null,
  user?: IntelligenceUser | null,
): boolean {
  if (user?.isSuperAdmin) return true;
  if (user?.systemRole && ['admin', 'super_admin', 'moderator'].includes(user.systemRole)) {
    return true;
  }
  return !!plan && ELEVATED_PLANS.includes(plan);
}
