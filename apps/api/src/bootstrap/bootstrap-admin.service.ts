import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../auth/user.entity';
import { OrganizationService } from '../organization/organization.service';

const MIN_PASSWORD_LENGTH = 12;
const DEFAULT_ORG_NAME = 'Self-hosted Organization';

/**
 * On self-hosted deployments, create the initial super-admin (and its
 * organization) from the BOOTSTRAP_ADMIN_* environment variables so the stack
 * is usable right after `docker compose up`. Idempotent and a no-op outside of
 * self-hosting.
 */
@Injectable()
export class BootstrapAdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapAdminService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly organizationService: OrganizationService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureAdmin();
    } catch (error) {
      // Never let bootstrap seeding prevent the API from starting.
      this.logger.error(
        `Bootstrap admin provisioning failed: ${(error as Error).message}`,
      );
    }
  }

  async ensureAdmin(): Promise<void> {
    if (this.config.get<string>('SELF_HOSTED') !== 'true') {
      return;
    }

    const username = this.config
      .get<string>('BOOTSTRAP_ADMIN_USERNAME')
      ?.trim();
    const email = this.config.get<string>('BOOTSTRAP_ADMIN_EMAIL')?.trim();
    const password = this.config.get<string>('BOOTSTRAP_ADMIN_PASSWORD');
    const orgName =
      this.config.get<string>('BOOTSTRAP_ORGANIZATION_NAME')?.trim() ||
      DEFAULT_ORG_NAME;

    if (!username || !email || !password) {
      this.logger.warn(
        'SELF_HOSTED is enabled but BOOTSTRAP_ADMIN_USERNAME/EMAIL/PASSWORD are not all set; skipping admin bootstrap.',
      );
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      this.logger.error(
        `BOOTSTRAP_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters; skipping admin bootstrap.`,
      );
      return;
    }

    const normalizedUsername = username.toLowerCase();
    const normalizedEmail = email.toLowerCase();

    const existing = await this.userRepository.findOne({
      where: [{ username: normalizedUsername }, { email: normalizedEmail }],
    });
    if (existing) {
      this.logger.log(
        `Bootstrap admin already present (username="${existing.username}"); nothing to do.`,
      );
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      systemRole: 'super_admin',
      isSuperAdmin: true,
      isActive: true,
      isEmailVerified: true,
    });
    const savedUser = await this.userRepository.save(user);
    this.logger.log(
      `Bootstrap super admin created (username="${savedUser.username}").`,
    );

    try {
      const org = await this.organizationService.create(orgName, savedUser.id);
      this.logger.log(
        `Bootstrap organization created: "${org.name}" (#${org.id}).`,
      );
    } catch (error) {
      this.logger.error(
        `Bootstrap admin was created but its organization could not be: ${(error as Error).message}`,
      );
    }
  }
}
