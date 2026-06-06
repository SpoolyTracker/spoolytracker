import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { OrganizationService } from './organization/organization.service';
import { Repository } from 'typeorm';
import { User } from './auth/user.entity';
import { Filament } from './filament/filament.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const organizationService = app.get(OrganizationService);
  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
  const filamentRepository = app.get<Repository<Filament>>(
    getRepositoryToken(Filament),
  );

  try {
    console.log('🚀 Starting seed...\n');

    // Create test users
    const users = [
      {
        username: 'superadmin',
        password: 'superadmin',
        isSuperAdmin: true,
        firstName: 'Super',
        lastName: 'Admin',
        email: 'superadmin@example.com',
      },
      {
        username: 'user1',
        password: 'user1',
        isSuperAdmin: false,
        firstName: 'John',
        lastName: 'Doe',
        email: 'user1@example.com',
      },
      {
        username: 'user2',
        password: 'user2',
        isSuperAdmin: false,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'user2@example.com',
      },
    ];

    const createdUsers = [];

    for (const userData of users) {
      let user = await userRepository.findOne({
        where: { username: userData.username },
      });

      if (!user) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        user = userRepository.create({
          username: userData.username,
          password: hashedPassword,
          isSuperAdmin: userData.isSuperAdmin,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
        });
        user = await userRepository.save(user);
        console.log(
          `✅ User created: ${userData.username}/${userData.password} ${userData.isSuperAdmin ? '(Super Admin)' : ''}`,
        );
      } else {
        // Update existing user
        if (user.isSuperAdmin !== userData.isSuperAdmin) {
          user.isSuperAdmin = userData.isSuperAdmin;
          await userRepository.save(user);
          console.log(
            `✅ User updated: ${userData.username} ${userData.isSuperAdmin ? '(Super Admin)' : ''}`,
          );
        } else {
          console.log(`ℹ️  User already exists: ${userData.username}`);
        }
      }

      createdUsers.push(user);
    }

    // Create organizations for each non-admin user
    for (let i = 1; i < createdUsers.length; i++) {
      const user = createdUsers[i];
      const existingOrgs = await organizationService.findByUser(user.id);

      if (existingOrgs.length === 0) {
        const orgName = `${user.firstName}'s Organization`;
        const org = await organizationService.create(orgName, user.id);
        console.log(
          `✅ Organization created: ${orgName} (ID: ${org.id}) for ${user.username}`,
        );
      } else {
        console.log(
          `ℹ️  ${user.username} already has ${existingOrgs.length} organization(s)`,
        );
      }
    }

    // Migrate orphan filaments to first organization
    const filamentsWithoutOrg = await filamentRepository.find({
      where: { organizationId: null as any },
    });

    if (filamentsWithoutOrg.length > 0) {
      const firstOrg = await organizationService.findByUser(createdUsers[1].id);
      if (firstOrg.length > 0) {
        console.log(
          `\n📦 Found ${filamentsWithoutOrg.length} filament(s) without organization`,
        );
        console.log(`   Assigning them to ${firstOrg[0].organization.name}...`);
        const targetOrgId = firstOrg[0].organization.id;

        for (const filament of filamentsWithoutOrg) {
          filament.organizationId = targetOrgId;
          await filamentRepository.save(filament);
        }

        console.log(`✅ Migrated ${filamentsWithoutOrg.length} filament(s)`);
      }
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('┌─────────────┬──────────────┬─────────────────┐');
    console.log('│ Username    │ Password     │ Role            │');
    console.log('├─────────────┼──────────────┼─────────────────┤');
    console.log('│ superadmin  │ superadmin   │ 🔐 Super Admin  │');
    console.log('│ user1       │ user1        │ 👤 Regular User │');
    console.log('│ user2       │ user2        │ 👤 Regular User │');
    console.log('└─────────────┴──────────────┴─────────────────┘');
    console.log('\n🚀 Next steps:');
    console.log('   1. Start backend: npm run start:dev');
    console.log('   2. Login with any account above');
    console.log('   3. Super Admin can access Admin Panel at /admin');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
