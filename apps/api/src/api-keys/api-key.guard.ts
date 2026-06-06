import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
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
    req.apiKey = apiKey;
    req.organizationId = apiKey.organizationId;
    req.user = {
      id: apiKey.userId,
      userId: apiKey.userId,
      userOrganisations: [String(apiKey.organizationId)],
      systemRole: 'user',
      isSuperAdmin: false,
      apiKeyId: apiKey.id,
    };
    return true;
  }
}
