import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { User } from './user.entity';
import { OrganizationModule } from '../organization/organization.module';
import { EmailModule } from '../email/email.module';
import { FilamentModule } from '../filament/filament.module';

import { UserNotificationPreference } from '../notification/user-notification-preference.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserNotificationPreference]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRATION', '7d') },
      }),
      inject: [ConfigService],
    }),
    OrganizationModule,
    EmailModule,
    FilamentModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
