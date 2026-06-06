import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_SCOPES_KEY } from './public-scopes.decorator';

@Injectable()
export class PublicScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(PUBLIC_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (!requiredScopes.length) return true;

    const req = context.switchToHttp().getRequest<any>();
    const grantedScopes = req.publicApi?.scopes || [];
    const allowed = requiredScopes.every((scope) =>
      this.hasScope(grantedScopes, scope),
    );

    if (!allowed) {
      throw new ForbiddenException('API key is missing required scope');
    }

    return true;
  }

  private hasScope(grantedScopes: string[], requiredScope: string): boolean {
    return grantedScopes.some((scope) => {
      if (scope === requiredScope) return true;
      if (!scope.endsWith(':*')) return false;
      return requiredScope.startsWith(scope.slice(0, -1));
    });
  }
}
