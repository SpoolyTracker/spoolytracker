import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AppModule } from './app.module';
import { User } from './auth/user.entity';
import { OrganizationService } from './organization/organization.service';
import { isSelfHosted } from './common/self-hosted';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when SELF_HOSTED=true`);
  }
  return value;
}

async function bootstrap() {
  if (!isSelfHosted()) {
    return;
  }

  const username = requireEnv('BOOTSTRAP_ADMIN_USERNAME').toLowerCase();
  const email = requireEnv('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('BOOTSTRAP_ADMIN_PASSWORD');
  const organizationName =
    process.env.BOOTSTRAP_ORGANIZATION_NAME?.trim() || 'Self-hosted Organization';

  if (password.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters long');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
    const organizationService = app.get(OrganizationService);

    let user = await userRepository.findOne({
      where: [{ username }, { email }],
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    if (!user) {
      user = userRepository.create({
        username,
        email,
        password: hashedPassword,
      });
    } else {
      user.username = username;
      user.email = email;
      user.password = hashedPassword;
    }

    user.displayName = user.displayName || 'Self-hosted Admin';
    user.firstName = user.firstName || 'Self-hosted';
    user.lastName = user.lastName || 'Admin';
    user.isActive = true;
    user.isEmailVerified = true;
    user.isSuperAdmin = true;
    user.systemRole = 'super_admin';
    user.failedLoginAttempts = 0;
    user.loginLockedUntil = null;

    const savedUser = await userRepository.save(user);
    const memberships = await organizationService.findByUser(savedUser.id);

    if (!memberships.length) {
      await organizationService.create(organizationName, savedUser.id);
    }

    console.log(`Self-hosted superadmin ready: ${username}`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('Self-hosted bootstrap failed:', error);
  process.exit(1);
});
