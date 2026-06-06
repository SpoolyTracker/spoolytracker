import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnhancedFilamentFields1774300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add soft delete column (Postgres doesn't support IF NOT EXISTS in ALTER TABLE ADD directly for old versions, using a safer approach)
    const table = await queryRunner.getTable('filament');
    if (table) {
      if (!table.findColumnByName('deletedAt')) {
        await queryRunner.query(
          `ALTER TABLE "filament" ADD "deletedAt" TIMESTAMP`,
        );
      }
      if (!table.findColumnByName('tigerBrandId')) {
        await queryRunner.query(
          `ALTER TABLE "filament" ADD "tigerBrandId" integer`,
        );
      }
      if (!table.findColumnByName('tigerMaterialId')) {
        await queryRunner.query(
          `ALTER TABLE "filament" ADD "tigerMaterialId" integer`,
        );
      }
      if (!table.findColumnByName('tigerTypeId')) {
        await queryRunner.query(
          `ALTER TABLE "filament" ADD "tigerTypeId" integer`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN IF EXISTS "tigerTypeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN IF EXISTS "tigerMaterialId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN IF EXISTS "tigerBrandId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN IF EXISTS "deletedAt"`,
    );
  }
}
