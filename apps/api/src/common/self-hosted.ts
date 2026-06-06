export function isSelfHosted(): boolean {
  return ['true', '1', 'yes', 'on'].includes(
    String(process.env.SELF_HOSTED || '').trim().toLowerCase(),
  );
}

export const SELF_HOSTED_PLAN = 'selfhost' as const;
