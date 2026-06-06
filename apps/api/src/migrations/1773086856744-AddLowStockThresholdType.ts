import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLowStockThresholdType1773086856744 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "filament" ADD "lowStockThresholdType" character varying NOT NULL DEFAULT 'GRAMS'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN "lowStockThresholdType"`,
    );
  }
}
