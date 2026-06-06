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
    console.log('🚀 Starting migration...\n');

    // 1. Create or find admin user
    let adminUser = await userRepository.findOne({
      where: { username: 'admin' },
    });

    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      adminUser = userRepository.create({
        username: 'admin',
        password: hashedPassword,
        isSuperAdmin: true, // Make admin a super admin
      });
      adminUser = await userRepository.save(adminUser);
      console.log('✅ Admin user created: admin/admin (Super Admin)');
    } else {
      // Update existing admin to be super admin
      if (!adminUser.isSuperAdmin) {
        adminUser.isSuperAdmin = true;
        await userRepository.save(adminUser);
        console.log('✅ Admin user updated to Super Admin');
      } else {
        console.log('ℹ️  Admin user already exists (Super Admin)');
      }
    }

    // 2. Create default organization
    let defaultOrg;
    const existingOrgs = await organizationService.findByUser(adminUser.id);

    if (existingOrgs.length === 0) {
      defaultOrg = await organizationService.create(
        'Default Organization',
        adminUser.id,
      );
      console.log(
        `✅ Default organization created: ${defaultOrg.name} (ID: ${defaultOrg.id})`,
      );
    } else {
      defaultOrg = existingOrgs[0].organization;
      console.log(
        `ℹ️  Using existing organization: ${defaultOrg.name} (ID: ${defaultOrg.id})`,
      );
    }

    // 3. Migrate existing filaments to default organization
    const filamentsWithoutOrg = await filamentRepository.find({
      where: { organizationId: null as any },
    });

    if (filamentsWithoutOrg.length > 0) {
      console.log(
        `\n📦 Found ${filamentsWithoutOrg.length} filament(s) without organization`,
      );
      console.log('   Assigning them to default organization...');

      for (const filament of filamentsWithoutOrg) {
        filament.organizationId = defaultOrg.id;
        await filamentRepository.save(filament);
      }

      console.log(
        `✅ Migrated ${filamentsWithoutOrg.length} filament(s) to organization ${defaultOrg.id}`,
      );
    } else {
      console.log('\nℹ️  No filaments to migrate');
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - User: admin`);
    console.log(`   - Organization: ${defaultOrg.name} (ID: ${defaultOrg.id})`);
    console.log(`   - Filaments: ${filamentsWithoutOrg.length} migrated`);
    console.log('\n🚀 Next steps:');
    console.log('   1. Start backend: npm run start:dev');
    console.log('   2. Login with: admin/admin');
    console.log(`   3. Use organization ID ${defaultOrg.id} in API calls`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
