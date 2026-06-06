import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpoolmanColumns1769201386630 implements MigrationInterface {
  name = 'AddSpoolmanColumns1769201386630';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" ADD COLUMN IF NOT EXISTS "density_gcm3" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" ADD COLUMN IF NOT EXISTS "nozzle_temp_min" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" ADD COLUMN IF NOT EXISTS "nozzle_temp_max" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" ADD COLUMN IF NOT EXISTS "bed_temp_min" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" ADD COLUMN IF NOT EXISTS "bed_temp_max" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" DROP COLUMN "bed_temp_max"`,
    );
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" DROP COLUMN "bed_temp_min"`,
    );
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" DROP COLUMN "nozzle_temp_max"`,
    );
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" DROP COLUMN "nozzle_temp_min"`,
    );
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" DROP COLUMN "density_gcm3"`,
    );
  }
}
