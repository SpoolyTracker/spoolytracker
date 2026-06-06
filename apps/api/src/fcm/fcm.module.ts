import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { FcmService } from './fcm.service';
import { FcmController } from './fcm.controller';
import { User } from '../auth/user.entity';
import { UserOrganization } from '../organization/user-organization.entity';
import { PushToken } from './entities/push-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserOrganization, PushToken]),
    ConfigModule,
  ],
  controllers: [FcmController],
  providers: [FcmService],
  exports: [FcmService],
})
export class FcmModule {}
