import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectElectricityFields1769860863540 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" ADD "printer_power_kw" decimal(10,3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD "electricity_cost_kwh" decimal(10,3)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" DROP COLUMN "electricity_cost_kwh"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP COLUMN "printer_power_kw"`,
    );
  }
}
