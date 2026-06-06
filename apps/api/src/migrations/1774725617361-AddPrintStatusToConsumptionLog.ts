import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrintStatusToConsumptionLog1774725617361 implements MigrationInterface {
  name = 'AddPrintStatusToConsumptionLog1774725617361';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "consumption_log" ADD "printTaskId" character varying`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."consumption_log_printstatus_enum" AS ENUM('SUCCESS', 'FAILED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_log" ADD "printStatus" "public"."consumption_log_printstatus_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "consumption_log" DROP COLUMN "printStatus"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."consumption_log_printstatus_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_log" DROP COLUMN "printTaskId"`,
    );
  }
}
