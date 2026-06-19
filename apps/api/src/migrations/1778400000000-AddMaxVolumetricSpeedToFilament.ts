import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaxVolumetricSpeedToFilament1778400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('filament');
    if (!table) return;

    if (!table.findColumnByName('maxVolumetricSpeedMm3S')) {
      await queryRunner.query(
        `ALTER TABLE "filament" ADD "maxVolumetricSpeedMm3S" double precision`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN IF EXISTS "maxVolumetricSpeedMm3S"`,
    );
  }
}
