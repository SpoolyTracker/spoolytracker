import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/logger/logger.config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PublicApiModule } from './public-api/public-api.module';

function getAllowedCorsOrigins(): string[] {
  return [
    process.env.CORS_ORIGINS,
    process.env.FRONTEND_URL,
    process.env.DASHBOARD_URL,
    process.env.APP_URL,
    process.env.LANDING_URL,
    process.env.PUBLIC_LANDING_URL,
    'https://spoolytracker.com',
    'https://www.spoolytracker.com',
    'https://test.spoolytracker.com',
  ]
    .filter(Boolean)
    .flatMap((value) => value!.split(','))
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger: WinstonModule.createLogger(winstonConfig),
  });
  const bodyLimit =
    process.env.REQUEST_BODY_LIMIT || process.env.JSON_BODY_LIMIT || '25mb';
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });

  // Trust proxy is required for secure cookies behind Nginx
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const allowedOrigins = getAllowedCorsOrigins();
  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = origin.replace(/\/$/, '');

      if (
        allowedOrigins.includes(normalizedOrigin) ||
        (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin))
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  const publicConfig = new DocumentBuilder()
    .setTitle('SpoolyTracker Public API')
    .setDescription('Public API for third-party integrations')
    .setVersion('1.0')
    .addTag('public-api')
    .addBearerAuth()
    .build();
  const publicDocumentFactory = () =>
    SwaggerModule.createDocument(app, publicConfig, {
      include: [PublicApiModule],
    });
  SwaggerModule.setup('public-api/docs', app, publicDocumentFactory);

  if (!isProduction) {
    const config = new DocumentBuilder()
    .setTitle('GCode Analyzer Swagger')
    .setDescription('GCode Analyzer API description')
    .setVersion('1.0')
    .addTag('gcode')
    .addBearerAuth()
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-organization-id',
        in: 'header',
        description: 'Organisation identifier',
      },
      'x-organization-id',
    )
    .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, documentFactory);
  }
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
