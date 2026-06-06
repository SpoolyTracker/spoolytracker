import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { OrganizationService } from '../src/organization/organization.service';
import { FilamentService } from '../src/filament/filament.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Organization } from '../src/organization/organization.entity';
import { Filament } from '../src/filament/filament.entity';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';

async function bootstrap() {
    console.log('Bootstrapping testing environment...');
    const app = await NestFactory.createApplicationContext(AppModule);

    const orgService = app.get(OrganizationService);
    const filService = app.get(FilamentService);
    const orgRepo = app.get<Repository<Organization>>(getRepositoryToken(Organization));
    const filRepo = app.get<Repository<Filament>>(getRepositoryToken(Filament));

    try {
        console.log('1. Creating a fresh test organization...');
        const randId = randomBytes(4).toString('hex');
        const org = await orgRepo.save({
            name: `Test Org ${randId}`,
            slug: `test-org-${randId}`,
            plan: 'pro',
            requiresQuotaSelection: false,
        });

        // We need a mock user to assign actions to. Assuming filament service might need it, but let's check
        const mockUser = { id: 1, userOrganisations: [{ id: org.id }] } as any;

        console.log('2. Creating 22 filaments for this organization...');
        const fIds = [];
        for (let i = 0; i < 22; i++) {
            // Skip calling the standard create if it requires too much structure, 
            // Or call create if there are no complex relations required.
            const f = await filRepo.save({
                color: `#ffffff`,
                organization: org,
                weightInitial: 1000,
                weightRemaining: 1000,
                isLocked: false
            });
            fIds.push(f.id);
        }
        console.log(`Created ${fIds.length} filaments.`);

        console.log('3. Triggering a downgrade to FREE plan...');
        await orgService.processDowngrade(org.id);

        const afterDowngrade = await orgRepo.findOne({ where: { id: org.id } });
        if (!afterDowngrade) throw new Error("Org not found");
        console.log(`Plan is now: ${afterDowngrade.plan}`);
        console.log(`Requires Quota Selection: ${afterDowngrade.requiresQuotaSelection}`);

        if (!afterDowngrade.requiresQuotaSelection) {
            throw new Error("Downgrade did NOT set requiresQuotaSelection to true!");
        }

        console.log('4. Testing operations while locked...');
        let createFailed = false;
        try {
            await filService.create({ color: '#000000' } as any, org.id, mockUser);
        } catch (e: any) {
            console.log(`Create rejected successfully: ${e.message}`);
            createFailed = true;
        }
        if (!createFailed) throw new Error("Create operation should have failed!");

        let updateFailed = false;
        try {
            await filService.update(fIds[0], { color: '#ff0000' } as any, org.id, mockUser);
        } catch (e: any) {
            console.log(`Update rejected successfully: ${e.message}`);
            updateFailed = true;
        }
        if (!updateFailed) throw new Error("Update operation should have failed!");

        console.log('5. Resolving Quota (Selecting 15 filaments)...');
        const selectedIds = fIds.slice(0, 15); // Pick first 15
        await orgService.resolveQuota(org.id, selectedIds);

        const resolvedOrg = await orgRepo.findOne({ where: { id: org.id } });
        if (!resolvedOrg) throw new Error("Org not found");
        console.log(`Resolved Requires Quota Selection: ${resolvedOrg.requiresQuotaSelection}`);
        if (resolvedOrg.requiresQuotaSelection) {
            throw new Error("resolveQuota did not turn off the flag!");
        }

        console.log('6. Validating filament locks...');
        const finalFilaments = await filRepo.find({ where: { organization: { id: org.id } } });
        const lockedCount = finalFilaments.filter(f => f.isLocked).length;
        const activeCount = finalFilaments.filter(f => !f.isLocked).length;

        console.log(`Active Filaments: ${activeCount} (Expected 15)`);
        console.log(`Locked Filaments: ${lockedCount} (Expected 7)`);

        if (activeCount !== 15 || lockedCount !== 7) {
            throw new Error("Incorrect number of locked/active filaments!");
        }

        console.log('7. Testing operations after resolution...');
        // The first 15 are active, the rest are locked
        const lockedFilamentId = fIds[16];
        let consumeLockedFailed = false;
        try {
            await filService.logConsumption(lockedFilamentId, 50, 'PRINT', 'Test', org.id, new Date(), undefined, mockUser.id, mockUser);
        } catch (e: any) {
            console.log(`Consume locked rejected successfully: ${e.message}`);
            consumeLockedFailed = true;
        }
        if (!consumeLockedFailed) throw new Error("Consume operation on locked filament should have failed!");

        // Cleanup
        console.log('8. Cleaning up test data...');
        await filRepo.delete(fIds);
        await orgRepo.delete(org.id);

        console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
    } catch (error) {
        console.error('❌ TEST FAILED:', error);
    } finally {
        await app.close();
    }
}

bootstrap();
