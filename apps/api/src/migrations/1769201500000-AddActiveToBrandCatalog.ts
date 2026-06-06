import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveToBrandCatalog1769201500000 implements MigrationInterface {
  name = 'AddActiveToBrandCatalog1769201500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" DROP COLUMN "isActive"`,
    );
  }
}
