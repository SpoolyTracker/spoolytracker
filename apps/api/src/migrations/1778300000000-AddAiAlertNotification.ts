import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiAlertNotification1778300000000 implements MigrationInterface {
  name = 'AddAiAlertNotification1778300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'AI_ALERT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "notifyOnAiRupture" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "notifyOnAiAchat" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "notifyOnAiProjet" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_notification_preferences" DROP COLUMN IF EXISTS "notifyOnAiRupture"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notification_preferences" DROP COLUMN IF EXISTS "notifyOnAiAchat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notification_preferences" DROP COLUMN IF EXISTS "notifyOnAiProjet"`,
    );
    // Note: PostgreSQL ne supporte pas le retrait d'une valeur d'enum; AI_ALERT reste.
  }
}
