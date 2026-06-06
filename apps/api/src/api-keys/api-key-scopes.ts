export const PUBLIC_API_SCOPES = [
  'filaments:read',
  'filaments:write',
  'stock:read',
  'stock:write',
  'consumption:read',
  'consumption:write',
  'analytics:read',
  'projects:read',
  'projects:write',
  'gcode:inspect',
] as const;

export type PublicApiScope = (typeof PUBLIC_API_SCOPES)[number];

export const DEFAULT_PUBLIC_API_SCOPES: PublicApiScope[] = [
  'filaments:read',
  'stock:read',
  'consumption:read',
];

export const ORCA_LEGACY_SCOPES: PublicApiScope[] = [
  'gcode:inspect',
  'consumption:write',
];

export function normalizeScopes(scopes?: string[]): PublicApiScope[] {
  const unique = new Set<string>();
  for (const scope of scopes || DEFAULT_PUBLIC_API_SCOPES) {
    const cleaned = String(scope || '').trim();
    if (PUBLIC_API_SCOPES.includes(cleaned as PublicApiScope)) {
      unique.add(cleaned);
    }
  }
  return Array.from(unique) as PublicApiScope[];
}

export function expandsLegacyScope(scope?: string, scopes?: string[]): string[] {
  if (scopes?.length) return scopes;
  if (scope === 'orca') return ORCA_LEGACY_SCOPES;
  return [];
}
