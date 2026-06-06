import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [EmailModule, AuthModule],
  controllers: [SupportController],
})
export class SupportModule {}
