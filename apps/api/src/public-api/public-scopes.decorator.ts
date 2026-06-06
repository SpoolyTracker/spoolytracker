import { SetMetadata } from '@nestjs/common';

export const PUBLIC_SCOPES_KEY = 'publicApiScopes';

export const PublicScopes = (...scopes: string[]) =>
  SetMetadata(PUBLIC_SCOPES_KEY, scopes);
