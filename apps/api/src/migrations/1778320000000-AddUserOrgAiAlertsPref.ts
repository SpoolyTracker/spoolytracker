import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserOrgAiAlertsPref1778320000000 implements MigrationInterface {
  name = 'AddUserOrgAiAlertsPref1778320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_organizations" ADD COLUMN IF NOT EXISTS "notifyOnAiAlerts" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_organizations" DROP COLUMN IF EXISTS "notifyOnAiAlerts"`,
    );
  }
}
