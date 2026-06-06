import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { OrganizationService } from './organization/organization.service';
import { Repository } from 'typeorm';
import { User } from './auth/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const organizationService = app.get(OrganizationService);
  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));

  try {
    // Create or find admin user
    let adminUser = await userRepository.findOne({
      where: { username: 'admin' },
    });

    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      adminUser = userRepository.create({
        username: 'admin',
        password: hashedPassword,
      });
      adminUser = await userRepository.save(adminUser);
      console.log('✅ Admin user created: admin/admin');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Create default organization
    const existingOrgs = await organizationService.findByUser(adminUser.id);

    if (existingOrgs.length === 0) {
      const defaultOrg = await organizationService.create(
        'Default Organization',
        adminUser.id,
      );
      console.log(
        `✅ Default organization created: ${defaultOrg.name} (ID: ${defaultOrg.id})`,
      );
      console.log(`   Slug: ${defaultOrg.slug}`);
      console.log(`   Plan: ${defaultOrg.plan}`);
      console.log(`   Owner: admin`);
    } else {
      console.log(
        `ℹ️  User already has ${existingOrgs.length} organization(s)`,
      );
      existingOrgs.forEach((userOrg) => {
        const org = userOrg.organization;
        console.log(`   - ${org.name} (${org.slug}) - ${org.plan}`);
      });
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the backend: npm run start:dev');
    console.log('2. Login with: admin/admin');
    console.log(
      '3. Use organization ID in API calls via header: x-organization-id',
    );
  } catch (error) {
    console.error('❌ Seed failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
