import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserNotificationPreferences1772387980683 implements MigrationInterface {
  name = 'UserNotificationPreferences1772387980683';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_notification_preferences" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "notifyOnSystem" boolean NOT NULL DEFAULT true, "notifyOnNewSpool" boolean NOT NULL DEFAULT true, "notifyOnConsumption" boolean NOT NULL DEFAULT true, "notifyOnLowStock" boolean NOT NULL DEFAULT true, "notifyOnInvitation" boolean NOT NULL DEFAULT true, CONSTRAINT "REL_fc1bb12707451f64b0ebb377fa" UNIQUE ("userId"), CONSTRAINT "PK_2b30dfc697b16f75a55be54d464" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "notifyOnNewSpool"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "notifyOnConsumption"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('SYSTEM', 'NEW_SPOOL', 'CONSUMPTION', 'LOW_STOCK', 'INVITATION')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING (CASE WHEN "type"::"text" IN ('INFO', 'ALERT') THEN 'SYSTEM' WHEN "type"::"text" = 'INVITATION' THEN 'INVITATION' ELSE 'SYSTEM' END)::"public"."notifications_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'SYSTEM'`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "FK_fc1bb12707451f64b0ebb377fa9" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_notification_preferences" DROP CONSTRAINT "FK_fc1bb12707451f64b0ebb377fa9"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('INVITATION', 'ALERT', 'INFO')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING (CASE WHEN "type"::"text" = 'INVITATION' THEN 'INVITATION' ELSE 'INFO' END)::"public"."notifications_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'INFO'`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "notifyOnConsumption" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "notifyOnNewSpool" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(`DROP TABLE "user_notification_preferences"`);
  }
}
