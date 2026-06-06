import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';

// Mock ESM deps
jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({})),
  __esModule: true,
}));
jest.mock('marked', () => ({ marked: jest.fn((value: string) => value) }));

import { OrganizationService } from './organization.service';
import { Organization } from './organization.entity';
import { UserOrganization } from './user-organization.entity';
import { User } from '../auth/user.entity';
import { Filament } from '../filament/filament.entity';
import { Subscription } from '../stripe/subscription.entity';
import { NotificationService } from '../notification/notification.service';
import { EmailService } from '../email/email.service';
import { FilamentService } from '../filament/filament.service';
import { Project } from '../projects/entities/project.entity';
import { GlobalSetting } from '../admin/global-setting.entity';

// --- Mocks ---
const mockOrgRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockUserOrgRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockFilamentRepo = {
  count: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockSubscriptionRepo = {
  update: jest.fn(),
};

const mockProjectRepo = {
  count: jest.fn(),
};

const mockNotificationService = {
  create: jest.fn().mockResolvedValue(undefined),
  broadcastToAll: jest.fn().mockResolvedValue(undefined),
};

const mockEmailService = {
  sendOrganizationInvitation: jest.fn().mockResolvedValue(undefined),
};

const mockFilamentService = {
  evaluateOrganizationQuota: jest.fn().mockResolvedValue(undefined),
};

const mockSettingsRepo = {
  findOne: jest.fn(),
};

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: getRepositoryToken(Organization), useValue: mockOrgRepo },
        {
          provide: getRepositoryToken(UserOrganization),
          useValue: mockUserOrgRepo,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Filament), useValue: mockFilamentRepo },
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepo,
        },
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: FilamentService, useValue: mockFilamentService },
        {
          provide: getRepositoryToken(GlobalSetting),
          useValue: mockSettingsRepo,
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    jest.clearAllMocks();
  });

  // ==============================
  // create
  // ==============================
  describe('create', () => {
    it('should create org and set user as owner', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 1, username: 'owner' });
      mockUserOrgRepo.createQueryBuilder.mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      });
      const savedOrg = { id: 10, name: 'My Org', slug: 'my-org', plan: 'free' };
      mockOrgRepo.create.mockReturnValue(savedOrg);
      mockOrgRepo.save.mockResolvedValue(savedOrg);
      const savedUserOrg = { userId: 1, organizationId: 10, role: 'owner' };
      mockUserOrgRepo.create.mockReturnValue(savedUserOrg);
      mockUserOrgRepo.save.mockResolvedValue(savedUserOrg);

      const result = await service.create('My Org', 1);

      expect(result).toEqual(savedOrg);
      expect(mockOrgRepo.create).toHaveBeenCalledWith({
        name: 'My Org',
        slug: 'my-org',
        plan: 'free',
      });
      expect(mockUserOrgRepo.create).toHaveBeenCalledWith({
        userId: 1,
        organizationId: 10,
        role: 'owner',
      });
    });

    it('should throw if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.create('Test', 999)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if user already owns a free org', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 1 });
      mockUserOrgRepo.createQueryBuilder.mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1), // Already owns 1 free org
      });

      await expect(service.create('Another Org', 1)).rejects.toThrow(
        'Plan limit reached',
      );
    });

    it('should generate correct slug from org name', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 1 });
      mockUserOrgRepo.createQueryBuilder.mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      });
      mockOrgRepo.create.mockImplementation((data: any) => data);
      mockOrgRepo.save.mockImplementation((data: any) =>
        Promise.resolve({ ...data, id: 1 }),
      );
      mockUserOrgRepo.create.mockReturnValue({});
      mockUserOrgRepo.save.mockResolvedValue({});

      await service.create('Mon Équipe 3D !', 1);

      expect(mockOrgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'mon-equipe-3d' }),
      );
    });
  });

  // ==============================
  // addMember
  // ==============================
  describe('addMember', () => {
    it('should invite an existing user as pending member', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 2,
        email: 'new@test.com',
        isActive: true,
      });
      mockUserOrgRepo.findOne.mockResolvedValue(null); // Not already a member
      mockOrgRepo.findOne.mockResolvedValue({
        id: 10,
        name: 'Org',
        plan: 'free',
      });
      mockUserOrgRepo.count.mockResolvedValue(1); // 1 existing member
      const savedUO = {
        userId: 2,
        organizationId: 10,
        role: 'member',
        hasConfirmed: false,
      };
      mockUserOrgRepo.create.mockReturnValue(savedUO);
      mockUserOrgRepo.save.mockResolvedValue(savedUO);

      const result = await service.addMember(10, 'new@test.com', 'member', {
        username: 'admin',
      });

      expect(result).toEqual(savedUO);
      expect(mockNotificationService.create).toHaveBeenCalled();
      expect(mockEmailService.sendOrganizationInvitation).toHaveBeenCalledWith(
        'new@test.com',
        'Org',
        'admin',
      );
    });

    it('should return existing membership if already member', async () => {
      const existingUO = { userId: 2, organizationId: 10, role: 'member' };
      mockUserRepo.findOne.mockResolvedValue({
        id: 2,
        email: 'dup@test.com',
        isActive: true,
      });
      mockUserOrgRepo.findOne.mockResolvedValue(existingUO);

      const result = await service.addMember(10, 'dup@test.com');

      expect(result).toEqual(existingUO);
      expect(mockUserOrgRepo.save).not.toHaveBeenCalled();
    });

    it('should throw when plan member limit is reached', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 2,
        email: 'new@test.com',
        isActive: true,
      });
      mockUserOrgRepo.findOne.mockResolvedValue(null);
      mockOrgRepo.findOne.mockResolvedValue({
        id: 10,
        name: 'Org',
        plan: 'free',
      });
      mockUserOrgRepo.count.mockResolvedValue(3); // Free plan limit = 3

      await expect(
        service.addMember(10, 'new@test.com', 'member', { systemRole: 'user' }),
      ).rejects.toThrow('Plan limit reached');
    });

    it('should bypass plan limits for system admins', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 2,
        email: 'new@test.com',
        isActive: true,
      });
      mockUserOrgRepo.findOne.mockResolvedValue(null);
      mockOrgRepo.findOne.mockResolvedValue({
        id: 10,
        name: 'Org',
        plan: 'free',
      });
      mockUserOrgRepo.count.mockResolvedValue(3); // At limit
      mockUserOrgRepo.create.mockReturnValue({});
      mockUserOrgRepo.save.mockResolvedValue({});

      // Should NOT throw because actingUser is super_admin
      const result = await service.addMember(10, 'new@test.com', 'member', {
        systemRole: 'super_admin',
      });
      expect(result).toBeDefined();
    });

    it('should return null if user email not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await service.addMember(10, 'ghost@nowhere.com');
      expect(result).toBeNull();
    });
  });

  // ==============================
  // updateMemberRole
  // ==============================
  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const uo = { organizationId: 10, userId: 2, role: 'member' };
      mockUserOrgRepo.findOne.mockResolvedValue(uo);
      mockUserOrgRepo.save.mockImplementation((data: any) =>
        Promise.resolve(data),
      );

      const result = await service.updateMemberRole(10, 2, 'admin');

      expect(result!.role).toBe('admin');
    });

    it('should throw if trying to change owner role', async () => {
      mockUserOrgRepo.findOne.mockResolvedValue({
        organizationId: 10,
        userId: 1,
        role: 'owner',
      });

      await expect(service.updateMemberRole(10, 1, 'member')).rejects.toThrow(
        'Cannot change role of owner',
      );
    });

    it('should return null if membership not found', async () => {
      mockUserOrgRepo.findOne.mockResolvedValue(null);

      const result = await service.updateMemberRole(10, 999, 'admin');
      expect(result).toBeNull();
    });
  });

  // ==============================
  // startTrial
  // ==============================
  describe('startTrial', () => {
    it('should set trialEndsAt 15 days in the future', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 10,
        plan: 'free',
        trialEndsAt: null,
      });
      mockOrgRepo.save.mockImplementation((data: any) => Promise.resolve(data));

      const result = await service.startTrial(10);

      expect(result.trialEndsAt).toBeDefined();
      const diff = result.trialEndsAt.getTime() - Date.now();
      // Should be ~15 days (allow ±1 day margin)
      expect(diff).toBeGreaterThan(13 * 24 * 60 * 60 * 1000);
      expect(diff).toBeLessThan(16 * 24 * 60 * 60 * 1000);
    });

    it('should throw if org not found', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);
      await expect(service.startTrial(999)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if org already on paid plan', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 10,
        plan: 'pro',
        trialEndsAt: null,
      });
      await expect(service.startTrial(10)).rejects.toThrow(
        'already on a paid plan',
      );
    });

    it('should throw if trial already used', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 10,
        plan: 'free',
        trialEndsAt: new Date(),
      });
      await expect(service.startTrial(10)).rejects.toThrow('already been used');
    });
  });

  // ==============================
  // getUserRole
  // ==============================
  describe('getUserRole', () => {
    it('should return user role', async () => {
      mockUserOrgRepo.findOne.mockResolvedValue({ role: 'admin' });
      expect(await service.getUserRole(10, 2)).toBe('admin');
    });

    it('should return null if not a member', async () => {
      mockUserOrgRepo.findOne.mockResolvedValue(null);
      expect(await service.getUserRole(10, 999)).toBeNull();
    });
  });

  // ==============================
  // acceptInvitation / declineInvitation
  // ==============================
  describe('invitations', () => {
    it('acceptInvitation should set hasConfirmed to true', async () => {
      mockUserOrgRepo.update.mockResolvedValue({ affected: 1 });
      await service.acceptInvitation(2, 10);
      expect(mockUserOrgRepo.update).toHaveBeenCalledWith(
        { userId: 2, organizationId: 10 },
        { hasConfirmed: true },
      );
    });

    it('declineInvitation should delete unconfirmed membership', async () => {
      mockUserOrgRepo.delete.mockResolvedValue({ affected: 1 });
      await service.declineInvitation(2, 10);
      expect(mockUserOrgRepo.delete).toHaveBeenCalledWith({
        userId: 2,
        organizationId: 10,
        hasConfirmed: false,
      });
    });
  });

  // ==============================
  // findByUser with override
  // ==============================
  describe('findByUser with override', () => {
    it('should include override org for system admin if not already member', async () => {
      const userId = 1;
      const user = { id: userId, isSuperAdmin: true };
      const overrideOrgId = 99;
      const existingMembership = {
        organizationId: 10,
        organization: { id: 10, name: 'Org 10' },
      };

      mockUserOrgRepo.find.mockResolvedValue([existingMembership]);
      mockOrgRepo.findOne.mockResolvedValue({
        id: overrideOrgId,
        name: 'Override Org',
      });

      const result = await service.findByUser(userId, user, overrideOrgId);

      expect(result).toHaveLength(2);
      expect(result[1].organizationId).toBe(overrideOrgId);
      expect(result[1].organization.name).toBe('Override Org');
      expect(result[1].hasConfirmed).toBe(true);
      expect(result[1].role).toBe('admin');
    });

    it('should NOT include override org if user is already a member', async () => {
      const userId = 1;
      const user = { id: userId, isSuperAdmin: true };
      const overrideOrgId = 10;
      const existingMembership = {
        organizationId: 10,
        organization: { id: 10, name: 'Org 10' },
      };

      mockUserOrgRepo.find.mockResolvedValue([existingMembership]);

      const result = await service.findByUser(userId, user, overrideOrgId);

      expect(result).toHaveLength(1);
      expect(mockOrgRepo.findOne).not.toHaveBeenCalled();
    });

    it('should NOT include override org if user is NOT a system admin', async () => {
      const userId = 1;
      const user = { id: userId, isSuperAdmin: false, systemRole: 'user' };
      const overrideOrgId = 99;
      const existingMembership = {
        organizationId: 10,
        organization: { id: 10, name: 'Org 10' },
      };

      mockUserOrgRepo.find.mockResolvedValue([existingMembership]);

      const result = await service.findByUser(userId, user, overrideOrgId);

      expect(result).toHaveLength(1);
      expect(mockOrgRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
