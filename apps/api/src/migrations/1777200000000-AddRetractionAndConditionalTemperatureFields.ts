import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRetractionAndConditionalTemperatureFields1777200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('filament');
    if (!table) return;

    if (!table.findColumnByName('retractionDistanceMm')) {
      await queryRunner.query(
        `ALTER TABLE "filament" ADD "retractionDistanceMm" double precision`,
      );
    }
    if (!table.findColumnByName('retractionSpeedMmS')) {
      await queryRunner.query(
        `ALTER TABLE "filament" ADD "retractionSpeedMmS" double precision`,
      );
    }
    if (!table.findColumnByName('retractionZHopMm')) {
      await queryRunner.query(
        `ALTER TABLE "filament" ADD "retractionZHopMm" double precision`,
      );
    }
    if (!table.findColumnByName('retractionNotes')) {
      await queryRunner.query(
        `ALTER TABLE "filament" ADD "retractionNotes" text`,
      );
    }
    if (!table.findColumnByName('conditionalTemperatureRules')) {
      await queryRunner.query(
        `ALTER TABLE "filament" ADD "conditionalTemperatureRules" text`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN IF EXISTS "conditionalTemperatureRules"`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN IF EXISTS "retractionNotes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN IF EXISTS "retractionZHopMm"`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN IF EXISTS "retractionSpeedMmS"`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN IF EXISTS "retractionDistanceMm"`,
    );
  }
}
