import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { expandsLegacyScope } from '../api-keys/api-key-scopes';

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<any>();
    const rawKey =
      req.headers['x-api-key'] ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (Array.isArray(rawKey)) {
      throw new UnauthorizedException('Invalid API key header');
    }

    const apiKey = await this.apiKeysService.validate(rawKey);
    req.publicApi = {
      apiKeyId: apiKey.id,
      tokenName: apiKey.name,
      organizationId: apiKey.organizationId,
      userId: apiKey.userId,
      scopes: expandsLegacyScope(apiKey.scope, apiKey.scopes),
    };
    req.organizationId = apiKey.organizationId;

    return true;
  }
}
