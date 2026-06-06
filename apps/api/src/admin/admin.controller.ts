import {
  Controller,
  Get,
  UseGuards,
  Param,
  Put,
  Patch,
  Body,
  Delete,
  Post,
  Query,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemRoleGuard } from '../common/system-role.guard';
import { SystemRoles } from '../common/system-roles.decorator';
import { OrganizationService } from '../organization/organization.service';
import { FilamentService } from '../filament/filament.service';
import { AuthService } from '../auth/auth.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { Organization } from '../organization/organization.entity';
import { UserOrganization } from '../organization/user-organization.entity';
import { Subscription } from '../stripe/subscription.entity';
import { AdminAuditService, AuditLogFilters } from './admin-audit.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
@SystemRoles('super_admin')
export class AdminController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly filamentService: FilamentService,
    private readonly authService: AuthService,
    private readonly auditService: AdminAuditService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
  ) {}

  // --- Audit Log Endpoints ---

  @Get('audit-logs')
  @SystemRoles('super_admin')
  async getAuditLogs(@Query() filters: AuditLogFilters) {
    return this.auditService.findAll(filters);
  }

  @Get('audit-logs/stats')
  @SystemRoles('super_admin')
  async getAuditLogStats() {
    return this.auditService.getStats();
  }

  // Get all organizations (Admin + Moderator)
  @Get('organizations')
  @SystemRoles('admin', 'moderator')
  async getAllOrganizations() {
    const orgs = await this.organizationRepository
      .createQueryBuilder('org')
      .loadRelationCountAndMap('org.userCount', 'org.userOrganizations')
      .orderBy('org.name', 'ASC')
      .getMany();
    return orgs;
  }

  // Create Organization (Admin only)
  @Post('organizations')
  @SystemRoles('admin')
  async createOrganization(
    @Request() req: any,
    @Body() body: { name: string; ownerId?: number; reason?: string },
  ) {
    if (!body.name) throw new Error('Name is required');

    const savedOrg = await this.organizationService.create(
      body.name,
      body.ownerId,
    );

    await this.auditService.log({
      action: 'ORG_CREATE',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'organization',
      targetId: savedOrg.id,
      targetLabel: savedOrg.name,
      reason: body.reason,
      ipAddress: req.ip,
    });

    return savedOrg;
  }

  // Get all users (Admin + Moderator)
  @Get('users')
  @SystemRoles('admin', 'moderator')
  async getAllUsers() {
    return this.userRepository.find({
      select: [
        'id',
        'username',
        'email',
        'firstName',
        'lastName',
        'isSuperAdmin',
        'systemRole',
        'isActive',
        'isEmailVerified',
        'introSeen',
        'createdAt',
        'lastLoginAt',
        'googleId',
        'appleId',
      ],
      relations: [
        'userOrganizations',
        'userOrganizations.organization',
        'pushTokens',
      ],
    });
  }

  // Get users of an organization (Admin + Moderator)
  @Get('organizations/:id/users')
  @SystemRoles('admin', 'moderator')
  async getOrganizationUsers(@Param('id') id: string) {
    const userOrgs = await this.userOrganizationRepository.find({
      where: { organizationId: +id },
      relations: ['user'],
      order: { joinedAt: 'DESC' },
    });

    return userOrgs.map((uo) => ({
      id: uo.user.id,
      username: uo.user.username,
      email: uo.user.email,
      firstName: uo.user.firstName,
      lastName: uo.user.lastName,
      role: uo.role,
      joinedAt: uo.joinedAt,
    }));
  }

  // Export users with organization details (Admin + Super Admin only)
  @Get('users/export')
  @SystemRoles('super_admin', 'admin')
  async exportUsers(@Request() req: any, @Query('plan') plan?: string) {
    const query = this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.userOrganizations', 'uo')
      .innerJoin('uo.organization', 'org')
      .select([
        'org.id as idorga',
        'org.name as orga',
        'org.plan as plan',
        'user.id as iduser',
        'user.lastName as nom',
        'user.firstName as prenom',
        'user.username as username',
        'user.email as email',
      ]);

    if (plan) {
      const plans = plan.split(',').map((p) => p.trim());
      if (plans.length > 1) {
        query.andWhere('org.plan IN (:...plans)', { plans });
      } else {
        query.andWhere('org.plan = :plan', { plan: plans[0] });
      }
    }

    const data = await query.getRawMany();

    await this.auditService.log({
      action: 'USER_EXPORT',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'user',
      reason: `Exportation des utilisateurs${plan ? ` (Plan: ${plan})` : ''}`,
      metadata: { plan, count: data.length },
      ipAddress: req.ip,
    });

    return data;
  }

  // Add member to organization (Admin only)
  @Post('organizations/:id/members')
  @SystemRoles('admin')
  async addMemberToOrganization(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      userId: number;
      role?: 'owner' | 'admin' | 'member';
      reason?: string;
    },
  ) {
    const orgId = +id;
    const userId = body.userId;
    const role = body.role || 'member';

    // Check if already a member
    const existing = await this.userOrganizationRepository.findOne({
      where: { userId, organizationId: orgId },
    });

    if (existing) {
      throw new BadRequestException(
        'User is already a member of this organization',
      );
    }

    const userOrg = this.userOrganizationRepository.create({
      userId,
      organizationId: orgId,
      role,
      joinedAt: new Date(),
      hasConfirmed: true, // Direct admin addition is auto-confirmed
    });

    const saved = await this.userOrganizationRepository.save(userOrg);
    const targetUser = await this.userRepository.findOneBy({ id: userId });
    const org = await this.organizationRepository.findOneBy({ id: orgId });

    await this.auditService.log({
      action: 'MEMBER_ADD',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'user',
      targetId: userId,
      targetLabel: targetUser?.username,
      reason: body.reason,
      metadata: { organizationId: orgId, organizationName: org?.name, role },
      ipAddress: req.ip,
    });

    return saved;
  }

  // Get organization details (Admin + Moderator)
  @Get('organizations/:id')
  @SystemRoles('admin', 'moderator')
  async getOrganization(@Param('id') id: string) {
    return this.organizationRepository.findOne({
      where: { id: +id },
      relations: ['filaments'],
    });
  }

  // Update organization plan (Admin only)
  @Put('organizations/:id/plan')
  @SystemRoles('admin')
  async updateOrganizationPlan(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      plan: 'free' | 'pro' | 'enterprise' | 'beta';
      endDate?: string;
      reason?: string;
    },
  ) {
    const org = await this.organizationRepository.findOneBy({ id: +id });
    const result = await this.organizationService.updatePlan(
      +id,
      body.plan,
      body.endDate,
    );

    await this.auditService.log({
      action: 'ORG_PLAN_CHANGE',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'organization',
      targetId: +id,
      targetLabel: org?.name,
      reason: body.reason,
      metadata: {
        newPlan: body.plan,
        endDate: body.endDate,
        oldPlan: org?.plan,
      },
      ipAddress: req.ip,
    });

    return result;
  }

  // Force update member role (Super Admin only)
  @Put('organizations/:id/members/:userId/role')
  @SystemRoles('super_admin') // Only super admin can force any role
  async updateMemberRoleForce(
    @Request() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { role: 'owner' | 'admin' | 'member'; reason?: string },
  ) {
    const targetUser = await this.userRepository.findOneBy({ id: +userId });
    const result = await this.organizationService.forceUpdateMemberRole(
      +id,
      +userId,
      body.role,
    );

    await this.auditService.log({
      action: 'MEMBER_ROLE_CHANGE',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'user',
      targetId: +userId,
      targetLabel: targetUser?.username,
      reason: body.reason,
      metadata: { organizationId: +id, newRole: body.role },
      ipAddress: req.ip,
    });

    return result;
  }

  // Delete organization
  @Delete('organizations/:id')
  async deleteOrganization(
    @Request() req: any,
    @Param('id') id: string,
    @Query('transferToOrgId') transferToOrgId?: number,
    @Body() body?: { reason?: string },
  ) {
    const orgId = +id;
    const org = await this.organizationRepository.findOneBy({ id: orgId });
    const reason = body?.reason;

    // If transfer requested, move all filaments to target organization
    if (transferToOrgId) {
      const transferred =
        await this.filamentService.transferFilamentsToOrganization(
          orgId,
          +transferToOrgId,
        );
      console.log(
        `Transferred ${transferred} filaments from org ${orgId} to org ${transferToOrgId}`,
      );
    }

    // Delete all user-organization relationships
    await this.userOrganizationRepository.delete({ organizationId: orgId });

    // Delete organization (CASCADE will delete remaining filaments if no transfer)
    await this.organizationRepository.delete(orgId);

    await this.auditService.log({
      action: 'ORG_DELETE',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'organization',
      targetId: orgId,
      targetLabel: org?.name,
      reason: reason,
      metadata: { transferred: !!transferToOrgId, transferToOrgId },
      ipAddress: req.ip,
    });

    return {
      message: 'Organization deleted successfully',
      transferred: transferToOrgId ? true : false,
    };
  }

  // Clear Stripe Data (manually reset to free and clear IDs)
  @Post('organizations/:id/clear-stripe')
  @SystemRoles('admin')
  async clearOrganizationStripeData(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const org = await this.organizationRepository.findOneBy({ id: +id });
    await this.organizationService.processDowngrade(+id);

    await this.auditService.log({
      action: 'ORG_STRIPE_CLEAR',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'organization',
      targetId: +id,
      targetLabel: org?.name,
      reason: body?.reason,
      ipAddress: req.ip,
    });

    return { message: 'Organization Stripe data cleared successfully' };
  }

  // Create User
  @Post('users')
  @SystemRoles('admin')
  async createUser(@Request() req: any, @Body() body: any) {
    // Basic validation
    if (!body.username || !body.password) {
      throw new Error('Username and password are required');
    }

    const actingUser = req.user;
    const isSuperAdminActor =
      actingUser.isSuperAdmin || actingUser.systemRole === 'super_admin';

    // Determine system role
    let systemRole = body.systemRole || 'user';
    let isSuperAdmin = body.isSuperAdmin || false;

    // Restriction: Non-SuperAdmin cannot create Admin or SuperAdmin
    if (!isSuperAdminActor) {
      if (
        systemRole === 'admin' ||
        systemRole === 'super_admin' ||
        isSuperAdmin
      ) {
        throw new ForbiddenException(
          'You generally do not have permission to assign High Privilege roles',
        );
      }
    }

    // Sync flags
    if (systemRole === 'super_admin') isSuperAdmin = true;
    if (isSuperAdmin) systemRole = 'super_admin';

    const hashedPassword = await bcrypt.hash(body.password, 10);
    const user = this.userRepository.create({
      username: body.username,
      password: hashedPassword,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      isSuperAdmin: isSuperAdmin,
      systemRole: systemRole,
      isActive: body.isActive !== undefined ? body.isActive : true,
    });

    const savedUser = await this.userRepository.save(user);

    // Handle Organization Assignment
    if (body.organizationId) {
      const orgId = +body.organizationId;
      const count = await this.userOrganizationRepository.count({
        where: { organizationId: orgId },
      });

      const userOrg = this.userOrganizationRepository.create({
        userId: savedUser.id,
        organizationId: orgId,
        role: count === 0 ? 'owner' : 'member',
        joinedAt: new Date(),
      });
      await this.userOrganizationRepository.save(userOrg);
    }

    await this.auditService.log({
      action: 'USER_CREATE',
      performedBy: { id: actingUser.id, username: actingUser.username },
      targetType: 'user',
      targetId: savedUser.id,
      targetLabel: savedUser.username,
      reason: body.reason,
      metadata: {
        systemRole,
        isSuperAdmin,
        organizationId: body.organizationId,
      },
      ipAddress: req.ip,
    });

    const { password, ...result } = savedUser;
    return result;
  }

  // Update User
  @Put('users/:id')
  @SystemRoles('admin')
  async updateUser(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const actingUser = req.user;
    const isSuperAdminActor =
      actingUser.isSuperAdmin || actingUser.systemRole === 'super_admin';

    const user = await this.userRepository.findOne({ where: { id: +id } });
    if (!user) throw new Error('User not found');

    // Restriction: Non-SuperAdmin cannot update Admin or SuperAdmin
    if (!isSuperAdminActor) {
      if (
        user.systemRole === 'admin' ||
        user.systemRole === 'super_admin' ||
        user.isSuperAdmin
      ) {
        throw new ForbiddenException(
          'You cannot modify an Admin or Super Admin account',
        );
      }
      // Restriction: Cannot promote to Admin or SuperAdmin
      if (
        body.systemRole === 'admin' ||
        body.systemRole === 'super_admin' ||
        body.isSuperAdmin
      ) {
        throw new ForbiddenException(
          'You cannot promote a user to Admin or Super Admin',
        );
      }
    }

    // Capture old values for metadata
    const oldValues = {
      username: user.username,
      email: user.email,
      isActive: user.isActive,
      systemRole: user.systemRole,
    };

    // Update fields
    if (body.email) {
      if (user.googleId) {
        console.warn(`[Admin] Attempted to change email for Google user ${user.id}. Ignored.`);
      } else {
        user.email = body.email;
      }
    }
    if (body.username) user.username = body.username.toLowerCase();
    if (body.firstName) user.firstName = body.firstName;
    if (body.lastName) user.lastName = body.lastName;

    // Role updates
    if (body.systemRole) {
      user.systemRole = body.systemRole;
      // Sync legacy flag
      user.isSuperAdmin = body.systemRole === 'super_admin';
    } else if (body.isSuperAdmin !== undefined) {
      // Fallback for legacy calls
      user.isSuperAdmin = body.isSuperAdmin;
      if (user.isSuperAdmin) user.systemRole = 'super_admin';
      else if (user.systemRole === 'super_admin') user.systemRole = 'user'; // Demote if flag removed
    }

    if (body.isActive !== undefined) user.isActive = body.isActive;
    if (body.introSeen !== undefined) user.introSeen = body.introSeen;
    if (body.isEmailVerified !== undefined) user.isEmailVerified = body.isEmailVerified;

    // Update password if provided
    if (body.password) {
      if (user.googleId) {
        throw new BadRequestException('Password cannot be changed for accounts linked to Google via Admin.');
      }
      user.password = await bcrypt.hash(body.password, 10);
    }

    const savedUser = await this.userRepository.save(user);

    // Handle Organization Assignment (Allowing adding to org during update)
    if (body.organizationId) {
      const orgId = +body.organizationId;

      // Check if already a member
      const existing = await this.userOrganizationRepository.findOne({
        where: { userId: savedUser.id, organizationId: orgId },
      });

      if (!existing) {
        const count = await this.userOrganizationRepository.count({
          where: { organizationId: orgId },
        });
        const userOrg = this.userOrganizationRepository.create({
          userId: savedUser.id,
          organizationId: orgId,
          role: count === 0 ? 'owner' : 'member',
          joinedAt: new Date(),
        });
        await this.userOrganizationRepository.save(userOrg);
      }
    }

    await this.auditService.log({
      action: 'USER_UPDATE',
      performedBy: { id: actingUser.id, username: actingUser.username },
      targetType: 'user',
      targetId: savedUser.id,
      targetLabel: savedUser.username,
      reason: body.reason,
      metadata: { oldValues, updates: body },
      ipAddress: req.ip,
    });

    const { password, ...result } = savedUser;
    return result;
  }

  // Delete User
  @Delete('users/:id')
  @SystemRoles('admin')
  async deleteUser(
    @Request() req: any,
    @Param('id') id: string,
    @Query('transferToOrgId') transferToOrgId?: number,
    @Body() body?: { reason?: string },
  ) {
    const actingUser = req.user;
    const isSuperAdminActor =
      actingUser.isSuperAdmin || actingUser.systemRole === 'super_admin';
    const userId = +id;
    const reason = body?.reason;

    // Validate userId
    if (isNaN(userId)) {
      throw new Error('Invalid user ID');
    }

    // Check target user role
    const targetUser = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (targetUser && !isSuperAdminActor) {
      if (
        targetUser.systemRole === 'admin' ||
        targetUser.systemRole === 'super_admin' ||
        targetUser.isSuperAdmin
      ) {
        throw new ForbiddenException(
          'You cannot delete an Admin or Super Admin account',
        );
      }
    }

    // Find all organizations where user is owner
    const ownedOrgs = await this.userOrganizationRepository.find({
      where: { userId, role: 'owner' },
      relations: ['organization'],
    });

    let totalTransferred = 0;

    // Handle each owned organization
    for (const userOrg of ownedOrgs) {
      if (transferToOrgId) {
        // Transfer filaments to target organization
        const transferred =
          await this.filamentService.transferFilamentsToOrganization(
            userOrg.organizationId,
            +transferToOrgId,
          );
        totalTransferred += transferred;
      }

      // Delete the organization (CASCADE will delete filaments if not transferred)
      await this.organizationRepository.delete(userOrg.organizationId);
    }

    // Delete all user-organization relationships
    await this.userOrganizationRepository.delete({ userId });

    // Delete user
    await this.userRepository.delete(userId);

    await this.auditService.log({
      action: 'USER_DELETE',
      performedBy: { id: actingUser.id, username: actingUser.username },
      targetType: 'user',
      targetId: userId,
      targetLabel: targetUser?.username,
      reason: reason,
      metadata: {
        organizationsDeleted: ownedOrgs.length,
        filamentsTransferred: totalTransferred,
      },
      ipAddress: req.ip,
    });

    return {
      message: 'User deleted successfully',
      organizationsDeleted: ownedOrgs.length,
      filamentsTransferred: totalTransferred,
    };
  }

  // Resend verification email
  @Post('users/:id/resend-verification')
  @SystemRoles('admin')
  async resendVerification(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const user = await this.userRepository.findOneBy({ id: +id });
    await this.authService.resendVerification(+id);

    await this.auditService.log({
      action: 'USER_RESEND_VERIFICATION',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'user',
      targetId: +id,
      targetLabel: user?.username,
      reason: body?.reason,
      ipAddress: req.ip,
    });

    return { message: 'Email de vérification renvoyé avec succès.' };
  }

  // Resend password reset email
  @Post('users/:id/resend-password-reset')
  @SystemRoles('admin')
  async resendPasswordReset(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const user = await this.userRepository.findOne({ where: { id: +id } });
    if (!user) throw new Error('Utilisateur non trouvé');
    await this.authService.forgotPassword(user.email);

    await this.auditService.log({
      action: 'USER_RESEND_PASSWORD_RESET',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'user',
      targetId: +id,
      targetLabel: user.username,
      reason: body?.reason,
      ipAddress: req.ip,
    });

    return { message: 'Email de réinitialisation renvoyé avec succès.' };
  }

  // Update Organization Details
  @Put('organizations/:id')
  async updateOrganization(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const org = await this.organizationRepository.findOneBy({ id: +id });
    const oldValues = { name: org?.name, slug: org?.slug };

    await this.organizationRepository.update(+id, {
      name: body.name,
      slug: body.slug,
    });

    await this.auditService.log({
      action: 'ORG_UPDATE',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'organization',
      targetId: +id,
      targetLabel: body.name,
      reason: body.reason,
      metadata: { oldValues, newValues: { name: body.name, slug: body.slug } },
      ipAddress: req.ip,
    });

    return this.organizationRepository.findOne({ where: { id: +id } });
  }

  // Make user super admin (kept for compatibility or remove if redundant with updateUser)
  @Put('users/:id/super-admin')
  async toggleSuperAdmin(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { isSuperAdmin: boolean; reason?: string },
  ) {
    const user = await this.userRepository.findOneBy({ id: +id });
    await this.userRepository.update(+id, { isSuperAdmin: body.isSuperAdmin });

    await this.auditService.log({
      action: 'USER_ROLE_CHANGE',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'user',
      targetId: +id,
      targetLabel: user?.username,
      reason: body.reason,
      metadata: { isSuperAdmin: body.isSuperAdmin },
      ipAddress: req.ip,
    });

    return { message: 'User updated successfully' };
  }

  // ---- Batch Endpoints ----

  // Mass update users (e.g., activate/deactivate in bulk)
  @Patch('users/batch')
  async batchUpdateUsers(
    @Request() req: any,
    @Body()
    body: { ids: number[]; updates: { isActive?: boolean; isEmailVerified?: boolean }; reason?: string },
  ) {
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      throw new Error('ids array is required');
    }
    const results = [];
    for (const id of body.ids) {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) continue;
      if (body.updates.isActive !== undefined)
        user.isActive = body.updates.isActive;
      if (body.updates.isEmailVerified !== undefined)
        user.isEmailVerified = body.updates.isEmailVerified;
      await this.userRepository.save(user);
      results.push({ id, success: true });
    }

    await this.auditService.log({
      action: 'USER_BATCH_UPDATE',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'user',
      reason: body.reason,
      metadata: {
        userIds: body.ids,
        updates: body.updates,
        updatedCount: results.length,
      },
      ipAddress: req.ip,
    });

    return { updated: results.length, results };
  }

  // Mass update organizations (e.g., change plan/license in bulk)
  @Patch('organizations/batch')
  async batchUpdateOrganizations(
    @Request() req: any,
    @Body()
    body: {
      ids: number[];
      updates: { plan?: 'free' | 'pro' | 'beta' | 'enterprise' };
      reason?: string;
    },
  ) {
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      throw new Error('ids array is required');
    }
    const results = [];
    for (const id of body.ids) {
      if (body.updates.plan) {
        await this.organizationService.updatePlan(id, body.updates.plan);
        results.push({ id, success: true });
      }
    }

    await this.auditService.log({
      action: 'ORG_BATCH_UPDATE',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'organization',
      reason: body.reason,
      metadata: {
        organizationIds: body.ids,
        updates: body.updates,
        updatedCount: results.length,
      },
      ipAddress: req.ip,
    });

    return { updated: results.length, results };
  }

  @Get('filaments')
  async getAllFilaments(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('organizationId') organizationId?: number,
    @Query('brand') brand?: string,
    @Query('material') material?: string,
    @Query('type') type?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    return this.filamentService.findAllGlobal({
      page,
      limit,
      search,
      organizationId,
      brand,
      material,
      type,
      sortBy,
      sortOrder,
    });
  }

  // --- Subscription Management ---

  @Get('subscriptions')
  @SystemRoles('admin', 'moderator')
  async getAllSubscriptions() {
    return this.subscriptionRepository.find({
      relations: ['organization'],
      order: { createdAt: 'DESC' },
    });
  }

  @Delete('subscriptions/:id')
  @SystemRoles('super_admin')
  async deleteSubscription(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const sub = await this.subscriptionRepository.findOne({
      where: { id: +id },
      relations: ['organization'],
    });
    await this.subscriptionRepository.delete(+id);

    await this.auditService.log({
      action: 'SUBSCRIPTION_DELETE',
      performedBy: { id: req.user.id, username: req.user.username },
      targetType: 'subscription',
      targetId: +id,
      targetLabel: sub?.stripeSubscriptionId,
      reason: body?.reason,
      metadata: {
        organizationName: sub?.organization?.name,
        stripeCustomerId: sub?.stripeCustomerId,
      },
      ipAddress: req.ip,
    });

    return { message: 'Subscription deleted successfully' };
  }
}
