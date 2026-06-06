import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DataSource, Repository, ILike } from 'typeorm';
import { EmailService } from '../email/email.service';
import { FilamentService } from '../filament/filament.service';
import { UserNotificationPreference } from '../notification/user-notification-preference.entity';
import { OrganizationService } from '../organization/organization.service';
import { SignupDto } from './dto/signup.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { User } from './user.entity';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';

@Injectable()
export class AuthService {
  private readonly maxFailedLoginAttempts = 5;
  private readonly loginLockMinutes = 15;

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private organizationService: OrganizationService,
    private emailService: EmailService,
    private filamentService: FilamentService,
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {}

  private validatePasswordFormat(password: string) {
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\-\/\\+\*@#_]).{8,}$/;

    if (!passwordRegex.test(password)) {
      throw new BadRequestException({
        message:
          'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character (- / \\ + * @ # _)',
        errorCode: 'ERR_PASSWORD_INVALID_FORMAT',
      });
    }
  }

  async validateUser(
    usernameInput: string,
    password: string,
  ): Promise<{ user: User | null; isPasswordValid: boolean }> {
    const rawUsername = (usernameInput || '').trim();
    // Normalize exactly like in signup: trim, replace spaces with hyphens, lowercase
    const normalizedUsername = rawUsername
      .replace(/\s+/g, '-')
      .toLowerCase();
    
    const normalizedEmail = rawUsername.toLowerCase();

    console.log(`[AuthService] validateUser: Input="${usernameInput}", NormalizedUsername="${normalizedUsername}", NormalizedEmail="${normalizedEmail}"`);

    // Search by username OR email
    const user = await this.usersRepository.findOne({
      relations: { userOrganizations: { organization: true } },
      where: [
        { username: normalizedUsername },
        { email: normalizedEmail },
      ],
    });

    if (!user) {
      console.warn(`[AuthService] validateUser: User not found for "${normalizedUsername}" or "${normalizedEmail}"`);
      return { user: null, isPasswordValid: false };
    }

    if (!user.password) {
      console.warn(`[AuthService] validateUser: Password login attempted for user ID ${user.id} (${user.username}) without password hash`);
      return { user, isPasswordValid: false };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.warn(`[AuthService] validateUser: Password mismatch for user ID ${user.id} (${user.username})`);
    }

    return { user, isPasswordValid };
  }

  async login(username: string, password: string) {
    const normalizedUsername = username.toLowerCase();
    const { user, isPasswordValid } = await this.validateUser(
      normalizedUsername,
      password,
    );

    if (!user) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        errorCode: 'ERR_INVALID_CREDENTIALS',
      });
    }

    if (this.isLoginLocked(user)) {
      throw this.createAccountLockedException(user);
    }

    if (!isPasswordValid) {
      await this.recordFailedLogin(user);
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        errorCode: 'ERR_INVALID_CREDENTIALS',
      });
    }
    if (user.isActive === false) {
      throw new UnauthorizedException({
        message: 'Account is inactive. Please verify your email address or contact support.',
        errorCode: 'ERR_ACCOUNT_INACTIVE',
      });
    }

    await this.clearFailedLoginState(user);
    return this.generateLoginResponse(user);
  }

  private isLoginLocked(user: User): boolean {
    return !!user.loginLockedUntil && user.loginLockedUntil > new Date();
  }

  private createAccountLockedException(user: User): HttpException {
    return new HttpException(
      {
        message:
          'Too many login attempts. Please wait before trying again.',
        errorCode: 'ERR_ACCOUNT_LOCKED',
        lockedUntil: user.loginLockedUntil,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async recordFailedLogin(user: User): Promise<void> {
    const lockExpired =
      user.loginLockedUntil && user.loginLockedUntil <= new Date();

    if (lockExpired) {
      user.failedLoginAttempts = 0;
      user.loginLockedUntil = null;
    }

    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

    if (user.failedLoginAttempts >= this.maxFailedLoginAttempts) {
      user.loginLockedUntil = new Date(
        Date.now() + this.loginLockMinutes * 60 * 1000,
      );
    }

    await this.usersRepository.save(user);

    if (this.isLoginLocked(user)) {
      throw this.createAccountLockedException(user);
    }
  }

  private async clearFailedLoginState(user: User): Promise<void> {
    if (!user.failedLoginAttempts && !user.loginLockedUntil) return;

    user.failedLoginAttempts = 0;
    user.loginLockedUntil = null;
    await this.usersRepository.save(user);
  }

  private async generateLoginResponse(user: User) {
    user.lastLoginAt = new Date();

    // Sync legacy SuperAdmin flag on login
    if (user.isSuperAdmin && user.systemRole !== 'super_admin') {
      user.systemRole = 'super_admin';
    }

    // Auto-select first organization if none was previously set
    const confirmedOrgs =
      user.userOrganizations?.filter((uo) => uo.hasConfirmed !== false) || [];
    console.log(
      `[Backend] generateLoginResponse for ${user.username} (ID: ${user.id}). Found ${user.userOrganizations?.length || 0} organizations (${confirmedOrgs.length} confirmed). Current activeOrg: ${user.activeOrganizationId}`,
    );

    if (!user.activeOrganizationId && confirmedOrgs.length > 0) {
      user.activeOrganizationId = confirmedOrgs[0].organizationId;
      console.log(
        `[Backend] generateLoginResponse: Auto-selected first org: ${user.activeOrganizationId}`,
      );
    }
    // Validate that activeOrganizationId is still valid (user might have been removed from org)
    if (
      user.activeOrganizationId &&
      !confirmedOrgs.find(
        (uo) => uo.organizationId === user.activeOrganizationId,
      )
    ) {
      user.activeOrganizationId =
        confirmedOrgs.length > 0 ? confirmedOrgs[0].organizationId : null;
      console.log(
        `[Backend] generateLoginResponse: Active org was invalid or missing, corrected to: ${user.activeOrganizationId}`,
      );
    }

    await this.usersRepository.save(user);

    const payload = {
      username: user.username,
      displayName: user.displayName,
      sub: user.id,
      organisations:
        user.userOrganizations
          ?.map((item) => item.organizationId)
          .join(',')
          .toString() ?? '',
      activeOrganizationId: user.activeOrganizationId,
      isSuperAdmin: user.isSuperAdmin,
      systemRole: user.systemRole,
      isEmailVerified: user.isEmailVerified,
      needsUsername: user.username.startsWith('tmp-social-'),
    };

    console.log(`[Backend] JWT Payload generated:`, JSON.stringify(payload));

    // Re-evaluate quota for all user's organizations on login
    if (user.userOrganizations) {
      for (const uo of user.userOrganizations) {
        this.filamentService
          .evaluateOrganizationQuota(uo.organizationId)
          .catch((e) =>
            console.error(`Quota eval failed for org ${uo.organizationId}`, e),
          );
      }
    }

    const organisations =
      user.userOrganizations?.map((uo) => ({
        id: uo.organization.id,
        name: uo.organization.name,
        role: uo.role,
      })) || [];

    return {
      access_token: this.jwtService.sign(payload),
      activeOrganizationId: user.activeOrganizationId,
      organisations,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
        systemRole: user.systemRole,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        introSeen: user.introSeen,
        activeOrganizationId: user.activeOrganizationId,
        needsUsername: user.username.startsWith('tmp-social-'),
        googleId: user.googleId,
        appleId: user.appleId,
        isSocial: !!user.googleId || !!user.appleId || user.username.startsWith('tmp-social-'),
      },
    };
  }

  async createUser(
    username: string,
    password: string,
    email?: string,
  ): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      username: username.toLowerCase(),
      password: hashedPassword,
      email,
    });
    return this.usersRepository.save(user);
  }

  async signup(dto: SignupDto): Promise<User> {
    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.usersRepository.findOne({
      where: { email: ILike(email) },
    });
    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const sanitizedUsername = dto.username
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();

    const user = this.usersRepository.create({
      username: sanitizedUsername,
      email,
      password: hashedPassword,
      verificationToken,
      isEmailVerified: false,
      notificationPreferences: new UserNotificationPreference(),
    });

    const savedUser = await this.usersRepository.save(user);
    console.log(
      `[AuthService] User created: ${savedUser.id} (${savedUser.email})`,
    );

    // Send verification email EARLY to ensure the user receives it even if org creation is slow
    try {
      await this.emailService.sendVerificationEmail(
        savedUser.email,
        verificationToken,
        savedUser.id,
      );
      console.log(
        `[AuthService] Initial verification email sent to ${savedUser.email}`,
      );
    } catch (error) {
      console.error(
        '[AuthService] Failed to send initial verification email',
        error,
      );
    }

    // Create initial organization
    try {
      await this.organizationService.create(dto.organizationName, savedUser.id);
      console.log(
        `[AuthService] Organization "${dto.organizationName}" created for user ${savedUser.id}`,
      );
    } catch (error) {
      console.error(
        `[AuthService] Failed to create organization for user ${savedUser.id}`,
        error,
      );
      // We still return the user because they exist and have received the email.
      // They can always create an organization later or have it fixed by admin.
    }

    return savedUser;
  }

  async resendVerification(userIdOrEmail: number | string): Promise<void> {
    let user: User | null;
    if (typeof userIdOrEmail === 'number') {
      user = await this.usersRepository.findOne({
        where: { id: userIdOrEmail },
      });
    } else {
      user = await this.usersRepository.findOne({
        where: { email: userIdOrEmail.toLowerCase() },
      });
    }

    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    if (user.isEmailVerified)
      throw new BadRequestException('Email déjà vérifié');

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    await this.usersRepository.save(user);

    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.id,
    );
  }

  async verifyEmail(
    token: string,
    userId?: number,
  ): Promise<'success' | 'already_verified' | 'invalid'> {
    // If userId provided, check direct fetch first (idempotency)
    if (userId) {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
      });

      // 1. User is already verified
      if (user && user.isEmailVerified) {
        return 'already_verified';
      }

      // 2. User exists, not verified, check token
      if (user && user.verificationToken === token) {
        user.isEmailVerified = true;
        user.isActive = true;
        user.verificationToken = '';
        await this.usersRepository.save(user);
        return 'success';
      }
    }

    // 3. Fallback: Find by token only (for old links or missing ID)
    const user = await this.usersRepository.findOne({
      where: { verificationToken: token },
    });
    if (!user) {
      return 'invalid';
    }

    user.isEmailVerified = true;
    user.isActive = true;
    user.verificationToken = '';
    await this.usersRepository.save(user);
    return 'success';
  }

  async findById(id: number): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { id, isActive: true },
      relations: {
        userOrganizations: { organization: true },
        notificationPreferences: true,
      },
    });

    if (!user) return null;

    let hasChanged = false;

    // AUTO-VERIFY SUPERADMIN or Social Users to prevent infinite verification loops on mobile
    if (
      !user.isEmailVerified &&
      (user.username === 'superadmin' || user.isSuperAdmin || user.googleId || user.appleId)
    ) {
      user.isEmailVerified = true;
      hasChanged = true;
    }

    // VALIDATE activeOrganizationId — prevent stale org references
    const confirmedOrgs =
      user.userOrganizations?.filter((uo) => uo.hasConfirmed !== false) || [];
    const currentActiveId = user.activeOrganizationId;

    if (
      currentActiveId &&
      !confirmedOrgs.find((uo) => uo.organizationId === currentActiveId)
    ) {
      // User doesn't belong to this org anymore — auto-correct
      user.activeOrganizationId =
        confirmedOrgs.length > 0 ? confirmedOrgs[0].organizationId : null;
      if (user.activeOrganizationId !== currentActiveId) {
        console.log(
          `[AuthService] Correcting invalid activeOrganizationId for user ${user.id}: ${currentActiveId} -> ${user.activeOrganizationId}`,
        );
        hasChanged = true;
      }
    } else if (!currentActiveId && confirmedOrgs.length > 0) {
      // Auto-assign if user has orgs but no active one
      user.activeOrganizationId = confirmedOrgs[0].organizationId;
      console.log(
        `[AuthService] Auto-assigning first organization for user ${user.id}: ${user.activeOrganizationId}`,
      );
      hasChanged = true;
    }

    if (hasChanged) {
      await this.usersRepository.save(user);
    }

    return user;
  }

  async createSessionFromUserId(id: number) {
    const user = await this.findById(id);
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }
    return this.generateLoginResponse(user);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 1); // 1 hour expiration

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = tokenExpires;

    await this.usersRepository.save(user);
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    this.validatePasswordFormat(newPassword);

    const user = await this.usersRepository.findOne({
      where: { resetPasswordToken: token },
    });

    if (
      !user ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < new Date()
    ) {
      return false;
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.isActive = true;
    user.isEmailVerified = true;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await this.usersRepository.save(user);
    return true;
  }

  async updateProfile(
    userId: number,
    data: {
      displayName?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
      introSeen?: boolean;
      notifyOnNewSpool?: boolean;
      notifyOnConsumption?: boolean;
      notifyOnSystem?: boolean;
      notifyOnLowStock?: boolean;
      notifyOnInvitation?: boolean;
    },
  ) {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');

    if (data.displayName !== undefined) user.displayName = data.displayName;
    if (data.firstName !== undefined) user.firstName = data.firstName;
    if (data.lastName !== undefined) user.lastName = data.lastName;
    if (data.email !== undefined) {
      // Email is fixed once the account is created to avoid security/logic conflicts.
      console.warn(
        `[AuthService] Attempted to change email for user ${user.id}. Modification blocked by policy.`,
      );
    }
    if (data.introSeen !== undefined) user.introSeen = data.introSeen;

    // Notifications Preferences
    if (!user.notificationPreferences) {
      user.notificationPreferences = new UserNotificationPreference();
    }

    if (data.notifyOnNewSpool !== undefined)
      user.notificationPreferences.notifyOnNewSpool = data.notifyOnNewSpool;
    if (data.notifyOnConsumption !== undefined)
      user.notificationPreferences.notifyOnConsumption =
        data.notifyOnConsumption;
    if (data.notifyOnSystem !== undefined)
      user.notificationPreferences.notifyOnSystem = data.notifyOnSystem;
    if (data.notifyOnLowStock !== undefined)
      user.notificationPreferences.notifyOnLowStock = data.notifyOnLowStock;
    if (data.notifyOnInvitation !== undefined)
      user.notificationPreferences.notifyOnInvitation = data.notifyOnInvitation;

    if (data.password) {
      if (user.googleId) {
        throw new BadRequestException({
          message: 'Password cannot be changed for accounts linked to Google.',
          errorCode: 'ERR_GOOGLE_ACCOUNT_PASSWORD_CHANGE',
        });
      }
      this.validatePasswordFormat(data.password);
      user.password = await bcrypt.hash(data.password, 10);
    }

    const savedUser = await this.usersRepository.save(user);
    const { password, notificationPreferences, ...result } = savedUser;
    return {
      ...result,
      notifyOnNewSpool: notificationPreferences?.notifyOnNewSpool ?? true,
      notifyOnConsumption: notificationPreferences?.notifyOnConsumption ?? true,
      notifyOnSystem: notificationPreferences?.notifyOnSystem ?? true,
      notifyOnLowStock: notificationPreferences?.notifyOnLowStock ?? true,
      notifyOnInvitation: notificationPreferences?.notifyOnInvitation ?? true,
    };
  }

  async setActiveOrganization(
    userId: number,
    organizationId: number,
  ): Promise<{ activeOrganizationId: number }> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: { userOrganizations: true },
    });
    if (!user) throw new BadRequestException('User not found');

    // Verify user belongs to this organization
    const belongsToOrg = user.userOrganizations?.some(
      (uo) => uo.organizationId === organizationId && uo.hasConfirmed !== false,
    );
    if (!belongsToOrg) {
      throw new BadRequestException(
        'User does not belong to this organization',
      );
    }

    user.activeOrganizationId = organizationId;
    await this.usersRepository.save(user);

    return { activeOrganizationId: organizationId };
  }

  async socialLogin(dto: SocialLoginDto) {
    console.log(`[SocialLogin] New request for provider: ${dto.provider}`);
    let email: string;
    let googleId: string;
    let socialDisplayName: string;

    if (dto.provider === 'google') {
      const token = (dto as any).token || dto.socialId;
      console.log(`[SocialLogin] Token present: ${!!token}, length: ${token?.length}`);
      if (!token) {
        console.error('[SocialLogin] Missing token for Google login');
        throw new BadRequestException('Social Google ID or Token is required');
      }

      // The web sends a Google JWT credential in socialId or token.
      // The mobile sends the idToken (JWT) in token.
      if (token.includes('.')) {
        // Secure verification using Google's official library
        try {
          const client = new OAuth2Client();
          const audiences = [
            this.configService.get<string>('GOOGLE_CLIENT_ID_WEB'),
            this.configService.get<string>('GOOGLE_CLIENT_ID_IOS'),
            this.configService.get<string>('GOOGLE_CLIENT_ID_ANDROID'),
          ].filter(Boolean) as string[];

          console.log(
            `[SocialLogin] Verifying Google token for audiences:`,
            audiences,
          );

          const ticket = await client.verifyIdToken({
            idToken: token,
            audience: audiences,
          });

          const payload = ticket.getPayload();
          if (!payload) throw new Error('No payload in Google ticket');

          googleId = payload.sub; // The unique Google user ID
          email = (payload.email || '').toLowerCase();
          socialDisplayName =
            payload.name ||
            payload.given_name ||
            (email ? email.split('@')[0] : 'Google User');

          if (!email && dto.email) {
            console.warn(
              '[SocialLogin] Email missing from token but provided in DTO. Using DTO email as fallback.',
            );
            email = dto.email.toLowerCase();
          }

          console.log(
            `[SocialLogin] Verified Google Token: sub=${googleId}, email=${email}, name=${socialDisplayName}`,
          );
        } catch (e) {
          console.error('[SocialLogin] Failed to verify Google Token', e);
          throw new BadRequestException(
            `Invalid Google ID Token: ${e.message}`,
          );
        }
      } else {
        // Fallback for plain socialId (only if no JWT was provided)
        console.warn(
          '[SocialLogin] No JWT provided, using plain socialId. This is less secure.',
        );
        googleId = token;
        email = (dto.email || (dto as any).username || '').toLowerCase();
        socialDisplayName =
          dto.displayName || (email ? email.split('@')[0] : 'Google User');
      }
    } else if (dto.provider === 'apple') {
      const token = dto.token;
      if (!token) {
        throw new BadRequestException('Apple Identity Token is required');
      }

      try {
        const applePayload = await this.verifyAppleToken(token);

        const appleId = applePayload.sub;
        email = this.normalizeEmail(applePayload.email || dto.email);
        
        // Use name from DTO (often sent ONLY on first login)
        socialDisplayName = dto.displayName || (dto.firstName ? `${dto.firstName} ${dto.lastName}` : (email ? email.split('@')[0] : 'Apple User'));
        
        return this.handleAppleLogin(appleId, email || null, socialDisplayName, dto);

      } catch (e) {
        if (e instanceof BadRequestException) {
          throw e;
        }
        console.error('[SocialLogin] Failed to verify Apple Token', e);
        throw new BadRequestException(`Invalid Apple Identity Token: ${e.message}`);
      }
    } else {
      throw new BadRequestException('Unsupported provider');
    }

    // 1. Try to find user by social ID
    let user = await this.usersRepository.findOne({
      where: { googleId },
      relations: { userOrganizations: { organization: true } },
    });

    // CRITICAL FIX: If the found user is inactive, detach the social ID and continue
    // This allows the user to "recover" their Google identity on a new active account
    if (user && !user.isActive) {
      console.warn(
        `[SocialLogin] Detaching Google ID from inactive user: ${user.username}`,
      );
      user.googleId = null;
      await this.usersRepository.save(user);
      user = null; // Continue to step 2/3
    }

    if (user) {
      // Update email if missing or changed, and mark as verified via Google
      let needsSave = false;
      if (user.email !== email) {
        user.email = email;
        needsSave = true;
      }
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        needsSave = true;
      }
      if (needsSave) {
        await this.usersRepository.save(user);
      }
    } else {
      // 2. If not found by social ID, try to find by email (ONLY ACTIVE USERS)
      if (email) {
        user = await this.usersRepository.findOne({
          where: { email, isActive: true },
          relations: { userOrganizations: { organization: true } },
        });
      }

      if (user) {
        // Link social account to existing email account and mark as verified
        user.googleId = googleId;
        user.isEmailVerified = true;
        await this.usersRepository.save(user);
      }
    }

    // 3. If still not found, create a new "partial" user
    if (!user) {
      const tempUsername = `tmp-social-${crypto.randomBytes(4).toString('hex')}`;
      user = this.usersRepository.create({
        username: tempUsername,
        email: email,
        googleId: googleId,
        displayName: dto.displayName || socialDisplayName,
        isActive: true, // Social users are active by default
        isEmailVerified: true, // Google verifies email
        notificationPreferences: new UserNotificationPreference(),
      });
      user = await this.usersRepository.save(user);
    }

    // 4. Verify account is active
    if (!user.isActive) {
      console.warn(
        `[SocialLogin] Attempted login for inactive user: ${user.username} (${user.email})`,
      );
      throw new UnauthorizedException('Account is disabled');
    }

    return this.generateLoginResponse(user);
  }

  async completeSocialSignup(
    jwtUser: any,
    dto: { username: string; organizationName: string },
  ) {
    // Fetch full user from DB to avoid partial object issues / duplicates
    const user = await this.usersRepository.findOne({
      where: { id: jwtUser.id || jwtUser.userId },
      relations: { userOrganizations: { organization: true } },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.username.startsWith('tmp-social-')) {
      throw new BadRequestException('Account is already complete');
    }

    const sanitizedUsername = dto.username
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
    // Ensure username is not already taken
    const existingUser = await this.usersRepository.findOne({
      where: { username: sanitizedUsername },
    });
    if (existingUser && existingUser.id !== user.id) {
      throw new BadRequestException('Username already taken');
    }

    // Update user properties
    user.username = sanitizedUsername;
    user.isEmailVerified = true; // Safety: social logins are always verified
    await this.usersRepository.save(user);

    // Create initial organization
    await this.organizationService.create(dto.organizationName, user.id);

    // Re-fetch user with new organization
    const updatedUser = await this.usersRepository.findOne({
      where: { id: user.id },
      relations: { userOrganizations: { organization: true } },
    });

    return this.generateLoginResponse(updatedUser!);
  }

  async linkSocialProvider(userId: number, dto: SocialLoginDto) {
    const currentUser = await this.usersRepository.findOne({
      where: { id: userId, isActive: true },
      relations: { userOrganizations: { organization: true } },
    });

    if (!currentUser) {
      throw new BadRequestException('User not found');
    }

    if (dto.provider === 'apple') {
      try {
        const token = dto.token;
        if (!token) {
          throw new BadRequestException('Apple Identity Token is required');
        }

        const applePayload = await this.verifyAppleToken(token);
        const appleId = applePayload.sub;

        await this.ensureSocialIdCanBeLinked('apple', appleId, currentUser.id);
        currentUser.appleId = appleId;

        const email = this.normalizeEmail(applePayload.email || dto.email);
        if (email && !this.isApplePrivateRelayEmail(email) && !currentUser.email) {
          currentUser.email = email;
        }

        currentUser.isEmailVerified = true;
        await this.usersRepository.save(currentUser);
        return this.generateLoginResponse(currentUser);
      } catch (e) {
        if (e instanceof BadRequestException || e instanceof ConflictException) {
          throw e;
        }
        throw new BadRequestException(`Invalid Apple Identity Token: ${e.message}`);
      }
    }

    if (dto.provider === 'google') {
      try {
        const token = (dto as any).token || dto.socialId;
        if (!token) {
          throw new BadRequestException('Social Google ID or Token is required');
        }

        let googleId: string;
        let email = (dto.email || '').toLowerCase();

        if (token.includes('.')) {
          const client = new OAuth2Client();
          const audiences = [
            this.configService.get<string>('GOOGLE_CLIENT_ID_WEB'),
            this.configService.get<string>('GOOGLE_CLIENT_ID_IOS'),
            this.configService.get<string>('GOOGLE_CLIENT_ID_ANDROID'),
          ].filter(Boolean) as string[];
          const ticket = await client.verifyIdToken({
            idToken: token,
            audience: audiences,
          });
          const payload = ticket.getPayload();
          if (!payload) throw new BadRequestException('Invalid Google ID Token');
          googleId = payload.sub;
          email = (payload.email || email).toLowerCase();
        } else {
          googleId = token;
        }

        await this.ensureSocialIdCanBeLinked('google', googleId, currentUser.id);
        currentUser.googleId = googleId;
        if (email && !currentUser.email) {
          currentUser.email = email;
        }
        currentUser.isEmailVerified = true;
        await this.usersRepository.save(currentUser);
        return this.generateLoginResponse(currentUser);
      } catch (e) {
        if (e instanceof BadRequestException || e instanceof ConflictException) {
          throw e;
        }
        throw new BadRequestException(`Invalid Google ID Token: ${e.message}`);
      }
    }

    throw new BadRequestException('Unsupported provider');
  }

  async unlinkSocialProvider(userId: number, provider: 'google' | 'apple') {
    if (provider !== 'google' && provider !== 'apple') {
      throw new BadRequestException('Unsupported provider');
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId, isActive: true },
      relations: { userOrganizations: { organization: true } },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const field = provider === 'apple' ? 'appleId' : 'googleId';
    const otherField = provider === 'apple' ? 'googleId' : 'appleId';

    if (!user[field]) {
      return this.generateLoginResponse(user);
    }

    const hasPasswordLogin = !!user.password;
    const hasOtherSocialLogin = !!user[otherField];

    if (!hasPasswordLogin && !hasOtherSocialLogin) {
      throw new BadRequestException(
        'Cannot unlink the only sign-in method. Add a password or another social login first.',
      );
    }

    user[field] = null;
    await this.usersRepository.save(user);
    return this.generateLoginResponse(user);
  }

  async deleteAccount(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Anonymize user to preserve referential integrity (projects, orgs, etc.)
    user.firstName = 'Utilisateur';
    user.lastName = 'Supprimé';
    user.displayName = 'Utilisateur Supprimé';
    user.email = `${user.id}-deleted@spoolytracker.local`;
    user.password = '';
    user.googleId = null;
    user.appleId = null;
    user.isActive = false;
    user.verificationToken = '';
    user.resetPasswordToken = null;
    user.stripeCustomerId = '';
    
    // Scramble the username so they can re-register if they want
    user.username = `deleted-${user.id}-${crypto.randomBytes(4).toString('hex')}`;

    await this.usersRepository.save(user);
    
    return { message: 'Account successfully deleted' };
  }

  private async handleAppleLogin(appleId: string, email: string | null, socialDisplayName: string, dto: SocialLoginDto) {
    if (!appleId) {
      throw new BadRequestException('Apple user identifier is required');
    }

    const isPrivateRelayEmail = this.isApplePrivateRelayEmail(email);

    // 1. Try to find user by social ID
    let user = await this.usersRepository.findOne({
      where: { appleId },
      relations: { userOrganizations: { organization: true } },
    });

    // If found user is inactive, detach and continue
    if (user && !user.isActive) {
      console.warn(`[AppleLogin] Detaching Apple ID from inactive user: ${user.username}`);
      user.appleId = null;
      await this.usersRepository.save(user);
      user = null;
    }

    if (user) {
      // Update email if missing or changed
      let needsSave = false;
      if (email && !isPrivateRelayEmail && user.email !== email) {
        user.email = email;
        needsSave = true;
      }
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        needsSave = true;
      }
      if (needsSave) await this.usersRepository.save(user);
    } else {
      // 2. Try by email if active, but never link Apple's private relay address
      // to an existing classic account. The stable Apple subject is the safe key.
      if (email && !isPrivateRelayEmail) {
        user = await this.usersRepository.findOne({
          where: { email: ILike(email), isActive: true },
          relations: { userOrganizations: { organization: true } },
        });

        if (user) {
          if (user.appleId && user.appleId !== appleId) {
            throw new ConflictException(
              'This email is already linked to another Apple account.',
            );
          }

          user.appleId = appleId;
          user.isEmailVerified = true;
          await this.usersRepository.save(user);
        }
      }
    }

    // 3. Create new user
    if (!user) {
      const tempUsername = `tmp-social-${crypto.randomBytes(4).toString('hex')}`;
      user = this.usersRepository.create({
        username: tempUsername,
        email: email || undefined,
        appleId: appleId,
        displayName: dto.displayName || socialDisplayName,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isActive: true,
        isEmailVerified: true,
        notificationPreferences: new UserNotificationPreference(),
      });
      user = await this.usersRepository.save(user);
    }

    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    return this.generateLoginResponse(user);
  }

  private isApplePrivateRelayEmail(email?: string | null): boolean {
    return !!email?.toLowerCase().endsWith('@privaterelay.appleid.com');
  }

  private normalizeEmail(email?: string | null): string {
    return (email || '').toLowerCase().trim();
  }

  private async verifyAppleToken(token: string) {
    try {
      console.log(`[AppleAuth] Verifying Apple token...`);
      const audiences = [
        this.configService.get<string>('APPLE_CLIENT_ID'),
        'com.spoolytracker',
        'com.spoolytracker.dev',
      ].filter(Boolean) as string[];

      return await appleSignin.verifyIdToken(token, {
        audience: audiences,
      });
    } catch (e) {
      console.error('[AppleAuth] Failed to verify Apple Token', e);
      throw new BadRequestException(`Invalid Apple Identity Token: ${e.message}`);
    }
  }

  private async ensureSocialIdCanBeLinked(
    provider: 'apple' | 'google',
    socialId: string,
    currentUserId: number,
  ) {
    const field = provider === 'apple' ? 'appleId' : 'googleId';
    const existing = await this.usersRepository.findOne({
      where: { [field]: socialId } as any,
    });

    if (!existing || existing.id === currentUserId) {
      return;
    }

    if (existing.isActive === false) {
      (existing as any)[field] = null;
      await this.usersRepository.save(existing);
      return;
    }

    throw new ConflictException(
      `This ${provider} account is already linked to another user.`,
    );
  }
}
