import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SYSTEM_ROLES_KEY } from './system-roles.decorator';

@Injectable()
export class SystemRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      SYSTEM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // Super Admin always allowed
    if (user.systemRole === 'super_admin' || user.isSuperAdmin === true)
      return true;

    return requiredRoles.includes(user.systemRole);
  }
}
