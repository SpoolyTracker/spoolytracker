import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoginAttemptLockFields1777300000000
  implements MigrationInterface
{
  name = 'AddLoginAttemptLockFields1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user');
    if (!table) return;

    if (!table.findColumnByName('failedLoginAttempts')) {
      await queryRunner.query(
        `ALTER TABLE "user" ADD "failedLoginAttempts" integer NOT NULL DEFAULT 0`,
      );
    }

    if (!table.findColumnByName('loginLockedUntil')) {
      await queryRunner.query(
        `ALTER TABLE "user" ADD "loginLockedUntil" TIMESTAMP`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "loginLockedUntil"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "failedLoginAttempts"`,
    );
  }
}
