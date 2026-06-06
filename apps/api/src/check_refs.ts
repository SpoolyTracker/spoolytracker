import { AppDataSource } from './data-source';
import { Filament } from './filament/filament.entity';

async function check() {
  await AppDataSource.initialize();
  const filamentRepo = AppDataSource.getRepository(Filament);
  const filaments = await filamentRepo.find({ take: 10 });

  console.log('--- Filament References Check ---');
  filaments.forEach((f) => {
    console.log(`ID: ${f.id}, Ref: ${f.spoolReference || 'NULL'}`);
  });

  const countNull = await filamentRepo.count({
    where: { spoolReference: null as any },
  });
  console.log(`Total with NULL reference: ${countNull}`);

  await AppDataSource.destroy();
}

check().catch(console.error);
