import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserOrganization } from '../organization/user-organization.entity';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & {
        organizationId?: number;
        user?: any;
      }
    >();

    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // 1️⃣ System Admin / Moderator → bypass total
    let organizationId = req.organizationId;
    const headerOrganizationId = req.headers['x-organization-id'];
    if (!organizationId && headerOrganizationId) {
      const headerId = parseInt(
        Array.isArray(headerOrganizationId)
          ? headerOrganizationId[0]
          : headerOrganizationId,
        10,
      );
      if (!isNaN(headerId)) {
        organizationId = headerId;
        (req as any).organizationId = organizationId;
      }
    }

    const isBypass =
      user.isSuperAdmin === true ||
      ['super_admin', 'admin', 'moderator'].includes(user.systemRole || '');
    if (isBypass) {
      return true;
    }

    // 2️⃣ Organization must be resolved
    // Fallback: Check params (e.g. /organizations/:id)
    if (!organizationId && req.params && req.params.id) {
      organizationId = parseInt(req.params.id, 10);
      if (!isNaN(organizationId)) {
        (req as any).organizationId = organizationId;
      }
    }

    // Fallback: Check query (e.g. ?organizationId=2)
    if (!organizationId && req.query && req.query.organizationId) {
      const queryId = parseInt(req.query.organizationId as string, 10);
      if (!isNaN(queryId)) {
        organizationId = queryId;
        (req as any).organizationId = organizationId;
      }
    }

    if (!organizationId) {
      throw new UnauthorizedException('Organization not specified');
    }

    // 3️⃣ Organizations from token
    const userOrganisationsRaw = user.userOrganisations;
    // Note: userOrganisationsRaw might be empty string or undefined if user has no orgs in token.
    // If empty, we must check DB.

    let userOrganisations: string[] = [];
    if (userOrganisationsRaw) {
      userOrganisations = Array.isArray(userOrganisationsRaw)
        ? userOrganisationsRaw.map(String)
        : String(userOrganisationsRaw)
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean);
    }

    // 4️⃣ Authorization check
    let allowed = userOrganisations.includes(String(organizationId));

    // Check DB if token check failed (Stale token fix)
    if (!allowed) {
      const count = await this.userOrganizationRepository.count({
        where: {
          userId: user.userId, // JWT payload has userId
          organizationId: +organizationId,
        },
      });
      if (count > 0) {
        allowed = true;
      }
    }

    if (!allowed) {
      throw new UnauthorizedException(
        `Access denied for organization ${organizationId}`,
      );
    }

    return true;
  }
}
