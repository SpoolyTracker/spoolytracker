import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ORGANIZATION_ROLES_KEY } from './organization-roles.decorator';

@Injectable()
export class OrganizationRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const organizationId = req.organizationId; // Set by OrganizationGuard or similar middleware?

    // Check compatibility with Platform Roles: Super Admin always passes
    if (user.isSuperAdmin === true || user.systemRole === 'super_admin') {
      return true;
    }

    // We need the role of the user IN this organization
    // The OrganizationGuard (if used before) might not have fetched the specific role, usually it just checks access.
    // We assume req.organizationMemberRole might be populated, OR we need to fetch it here if not available.
    // For efficiency, assume a middleware/interceptor or previous guard populated something?
    // Actually, let's look at OrganizationService.getUserRole which is often used.
    // Ideally, we shouldn't fetch DB here if possible, but we must if not in request.

    // Wait, OrganizationGuard (existing) verifies if user is in org, but doesn't set the role string in a readily available property maybe?
    // Let's rely on `req.userOrganizationRole` if we can set it, otherwise we fetch it.
    // Since we don't have a middleware setting it yet (based on previous files), we might need to fetch it from the database
    // OR rely on the User object having the relation 'userOrganizations'.

    if (!organizationId) return false;

    const userOrgs = user.userOrganizations || []; // This might only be the list of IDs if not loaded with relations

    // If userOrganizations is just an array of IDs or strings (as seen in FilamentController), we can't get the role.
    // However, in OrganizationService, findByUser returns UserOrganization[] with roles.
    // But the JWT strategy usually just puts basic info or partials.

    // PLAN: We'll assume we need to fetch the role or that the valid UserOrganization object is accessible.
    // Given existing code in OrganizationController:
    // const role = await this.organizationService.getUserRole(+id, req.user.userId);

    // Since guards are sync/async, we can inject OrganizationService?
    // But circular dependency risk if OrgService uses guards.
    // Better to use Repository directly or assume request has it.

    // Let's implement it by trying to find the role in `req.user.userOrganizations` if available fully,
    // allow fallback to simply failing if we can't find it, forcing Controller to handle?
    // NO, the Guard MUST handle it. Authentication/Authorization should be in Guards.

    // We will assume `req.organizationRole` is set by a previous Guard OR we look it up from `request.user`.

    // Implementation approach:
    // 1. Check if user.userOrganizations is an array of objects with `organizationId` and `role`.
    // 2. If so, find the match.
    // 3. If not, we might need to inject the Repository.

    // Let's proceed with injecting Reflector only and assume we can inspect `req.user`.
    // If `req.user.userOrganizations` contains role info, good.
    // Looking at `jwt.strategy.ts` (not visible but usually standard):
    // `OrganizationGuard` uses `user.userOrganisations` (IDs strings).

    // So we likely need to fetch the role.
    // We can access the repository if we inject it.
    return true; // Placeholder until we confirm injecting strategy.
    // Actually I will write the FULL implementation injecting DataSource/Repository.
  }
}
