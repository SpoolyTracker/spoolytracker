import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceProjects1769874282005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" ADD "target_selling_price" decimal(10,2)`,
    );
    await queryRunner.query(`ALTER TABLE "project" ADD "notes" text`);
    await queryRunner.query(`ALTER TABLE "project" ADD "tags" text`); // Simple array stored as comma-separated or similar, or just text
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "tags"`);
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "notes"`);
    await queryRunner.query(
      `ALTER TABLE "project" DROP COLUMN "target_selling_price"`,
    );
  }
}
