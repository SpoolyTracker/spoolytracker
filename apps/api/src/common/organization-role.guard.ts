import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserOrganization } from '../organization/user-organization.entity';
import { ORGANIZATION_ROLES_KEY } from './organization-roles.decorator';

@Injectable()
export class OrganizationRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const organizationId = req.organizationId; // Must be set by OrganizationGuard or similar

    if (!user) return false;

    // System Admin / Moderator bypass
    const isBypass =
      user.isSuperAdmin === true ||
      ['super_admin', 'admin', 'moderator'].includes(user.systemRole || '');
    if (isBypass) {
      return true;
    }

    if (!organizationId) {
      // If no organization context, we can't check organization roles.
      // This might happen if the endpoint doesn't require OrganizationGuard but has Role check?
      // Safe default: deny if roles are required but no org context.
      return false;
    }

    // Fetch user role in this organization
    const userOrg = await this.userOrganizationRepository.findOne({
      where: {
        userId: user.userId || user.id, // JWT payload usually has userId, User entity has id
        organizationId: +organizationId,
      },
    });

    if (!userOrg) {
      return false;
    }

    // Check if role matches
    const hasRole = requiredRoles.includes(userOrg.role);

    // Also allow OWNER validation if 'admin' is required?
    // Hierarchy: Owner > Admin > Member
    // If we require 'admin', 'owner' should implicitly pass?
    // Usually safer to be explicit in the decorator: @OrganizationRoles('owner', 'admin')
    // But for convenience, we can implement hierarchy here.
    // Let's stick to EXPLICIT roles for now to match SystemRoleGuard,
    // OR implement hierarchy. User feedback: Owner can do everything.
    // So if role is 'owner', they should likely pass any check for 'admin' or 'member'.

    if (userOrg.role === 'owner') return true;
    if (userOrg.role === 'admin' && requiredRoles.includes('admin'))
      return true; // Admin passes Admin check
    // If required is 'member', Admin/Owner should pass? Usually yes.
    // Let's implement hierarchy logic:

    // Hierarchy def:
    // Member: base
    // Admin: includes Member
    // Owner: includes Admin, Member

    const hierarchy = {
      owner: 3,
      admin: 2,
      member: 1,
    };

    // Find minimum required level
    // If multiple roles are passed, e.g. ['admin', 'moderator'], it usually means "One of these".
    // But with hierarchy, if we ask for 'admin', we imply >= Admin.

    const userLevel = hierarchy[userOrg.role] || 0;

    // Check if user satisfies ANY of the required roles via hierarchy or exact match
    // Actually, decorators usually list ALLOWED roles.
    // IF we say @OrganizationRoles('admin'), does it mean ONLY admin? Or Admin+?
    // Standard RBAC usually means "has this role". Hierarchy is often custom.
    // Given I will annotate precisely, explicit is safer for now, BUT `Owner` should always bypass.

    // Implemented: Explicit match OR Owner override (already handled above)
    // Wait, I handled "userOrg.role === 'owner' return true". So Owner passes EVERYTHING.
    // That satisfies the "Owner can do everything" requirement.

    // For 'admin' attempting to do 'member' actions?
    // If an endpoint is @OrganizationRoles('member'), can an Admin do it?
    // Ideally yes.

    // Let's stick to: Owner > Admin > Member
    if (requiredRoles.includes('member')) {
      if (userLevel >= hierarchy['member']) return true;
    }
    if (requiredRoles.includes('admin')) {
      if (userLevel >= hierarchy['admin']) return true;
    }

    // Fallback to exact match (though hierarchy covers most)
    if (requiredRoles.includes(userOrg.role)) return true;

    throw new ForbiddenException(
      `Insufficient permissions in this organization (Org: ${organizationId}, Role: ${userOrg?.role || 'none'}, Required: ${requiredRoles.join(',')})`,
    );
  }
}
