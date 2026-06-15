import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private setAuthCookie(response: Response, token: string) {
    const cookieOptions: any = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    };

    if (process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }

    response.cookie('access_token', token, cookieOptions);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: { username: string; password: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      loginDto.username,
      loginDto.password,
    );

    this.setAuthCookie(response, result.access_token);

    return result;
  }

  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  async socialLogin(
    @Body() socialLoginDto: SocialLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.socialLogin(socialLoginDto);

    this.setAuthCookie(response, result.access_token);

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('complete-social-signup')
  @HttpCode(HttpStatus.OK)
  async completeSocialSignup(
    @Request() req: any,
    @Body() body: { username: string; organizationName: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.completeSocialSignup(req.user, body);

    this.setAuthCookie(response, result.access_token);

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('link-social')
  @HttpCode(HttpStatus.OK)
  async linkSocialProvider(
    @Request() req: any,
    @Body() socialLoginDto: SocialLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.linkSocialProvider(
      req.user.id,
      socialLoginDto,
    );

    this.setAuthCookie(response, result.access_token);

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('unlink-social')
  @HttpCode(HttpStatus.OK)
  async unlinkSocialProvider(
    @Request() req: any,
    @Body() body: { provider: 'google' | 'apple' },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.unlinkSocialProvider(
      req.user.id,
      body.provider,
    );

    this.setAuthCookie(response, result.access_token);

    return result;
  }

  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    const user = await this.authService.signup(signupDto);
    return {
      id: user.id,
      username: user.username,
      message: 'Inscription réussie. Veuillez vérifier votre email.',
    };
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string, @Query('id') id?: string) {
    if (!token) {
      throw new BadRequestException('Token manquant');
    }

    const userId = id ? parseInt(id, 10) : undefined;
    const result = await this.authService.verifyEmail(token, userId);

    if (result === 'invalid') {
      throw new BadRequestException('Token invalide ou expiré');
    }

    if (result === 'already_verified') {
      return { message: 'Email déjà vérifié. Vous pouvez vous connecter.' };
    }

    return {
      message:
        'Email vérifié avec succès. Vous pouvez maintenant vous connecter.',
    };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() body: { email: string }) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    await this.authService.resendVerification(body.email);
    return {
      message:
        'Si un compte non vérifié existe avec cet email, un nouveau lien a été envoyé.',
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string }) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    await this.authService.forgotPassword(body.email);
    return {
      message:
        'Si cette adresse email correspond à un compte, un email de réinitialisation a été envoyé.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: { token: string; password: string }) {
    if (!body.token || !body.password) {
      throw new BadRequestException('Token and password are required');
    }
    const success = await this.authService.resetPassword(
      body.token,
      body.password,
    );
    if (!success) {
      throw new BadRequestException('Token invalide ou expiré');
    }
    return { message: 'Mot de passe réinitialisé avec succès.' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any) {
    console.log(`[Backend] getProfile CALLED for User ID: ${req.user.id}`);
    const user = await this.authService.findById(req.user.id);
    console.log(`[Backend] user: ${req.user.id}`);
    if (!user) {
      console.warn(
        `[Backend] getProfile: User ${req.user.id} not found in database`,
      );
      throw new BadRequestException('User not found');
    }

    const { password, notificationPreferences, ...result } = user;
    const organisations =
      user.userOrganizations?.map((uo) => ({
        id: uo.organization.id,
        name: uo.organization.name,
        role: uo.role,
        notifyOnAiAlerts: uo.notifyOnAiAlerts ?? true,
      })) || [];

    console.log(
      `[Backend] getProfile SUCCESS for ${user.username} (ID: ${user.id}). ActiveOrg: ${user.activeOrganizationId}, Orgs Count: ${organisations.length}`,
    );

    return {
      ...result,
      organisations, // Ensure organisations are returned as a list
      needsUsername: user.username.startsWith('tmp-social-'),
      activeOrganizationId: user.activeOrganizationId,
      notifyOnNewSpool: notificationPreferences?.notifyOnNewSpool ?? true,
      notifyOnConsumption: notificationPreferences?.notifyOnConsumption ?? true,
      notifyOnSystem: notificationPreferences?.notifyOnSystem ?? true,
      notifyOnLowStock: notificationPreferences?.notifyOnLowStock ?? true,
      notifyOnInvitation: notificationPreferences?.notifyOnInvitation ?? true,
      notifyOnAiRupture: notificationPreferences?.notifyOnAiRupture ?? true,
      notifyOnAiAchat: notificationPreferences?.notifyOnAiAchat ?? true,
      notifyOnAiProjet: notificationPreferences?.notifyOnAiProjet ?? true,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('session')
  async getSession(
    @Request() req: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.createSessionFromUserId(req.user.id);
    this.setAuthCookie(response, result.access_token);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req: any, @Body() body: any) {
    return this.authService.updateProfile(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('intro-seen')
  async setIntroSeen(@Request() req: any) {
    return this.authService.updateProfile(req.user.id, { introSeen: true });
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset-intro')
  async resetIntro(@Request() req: any) {
    return this.authService.updateProfile(req.user.id, { introSeen: false });
  }

  @UseGuards(JwtAuthGuard)
  @Post('active-organization')
  @HttpCode(HttpStatus.OK)
  async setActiveOrganization(
    @Request() req: any,
    @Body() body: { organizationId: number },
  ) {
    if (!body.organizationId) {
      throw new BadRequestException('organizationId is required');
    }
    return this.authService.setActiveOrganization(
      req.user.id ?? req.user.userId,
      body.organizationId,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token', {
      path: '/',
      domain: process.env.COOKIE_DOMAIN,
    });
    return { message: 'Déconnexion réussie' };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@Request() req: any, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.deleteAccount(req.user.id);
    response.clearCookie('access_token', {
      path: '/',
      domain: process.env.COOKIE_DOMAIN,
    });
    return result;
  }
}
