import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFcmToUser1772370327412 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "fcmTokens" text`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD "notifyOnNewSpool" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "notifyOnConsumption" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "notifyOnConsumption"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "notifyOnNewSpool"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "fcmTokens"`);
  }
}
