import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFailureProgressToConsumptionLog1778520000000
  implements MigrationInterface
{
  name = 'AddFailureProgressToConsumptionLog1778520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "consumption_log" ADD "plannedPrintAmount" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_log" ADD "failureProgressPercent" double precision`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "consumption_log" DROP COLUMN "failureProgressPercent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_log" DROP COLUMN "plannedPrintAmount"`,
    );
  }
}
