import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FilamentModule } from './filament/filament.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { AdminModule } from './admin/admin.module';
import { StripeModule } from './stripe/stripe.module';
import { GcodeModule } from './gcode/gcode.module';
import { TenantMiddleware } from './common/tenant.middleware';
import { MailerModule } from '@nestjs-modules/mailer';
import { EmailModule } from './email/email.module';
import { NotificationModule } from './notification/notification.module';
import { TigerTagModule } from './tigertag/tigertag.module';
import { ProjectsModule } from './projects/projects.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AiAgentModule } from './ai/ai-agent.module';
import { FcmModule } from './fcm/fcm.module';
import { UploadsController } from './uploads/uploads.controller';
import { BullModule } from '@nestjs/bullmq';
import { VersionModule } from './version/version.module';
import { PublicController } from './public/public.controller';
import { SupportModule } from './support/support.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PublicApiModule } from './public-api/public-api.module';
import { BootstrapAdminModule } from './bootstrap/bootstrap-admin.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST') || 'localhost',
        port: config.get<number>('DB_PORT') || 5432,
        username: config.get<string>('DB_USERNAME') || 'filament_user',
        password: config.get<string>('DB_PASSWORD') || 'filament_password',
        database: config.get<string>('DB_DATABASE') || 'filament_manager',
        entities: [join(__dirname, '**', '*.entity.{ts,js}')],
        synchronize: false,
        migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
        migrationsRun: true,
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: config.get<number>('REDIS_PORT') || 6379,
          password: config.get<string>('REDIS_PASSWORD'),
          tls: config.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
        },
      }),
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get('SMTP_HOST'),
          port: Number(config.get('SMTP_PORT')) || 587,
          secure: Number(config.get('SMTP_PORT')) === 465,
          auth: {
            user: config.get('SMTP_USER'),
            pass: config.get('SMTP_PASS'),
          },
          tls: {
            rejectUnauthorized: false,
          },
        },
        defaults: {
          from: `"Spoolytracker" <${config.get('SMTP_FROM')}>`,
        },
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    FilamentModule,
    AuthModule,
    OrganizationModule,
    AdminModule,
    StripeModule,
    GcodeModule,
    EmailModule,
    NotificationModule,
    TigerTagModule,
    ProjectsModule,
    AiAgentModule,
    FcmModule,
    VersionModule,
    SupportModule,
    ApiKeysModule,
    IntegrationsModule,
    PublicApiModule,
    BootstrapAdminModule,
  ],
  controllers: [AppController, UploadsController, PublicController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('filaments', 'projects', 'gcode', 'upload', 'ai', 'api-keys');
  }
}
