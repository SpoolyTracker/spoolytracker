import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

// Mock ESM deps pulled in transitively by AppModule entities/services
jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({})),
  __esModule: true,
}));
jest.mock('marked', () => ({ marked: jest.fn((value: string) => value) }));

import { BootstrapAdminService } from './bootstrap-admin.service';
import { User } from '../auth/user.entity';
import { OrganizationService } from '../organization/organization.service';

describe('BootstrapAdminService', () => {
  let service: BootstrapAdminService;
  let userRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let orgService: { create: jest.Mock };
  let config: Record<string, string | undefined>;

  const validConfig = {
    SELF_HOSTED: 'true',
    BOOTSTRAP_ADMIN_USERNAME: 'SuperAdmin',
    BOOTSTRAP_ADMIN_EMAIL: 'Admin@Example.com',
    BOOTSTRAP_ADMIN_PASSWORD: 'a-very-long-password',
    BOOTSTRAP_ORGANIZATION_NAME: 'My Org',
  };

  beforeEach(async () => {
    config = { ...validConfig };
    userRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((u) => u),
      save: jest.fn((u) => Promise.resolve({ id: 1, ...u })),
    };
    orgService = { create: jest.fn().mockResolvedValue({ id: 7, name: 'My Org' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BootstrapAdminService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => config[key] },
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: OrganizationService, useValue: orgService },
      ],
    }).compile();

    service = module.get(BootstrapAdminService);
  });

  it('does nothing when SELF_HOSTED is not "true"', async () => {
    config.SELF_HOSTED = undefined;
    await service.ensureAdmin();
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(orgService.create).not.toHaveBeenCalled();
  });

  it('skips when required bootstrap vars are missing', async () => {
    config.BOOTSTRAP_ADMIN_PASSWORD = undefined;
    await service.ensureAdmin();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('skips when password is shorter than 12 characters', async () => {
    config.BOOTSTRAP_ADMIN_PASSWORD = 'short';
    await service.ensureAdmin();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('skips creation when an admin already exists (idempotent)', async () => {
    userRepo.findOne.mockResolvedValue({ id: 99, username: 'superadmin' });
    await service.ensureAdmin();
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(orgService.create).not.toHaveBeenCalled();
  });

  it('creates a super admin and organization on the happy path', async () => {
    await service.ensureAdmin();

    expect(userRepo.save).toHaveBeenCalledTimes(1);
    const created = userRepo.create.mock.calls[0][0];
    expect(created.username).toBe('superadmin'); // normalized lower-case
    expect(created.email).toBe('admin@example.com');
    expect(created.systemRole).toBe('super_admin');
    expect(created.isSuperAdmin).toBe(true);
    expect(created.isActive).toBe(true);
    expect(created.isEmailVerified).toBe(true);
    expect(created.password).not.toBe('a-very-long-password'); // hashed

    expect(orgService.create).toHaveBeenCalledWith('My Org', 1);
  });

  it('does not throw if organization creation fails', async () => {
    orgService.create.mockRejectedValue(new Error('boom'));
    await expect(service.ensureAdmin()).resolves.toBeUndefined();
    expect(userRepo.save).toHaveBeenCalledTimes(1);
  });
});
