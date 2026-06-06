import { MigrationInterface, QueryRunner, IsNull } from 'typeorm';
import { Filament } from '../filament/filament.entity';

export class SafePopulateSpoolReference1773900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const filamentRepo = queryRunner.manager.getRepository(Filament);

    const allCount = await filamentRepo.count();
    console.log(`[Migration] Total filaments in DB: ${allCount}`);

    // Find all filaments with missing spoolReference
    const filaments = await filamentRepo.find({
      where: [{ spoolReference: IsNull() }, { spoolReference: '' }],
    });

    if (filaments && filaments.length > 0) {
      console.log(
        `[Migration] Found ${filaments.length} filaments without spoolReference. Generating...`,
      );

      for (const f of filaments) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let ref = '';
        for (let i = 0; i < 10; i++) {
          ref += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        f.spoolReference = ref;
      }

      await filamentRepo.save(filaments);
      console.log(
        `[Migration] Successfully populated references for ${filaments.length} filaments.`,
      );
    } else {
      console.log(
        `[Migration] No filaments found with missing spoolReference.`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
