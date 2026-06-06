import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

// Mock ESM package that breaks Jest
jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({})),
  __esModule: true,
}));
jest.mock('marked', () => ({ marked: jest.fn((value: string) => value) }));

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  login: jest.fn(),
  signup: jest.fn(),
  verifyEmail: jest.fn(),
  findById: jest.fn(),
  updateProfile: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  setActiveOrganization: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  // ============================
  // POST /auth/active-organization
  // ============================
  describe('setActiveOrganization', () => {
    const mockReq = { user: { sub: 1, userId: 1 } };

    it('should call authService.setActiveOrganization with correct args', async () => {
      mockAuthService.setActiveOrganization.mockResolvedValue({
        activeOrganizationId: 20,
      });

      const result = await controller.setActiveOrganization(mockReq, {
        organizationId: 20,
      });

      expect(mockAuthService.setActiveOrganization).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual({ activeOrganizationId: 20 });
    });

    it('should throw BadRequestException if organizationId is missing', async () => {
      await expect(
        controller.setActiveOrganization(mockReq, { organizationId: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if body is empty', async () => {
      await expect(
        controller.setActiveOrganization(mockReq, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use userId as fallback from req.user', async () => {
      const reqWithUserId = { user: { userId: 5 } }; // No 'sub' field
      mockAuthService.setActiveOrganization.mockResolvedValue({
        activeOrganizationId: 10,
      });

      await controller.setActiveOrganization(reqWithUserId, {
        organizationId: 10,
      });

      expect(mockAuthService.setActiveOrganization).toHaveBeenCalledWith(5, 10);
    });

    it('should propagate service errors', async () => {
      mockAuthService.setActiveOrganization.mockRejectedValue(
        new BadRequestException('User does not belong to this organization'),
      );

      await expect(
        controller.setActiveOrganization(mockReq, { organizationId: 999 }),
      ).rejects.toThrow('User does not belong to this organization');
    });
  });

  // ============================
  // GET /auth/profile — activeOrganizationId
  // ============================
  describe('getProfile', () => {
    it('should return activeOrganizationId in profile', async () => {
      mockAuthService.findById.mockResolvedValue({
        id: 1,
        username: 'testuser',
        activeOrganizationId: 20,
        password: 'hashed',
        notificationPreferences: {
          notifyOnNewSpool: true,
          notifyOnConsumption: true,
          notifyOnSystem: true,
          notifyOnLowStock: true,
          notifyOnInvitation: true,
        },
      });

      const result = await controller.getProfile({ user: { sub: 1 } });

      expect(result.activeOrganizationId).toBe(20);
      expect((result as any).password).toBeUndefined();
    });

    it('should return null activeOrganizationId for new users', async () => {
      mockAuthService.findById.mockResolvedValue({
        id: 1,
        username: 'newuser',
        activeOrganizationId: null,
        password: 'hashed',
        notificationPreferences: null,
      });

      const result = await controller.getProfile({ user: { sub: 1 } });

      expect(result.activeOrganizationId).toBeNull();
    });
  });
});
