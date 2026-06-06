import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManualPlanEndDate1775579930611 implements MigrationInterface {
  name = 'AddManualPlanEndDate1775579930611';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization" ADD "manualPlanEndDate" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization" DROP COLUMN "manualPlanEndDate"`,
    );
  }
}
