import { AppDataSource } from './data-source';
import { Filament } from './filament/filament.entity';
import { IsNull } from 'typeorm';

async function fix() {
  console.log('--- Initializing Data Source ---');
  await AppDataSource.initialize();

  const filamentRepo = AppDataSource.getRepository(Filament);

  // Find all filaments with missing spoolReference
  const filaments = await filamentRepo.find({
    where: [{ spoolReference: IsNull() }, { spoolReference: '' }],
  });

  console.log(`Found ${filaments.length} filaments without spoolReference.`);

  if (filaments.length > 0) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    for (const f of filaments) {
      let ref = '';
      for (let i = 0; i < 10; i++) {
        ref += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      f.spoolReference = ref;
    }

    console.log(`Updating ${filaments.length} filaments...`);
    await filamentRepo.save(filaments);
    console.log('Successfully updated all filaments.');
  }

  // Final check
  const countNull = await filamentRepo.count({
    where: [{ spoolReference: IsNull() }, { spoolReference: '' }],
  });
  console.log(`Total remaining with NULL/empty reference: ${countNull}`);

  await AppDataSource.destroy();
}

fix().catch((e) => {
  console.error('FAILED TO FIX REFS:', e);
  process.exit(1);
});
