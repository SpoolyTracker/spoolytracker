import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

// Mock ESM package that breaks Jest
jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({})),
  __esModule: true,
}));

jest.mock('marked', () => ({
  marked: jest.fn((value: string) => value),
  __esModule: true,
}));

// Mock bcrypt (non-configurable exports in v6)
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('hashed'),
  genSalt: jest.fn().mockResolvedValue('salt'),
}));

import * as bcrypt from 'bcrypt';
import { OrganizationService } from '../organization/organization.service';
import { EmailService } from '../email/email.service';
import { FilamentService } from '../filament/filament.service';

// --- Mocks ---
const mockUserRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('test-jwt-token'),
};

const mockOrganizationService = {};
const mockEmailService = {};
const mockFilamentService = {
  evaluateOrganizationQuota: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  transaction: jest.fn(),
};
const mockConfigService = {
  get: jest.fn().mockReturnValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: FilamentService, useValue: mockFilamentService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('Apple social login', () => {
    it('does not link Apple private relay emails to existing active email accounts', async () => {
      const relayEmail = 'abc123@privaterelay.appleid.com';
      const newUser = {
        id: 2,
        username: 'tmp-social-test',
        email: relayEmail,
        appleId: 'apple-sub-1',
        googleId: null,
        displayName: 'Apple User',
        firstName: null,
        lastName: null,
        isActive: true,
        isSuperAdmin: false,
        systemRole: 'user',
        isEmailVerified: true,
        introSeen: false,
        activeOrganizationId: null,
        userOrganizations: [],
      };

      mockUserRepo.findOne.mockResolvedValueOnce(null); // appleId lookup
      mockUserRepo.create.mockReturnValue(newUser);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      await (service as any).handleAppleLogin(
        'apple-sub-1',
        relayEmail,
        'Apple User',
        {},
      );

      expect(mockUserRepo.findOne).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: relayEmail, isActive: true },
        }),
      );
      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: relayEmail,
          appleId: 'apple-sub-1',
          username: expect.stringMatching(/^tmp-social-/),
        }),
      );
    });
  });

  // ============================
  // LOGIN — Organization Logic
  // ============================
  describe('login — activeOrganizationId logic', () => {
    const makeUser = (overrides: Partial<User> = {}): User =>
      ({
        id: 1,
        username: 'testuser',
        password: 'hashed',
        displayName: 'Test',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@test.com',
        isActive: true,
        isSuperAdmin: false,
        systemRole: 'user',
        isEmailVerified: true,
        introSeen: false,
        verificationToken: '',
        resetPasswordToken: null,
        resetPasswordExpires: null,
        lastLoginAt: new Date(),
        activeOrganizationId: null,
        pushTokens: [],
        stripeCustomerId: '',
        createdAt: new Date(),
        userOrganizations: [],
        notificationPreferences: null as any,
        projects: [],
        googleId: null as any,
        ...overrides,
      }) as User;

    beforeEach(() => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    });

    it('should auto-select first confirmed org when activeOrganizationId is null', async () => {
      const user = makeUser({
        activeOrganizationId: null,
        userOrganizations: [
          {
            id: 1,
            userId: 1,
            organizationId: 10,
            role: 'owner',
            hasConfirmed: true,
            organization: { id: 10, name: 'Org A' },
            joinedAt: new Date(),
          } as any,
          {
            id: 2,
            userId: 1,
            organizationId: 20,
            role: 'member',
            hasConfirmed: true,
            organization: { id: 20, name: 'Org B' },
            joinedAt: new Date(),
          } as any,
        ],
      });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.login('testuser', 'password');

      expect(result.activeOrganizationId).toBe(10);
      expect(result.user.activeOrganizationId).toBe(10);
    });

    it('should keep existing activeOrganizationId if still valid', async () => {
      const user = makeUser({
        activeOrganizationId: 20,
        userOrganizations: [
          {
            id: 1,
            userId: 1,
            organizationId: 10,
            role: 'owner',
            hasConfirmed: true,
            organization: { id: 10, name: 'Org A' },
            joinedAt: new Date(),
          } as any,
          {
            id: 2,
            userId: 1,
            organizationId: 20,
            role: 'member',
            hasConfirmed: true,
            organization: { id: 20, name: 'Org B' },
            joinedAt: new Date(),
          } as any,
        ],
      });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.login('testuser', 'password');

      expect(result.activeOrganizationId).toBe(20);
    });

    it('should reset to first org if activeOrganizationId refers to a removed org', async () => {
      const user = makeUser({
        activeOrganizationId: 999, // No longer in any org
        userOrganizations: [
          {
            id: 1,
            userId: 1,
            organizationId: 10,
            role: 'owner',
            hasConfirmed: true,
            organization: { id: 10, name: 'Org A' },
            joinedAt: new Date(),
          } as any,
        ],
      });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.login('testuser', 'password');

      expect(result.activeOrganizationId).toBe(10);
    });

    it('should set activeOrganizationId to null if user has no confirmed orgs', async () => {
      const user = makeUser({
        activeOrganizationId: 999,
        userOrganizations: [
          {
            id: 1,
            userId: 1,
            organizationId: 10,
            role: 'member',
            hasConfirmed: false,
            organization: { id: 10, name: 'Pending' },
            joinedAt: new Date(),
          } as any,
        ],
      });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.login('testuser', 'password');

      expect(result.activeOrganizationId).toBeNull();
    });

    it('should skip unconfirmed orgs when auto-selecting', async () => {
      const user = makeUser({
        activeOrganizationId: null,
        userOrganizations: [
          {
            id: 1,
            userId: 1,
            organizationId: 10,
            role: 'member',
            hasConfirmed: false,
            organization: { id: 10, name: 'Pending' },
            joinedAt: new Date(),
          } as any,
          {
            id: 2,
            userId: 1,
            organizationId: 20,
            role: 'owner',
            hasConfirmed: true,
            organization: { id: 20, name: 'Active' },
            joinedAt: new Date(),
          } as any,
        ],
      });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.login('testuser', 'password');

      expect(result.activeOrganizationId).toBe(20);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.login('unknown', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('testuser', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if account is inactive', async () => {
      const user = makeUser({ isActive: false });
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(service.login('testuser', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ============================
  // setActiveOrganization
  // ============================
  describe('setActiveOrganization', () => {
    it('should persist and return the new activeOrganizationId', async () => {
      const user = {
        id: 1,
        activeOrganizationId: 10,
        userOrganizations: [
          { organizationId: 10, hasConfirmed: true },
          { organizationId: 20, hasConfirmed: true },
        ],
      };
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.setActiveOrganization(1, 20);

      expect(result.activeOrganizationId).toBe(20);
      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ activeOrganizationId: 20 }),
      );
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.setActiveOrganization(999, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if user does not belong to org', async () => {
      const user = {
        id: 1,
        activeOrganizationId: 10,
        userOrganizations: [{ organizationId: 10, hasConfirmed: true }],
      };
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(service.setActiveOrganization(1, 999)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if org membership is unconfirmed', async () => {
      const user = {
        id: 1,
        activeOrganizationId: null,
        userOrganizations: [{ organizationId: 10, hasConfirmed: false }],
      };
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(service.setActiveOrganization(1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow switching back to an already active org', async () => {
      const user = {
        id: 1,
        activeOrganizationId: 10,
        userOrganizations: [{ organizationId: 10, hasConfirmed: true }],
      };
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.setActiveOrganization(1, 10);

      expect(result.activeOrganizationId).toBe(10);
    });
  });
});
