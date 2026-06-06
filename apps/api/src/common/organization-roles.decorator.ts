import { SetMetadata } from '@nestjs/common';

export const ORGANIZATION_ROLES_KEY = 'organizationRoles';
export const OrganizationRoles = (...roles: string[]) =>
  SetMetadata(ORGANIZATION_ROLES_KEY, roles);
