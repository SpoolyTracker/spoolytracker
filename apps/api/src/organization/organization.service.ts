import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThanOrEqual } from 'typeorm';
import { Organization } from './organization.entity';
import { UserOrganization } from './user-organization.entity';
import { User } from '../auth/user.entity';
import { Filament } from '../filament/filament.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';
import { PLAN_LIMITS } from '../common/constants';
import { EmailService } from '../email/email.service';
import { Subscription } from '../stripe/subscription.entity';
import { FilamentService } from '../filament/filament.service';
import { Project } from '../projects/entities/project.entity';
import { GlobalSetting } from '../admin/global-setting.entity';
import { isSelfHosted, SELF_HOSTED_PLAN } from '../common/self-hosted';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Filament)
    private filamentRepository: Repository<Filament>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private notificationService: NotificationService,
    private emailService: EmailService,
    private filamentService: FilamentService,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(GlobalSetting)
    private settingsRepository: Repository<GlobalSetting>,
  ) {}

  async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    const exists = await this.organizationRepository.findOne({
      where: { slug },
    });

    if (exists) {
      // Append a short random suffix
      const suffix = Math.random().toString(36).substring(2, 6);
      slug = `${baseSlug}-${suffix}`;
    }

    return slug;
  }

  async create(name: string, ownerId?: number): Promise<Organization> {
    if (ownerId && !isSelfHosted()) {
      const user = await this.userRepository.findOne({
        where: { id: ownerId },
      });
      if (!user) throw new BadRequestException('User not found');

      // Check if user already owns a 'free' organization
      const ownedFreeOrgsCount = await this.userOrganizationRepository
        .createQueryBuilder('uo')
        .leftJoin('uo.organization', 'org')
        .where('uo.userId = :userId', { userId: ownerId })
        .andWhere('uo.role = :role', { role: 'owner' })
        .andWhere('org.plan = :plan', { plan: 'free' })
        .getCount();

      if (ownedFreeOrgsCount >= 1) {
        throw new BadRequestException(
          'Plan limit reached: You can only own one Free organization.',
        );
      }
    }

    // Generate unique slug
    const slug = await this.generateUniqueSlug(name);

    // Create organization
    const organization = this.organizationRepository.create({
      name,
      slug,
      plan: isSelfHosted() ? 'enterprise' : 'free',
    });
    const savedOrg = await this.organizationRepository.save(organization);

    // Add owner if provided
    if (ownerId) {
      const userOrg = this.userOrganizationRepository.create({
        userId: ownerId,
        organizationId: savedOrg.id,
        role: 'owner',
      });
      await this.userOrganizationRepository.save(userOrg);

      // AUTO-SET ACTIVE ORGANIZATION for the user if they don't have one yet
      const user = await this.userRepository.findOne({
        where: { id: ownerId },
      });
      if (user && !user.activeOrganizationId) {
        user.activeOrganizationId = savedOrg.id;
        await this.userRepository.save(user);
      }
    }

    return savedOrg;
  }

  async findByUser(
    userId: number,
    user?: any,
    overrideOrgId?: number,
  ): Promise<UserOrganization[]> {
    const memberships = await this.userOrganizationRepository.find({
      where: { userId },
      relations: ['organization'],
      order: { joinedAt: 'DESC' },
    });

    if (overrideOrgId && user) {
      const isSystemAdmin =
        user.isSuperAdmin === true ||
        ['super_admin', 'admin', 'moderator'].includes(user.systemRole || '');
      if (isSystemAdmin) {
        const alreadyIn = memberships.some(
          (m) => m.organizationId === overrideOrgId,
        );
        if (!alreadyIn) {
          const org = await this.organizationRepository.findOne({
            where: { id: overrideOrgId },
          });
          if (org) {
            const virtualUO = new UserOrganization();
            virtualUO.organizationId = org.id;
            virtualUO.organization = org;
            virtualUO.role = 'admin'; // Allow admin actions in override
            virtualUO.hasConfirmed = true;
            virtualUO.userId = userId;
            virtualUO.joinedAt = new Date();
            // Add to list
            memberships.push(virtualUO);
          }
        }
      }
    }

    return memberships;
  }

  async findOne(id: number): Promise<Organization | null> {
    return this.organizationRepository.findOne({ where: { id } });
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<Organization | null> {
    return this.organizationRepository.findOne({ where: { stripeCustomerId } });
  }

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<Organization | null> {
    return this.organizationRepository.findOne({
      where: { stripeSubscriptionId },
    });
  }

  async getOrganizationUsers(
    organizationId: number,
  ): Promise<UserOrganization[]> {
    return await this.userOrganizationRepository.find({
      where: { organizationId: +organizationId },
      relations: ['user'],
      order: { joinedAt: 'DESC' },
    });
  }

  async addMember(
    organizationId: number,
    email: string,
    role: 'admin' | 'member' = 'member',
    actingUser?: any,
  ): Promise<UserOrganization | null> {
    const userToInvite = await this.userRepository.findOne({
      where: { email: email, isActive: true },
    });
    if (userToInvite) {
      // Check if already member
      const existing = await this.userOrganizationRepository.findOne({
        where: { organizationId, userId: userToInvite.id },
      });
      if (existing) return existing; // Already invited or member

      const org = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });
      if (!org) throw new BadRequestException('Organization not found');

      // Bypass for System Admins
      const isSystemAdmin =
        actingUser?.systemRole === 'admin' ||
        actingUser?.systemRole === 'super_admin' ||
        actingUser?.isSuperAdmin;

      if (!isSystemAdmin && !isSelfHosted()) {
        // Check Plan Limits (Members)
        const currentMemberCount = await this.userOrganizationRepository.count({
          where: { organizationId },
        });

        const limits = (PLAN_LIMITS as any)[(org.plan || 'free').toLowerCase()];
        if (
          limits.maxMembersPerOrg !== Infinity &&
          currentMemberCount >= limits.maxMembersPerOrg
        ) {
          throw new BadRequestException(
            `Plan limit reached: This organization cannot exceed ${limits.maxMembersPerOrg} members.`,
          );
        }
      }

      const userOrg = this.userOrganizationRepository.create({
        userId: userToInvite.id,
        organizationId,
        role: role,
        hasConfirmed: false, // Pending invitation
      });
      const saved = await this.userOrganizationRepository.save(userOrg);

      await this.notificationService.create(
        userToInvite.id,
        NotificationType.INVITATION,
        'Invitation à rejoindre une organisation',
        `Vous avez été invité(e) à rejoindre ${org.name}`,
        { organizationId, organizationName: org.name },
      );

      // Send Email Notification
      const inviterName = actingUser
        ? actingUser.username || actingUser.email
        : 'An administrator';
      try {
        await this.emailService.sendOrganizationInvitation(
          userToInvite.email,
          org.name,
          inviterName,
        );
      } catch (e) {
        console.error('Failed to send invitation email', e);
      }

      return saved;
    }
    return Promise.resolve(null);
  }

  async acceptInvitation(
    userId: number,
    organizationId: number,
  ): Promise<void> {
    await this.userOrganizationRepository.update(
      { userId, organizationId },
      { hasConfirmed: true },
    );
  }

  async declineInvitation(
    userId: number,
    organizationId: number,
  ): Promise<void> {
    await this.userOrganizationRepository.delete({
      userId,
      organizationId,
      hasConfirmed: false,
    });
  }

  async removeMember(organizationId: number, userId: number): Promise<void> {
    const userOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId, userId },
    });
    if (!userOrg) return;
    await this.userOrganizationRepository.delete({
      organizationId,
      userId,
    });
  }

  async getUserRole(
    organizationId: number,
    userId: number,
  ): Promise<string | null> {
    const userOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId, userId },
    });
    return userOrg?.role || null;
  }

  async updateMemberRole(
    organizationId: number,
    userId: number,
    role: 'admin' | 'member',
  ): Promise<UserOrganization | null> {
    const userOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId, userId },
    });
    if (!userOrg) return null;
    if (userOrg.role === 'owner') {
      throw new Error('Cannot change role of owner');
    }

    userOrg.role = role;
    return this.userOrganizationRepository.save(userOrg);
  }

  async forceUpdateMemberRole(
    organizationId: number,
    userId: number,
    role: 'owner' | 'admin' | 'member',
  ): Promise<UserOrganization | null> {
    const userOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId, userId },
    });
    if (!userOrg) return null;
    userOrg.role = role;
    return this.userOrganizationRepository.save(userOrg);
  }

  async updateSettings(
    organizationId: number,
    settings: any,
  ): Promise<Organization | null> {
    await this.organizationRepository.update(organizationId, { settings });
    return this.findOne(organizationId);
  }

  async updatePlan(
    organizationId: number,
    plan: 'free' | 'pro' | 'enterprise' | 'beta',
    endDate?: string | Date,
  ): Promise<Organization | null> {
    if (isSelfHosted()) {
      await this.organizationRepository.update(organizationId, {
        plan: 'enterprise',
        manualPlanEndDate: null,
        requiresQuotaSelection: false,
        isStripeSubscriptionCanceled: false,
        stripeSubscriptionEndDate: null,
      } as any);
      await this.filamentRepository.update(
        { organization: { id: organizationId } },
        { isLocked: false },
      );
      return this.findOne(organizationId);
    }

    // Fetch current plan before update for notifications
    const currentOrg = await this.organizationRepository.findOne({
      where: { id: organizationId },
      relations: { userOrganizations: { user: true } },
    });
    const oldPlan = currentOrg?.plan;

    const updateData: any = { plan };

    if (endDate === null || endDate === '') {
      updateData.manualPlanEndDate = null;
    } else if (endDate) {
      updateData.manualPlanEndDate = new Date(endDate);
    } else if (plan === 'free') {
      updateData.manualPlanEndDate = null; // Clear expiration if downgraded to free manually
    }

    await this.organizationRepository.update(organizationId, updateData);

    // Notify admin about Beta changes
    if (currentOrg && oldPlan !== plan) {
      const owner =
        currentOrg.userOrganizations.find((uo) => uo.role === 'owner') ||
        currentOrg.userOrganizations[0];
      const userEmail = owner?.user?.email;

      if (userEmail) {
        if (plan === 'beta') {
          await this.emailService
            .sendBetaNotification(userEmail, currentOrg.name)
            .catch((e) => console.error('Failed to send beta notification', e));

          // Send CUSTOM Beta Welcome Email to ALL members
          const betaSetting = await this.settingsRepository.findOne({
            where: { key: 'BETA_WELCOME_MESSAGE' },
          });

          if (betaSetting && betaSetting.value) {
            const members = await this.getOrganizationUsers(organizationId);
            for (const member of members) {
              if (member.user.email) {
                await this.emailService
                  .sendBroadcastEmail(
                    member.user.email,
                    'Bienvenue dans le programme Beta !',
                    betaSetting.value,
                  )
                  .catch((e) =>
                    console.error('Failed to send beta welcome email', e),
                  );
              }
            }
          }
        } else if (oldPlan === 'beta') {
          await this.emailService
            .sendBetaRemovalNotification(userEmail, currentOrg.name)
            .catch((e) =>
              console.error('Failed to send beta removal notification', e),
            );
        }
      }
    }

    // Always fetch member IDs to notify them of the plan change
    const orgMembers = await this.userOrganizationRepository.find({
      where: { organizationId, hasConfirmed: true },
      select: ['userId'],
    });
    const memberIds = orgMembers.map((m) => m.userId);

    if (memberIds.length > 0) {
      // Broadcast plan change for immediate UI refresh
      await this.notificationService
        .broadcastToAll(
          'Plan mis à jour',
          `Votre organisation est maintenant passée au plan ${plan}.`,
          { action: 'PLAN_UPDATED', plan },
          memberIds,
          undefined,
          ['internal'],
        )
        .catch((e) =>
          console.error('Failed to broadcast plan update event', e),
        );
    }

    // Centralized quota evaluation
    await this.filamentService.evaluateOrganizationQuota(organizationId);

    // Fetch refreshed org to check if we need to send resolution notifications
    const refreshedOrg = await this.findOne(organizationId);

    if (refreshedOrg?.requiresQuotaSelection) {
      if (memberIds.length > 0) {
        // Broadcast Real-time quota resolution event via SSE specifically to these users
        await this.notificationService
          .broadcastToAll(
            'Action Requise',
            'Votre abonnement a changé et vos bobines dépassent le nouveau quota. Veuillez sélectionner les bobines à conserver.',
            { action: 'REQUIRE_QUOTA_RESOLUTION' },
            memberIds,
            undefined,
            ['internal'], // Only internal SSE
          )
          .catch((e) =>
            console.error('Failed to broadcast quota resolution event', e),
          );
      }
    } else if (refreshedOrg) {
      // Unlock any locked filaments since we are now within limits
      const unlockResult = await this.filamentRepository
        .createQueryBuilder('filament')
        .update()
        .set({ isLocked: false })
        .where('organizationId = :organizationId', { organizationId })
        .andWhere('isLocked = true')
        .execute();

      if (unlockResult.affected && unlockResult.affected > 0) {
        if (memberIds.length > 0) {
          await this.notificationService
            .broadcastToAll(
              'Filaments déverrouillés',
              'Les limites de votre organisation ont augmenté. Les filaments verrouillés sont maintenant disponibles.',
              { action: 'QUOTA_UNLOCKED' },
              memberIds,
              undefined,
              ['internal'],
            )
            .catch((e) =>
              console.error('Failed to broadcast quota unlock event', e),
            );
        }
      }
    }

    return this.findOne(organizationId);
  }

  async processDowngrade(organizationId: number): Promise<void> {
    const org = await this.findOne(organizationId);
    if (!org) return;

    // Reset all subscription-related flags
    await this.organizationRepository.update(organizationId, {
      plan: 'free',
      isStripeSubscriptionCanceled: false,
      stripeSubscriptionEndDate: null,
      stripeSubscriptionId: null,
    });

    // Mark all active subscriptions as canceled for this organization in the history
    await this.subscriptionRepository.update(
      { organizationId, status: 'active' },
      { status: 'canceled', canceledAt: new Date() },
    );

    // Trigger plan update logic to handle quota selection if needed
    await this.updatePlan(organizationId, 'free');
  }

  async updateStripeSubscriptionId(
    organizationId: number,
    stripeSubscriptionId: string | null,
  ): Promise<void> {
    await this.organizationRepository.update(organizationId, {
      stripeSubscriptionId,
    });
  }

  async updateStripeData(
    organizationId: number,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
  ): Promise<void> {
    // Maintain 1:1 mapping: remove these IDs from any other org if they exist
    await this.organizationRepository
      .createQueryBuilder()
      .update(Organization)
      .set({ stripeCustomerId: null as any, stripeSubscriptionId: null as any })
      .where('id <> :organizationId', { organizationId })
      .andWhere(
        '(stripeCustomerId = :stripeCustomerId OR stripeSubscriptionId = :stripeSubscriptionId)',
        { stripeCustomerId, stripeSubscriptionId },
      )
      .execute();

    await this.organizationRepository.update(organizationId, {
      stripeCustomerId,
      stripeSubscriptionId,
    });
  }

  async updateSubscriptionStatus(
    organizationId: number,
    isCanceled: boolean,
    endDate?: Date | null,
  ): Promise<void> {
    await this.organizationRepository.update(organizationId, {
      isStripeSubscriptionCanceled: isCanceled,
      stripeSubscriptionEndDate: endDate || null,
    });
  }

  async updateLogo(
    organizationId: number,
    logoUrl: string | null,
  ): Promise<Organization | null> {
    await this.organizationRepository.update(organizationId, { logo: logoUrl });
    return this.findOne(organizationId);
  }

  async removeLogo(organizationId: number): Promise<void> {
    const os = require('os');
    const fs = require('fs');
    const path = require('path');

    const org = await this.findOne(organizationId);
    if (org && org.logo) {
      // Construct absolute path.
      // org.logo in DB is likely relative like "/uploads/logos/..." or just filename?
      // Controller saved it as relative path to api root?
      // Controller saved: `./../web/public/uploads/logos/${filename}`
      // But what is stored in DB?
      // The controller didn't explicitly save to DB in the previous turn!
      // Wait, I need to check OrganizationController.uploadLogo to see what it calls.

      // Checking OrganizationController again...
      // It calls service.updateLogo with the path?
      // Need to verify what is stored in DB to delete it correctly.

      try {
        // logoUrl is like "/uploads/logos/filename.ext"
        // API root is apps/api
        // Web public root is apps/web/public
        // We need to resolve: apps/api -> ../web/public -> + logoUrl

        // Remove leading slash if present for path.join
        const relativeUrl = org.logo.startsWith('/')
          ? org.logo.substring(1)
          : org.logo;

        // Construct absolute path using process.cwd() or similar.
        // Assuming process.cwd() is apps/api/
        // Target: apps/web/public/uploads/logos/...
        const absolutePath = path.join(
          process.cwd(),
          '../web/public',
          relativeUrl,
        );

        if (fs.existsSync(absolutePath)) {
          await fs.promises.unlink(absolutePath);
        }
      } catch (e) {
        console.warn('Failed to delete logo file', e);
      }

      await this.organizationRepository.update(organizationId, { logo: null });
    }
  }

  async getWithStats(id: number): Promise<any> {
    // Trigger quota evaluation asynchronously on access (org switch/login)
    if (!isSelfHosted()) {
      this.filamentService
        .evaluateOrganizationQuota(id)
        .catch((e) =>
          console.error(`Quota eval failed during access for org ${id}`, e),
        );
    }

    const org = await this.findOne(id);
    if (!org) return null;

    const activeSpoolsCount = await this.filamentRepository.count({
      where: {
        organization: { id: id },
        isLocked: false,
        weightRemaining: MoreThan(0),
      },
    });

    const lockedSpoolsCount = await this.filamentRepository.count({
      where: { organization: { id: id }, isLocked: true },
    });

    const depletedSpoolsCount = await this.filamentRepository.count({
      where: { organization: { id: id }, weightRemaining: LessThanOrEqual(0) },
    });

    const spoolsCount = await this.filamentRepository.count({
      where: { organization: { id: id } },
    });

    const membersCount = await this.userOrganizationRepository.count({
      where: { organizationId: id },
    });
    const projectsCount = await this.projectRepository.count({
      where: { organization: { id: id } },
    });
    const limits = isSelfHosted()
      ? (PLAN_LIMITS as any)[SELF_HOSTED_PLAN]
      : (PLAN_LIMITS as any)[(org.plan || 'free').toLowerCase()];

    return {
      ...org,
      plan: isSelfHosted() ? SELF_HOSTED_PLAN : org.plan,
      requiresQuotaSelection: isSelfHosted() ? false : org.requiresQuotaSelection,
      stats: {
        spoolsCount,
        activeSpoolsCount,
        lockedSpoolsCount,
        depletedSpoolsCount,
        membersCount,
        projectsCount,
        limits,
      },
    };
  }
  async delete(organizationId: number): Promise<void> {
    // Cascade delete should handle related entities if configured, but let's be safe
    // Delete UserOrganizations first
    await this.userOrganizationRepository.delete({ organizationId });

    // Delete Filaments?
    // Note: Filaments likely have foreign key to Organization.
    // We should check Entity definition. creating a query builder might be safer or just rely on cascade.
    // Assuming cascade for now or that we need to wipe them.
    await this.filamentRepository.delete({ organizationId });

    await this.organizationRepository.delete(organizationId);
  }

  async findAll(): Promise<Organization[]> {
    return this.organizationRepository.find({ order: { name: 'ASC' } });
  }

  async startTrial(organizationId: number): Promise<Organization> {
    if (isSelfHosted()) {
      throw new BadRequestException('Trials are disabled in self-hosted mode');
    }

    const org = await this.findOne(organizationId);
    if (!org) throw new BadRequestException('Organization not found');

    if (org.plan !== 'free') {
      throw new BadRequestException('Organization is already on a paid plan');
    }

    if (org.trialEndsAt) {
      throw new BadRequestException('Trial has already been used');
    }

    const now = new Date();
    const trialEnd = new Date(now.setDate(now.getDate() + 15));

    org.trialEndsAt = trialEnd;
    return this.organizationRepository.save(org);
  }

  async resolveQuota(
    organizationId: number,
    selectedFilamentIds: number[],
  ): Promise<void> {
    const org = await this.findOne(organizationId);
    if (!org) throw new BadRequestException('Organization not found');

    if (isSelfHosted()) {
      await this.filamentRepository.update(
        { organization: { id: organizationId } },
        { isLocked: false },
      );
      await this.organizationRepository.update(organizationId, {
        requiresQuotaSelection: false,
      });
      return;
    }

    // Verify count
    const limits = (PLAN_LIMITS as any)[(org.plan || 'free').toLowerCase()];
    if (selectedFilamentIds.length > limits.maxSpoolsPerOrg) {
      throw new BadRequestException(
        `You can only select up to ${limits.maxSpoolsPerOrg} active filaments on your current plan.`,
      );
    }

    // Lock all filaments for the organization first
    await this.filamentRepository
      .createQueryBuilder()
      .update(Filament)
      .set({ isLocked: true })
      .where('organizationId = :organizationId', { organizationId })
      .execute();

    // Unlock the selected ones (if any)
    if (selectedFilamentIds.length > 0) {
      await this.filamentRepository
        .createQueryBuilder()
        .update(Filament)
        .set({ isLocked: false })
        .where('organizationId = :organizationId', { organizationId })
        .andWhereInIds(selectedFilamentIds)
        .execute();
    }

    // Remove the quota selection requirement
    await this.organizationRepository.update(organizationId, {
      requiresQuotaSelection: false,
    });
  }
}
