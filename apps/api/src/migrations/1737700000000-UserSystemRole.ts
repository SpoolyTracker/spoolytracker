import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserSystemRole1737700000000 implements MigrationInterface {
  name = 'UserSystemRole1737700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user');
    if (table) {
      if (!table.findColumnByName('systemRole')) {
        await queryRunner.query(
          `ALTER TABLE "user" ADD "systemRole" character varying NOT NULL DEFAULT 'user'`,
        );
      }
      // Also checking other potential missing columns on User
      if (!table.findColumnByName('stripeCustomerId')) {
        await queryRunner.query(
          `ALTER TABLE "user" ADD "stripeCustomerId" character varying`,
        );
      }
      if (!table.findColumnByName('isEmailVerified')) {
        await queryRunner.query(
          `ALTER TABLE "user" ADD "isEmailVerified" boolean DEFAULT false`,
        );
      }
      if (!table.findColumnByName('verificationToken')) {
        await queryRunner.query(
          `ALTER TABLE "user" ADD "verificationToken" character varying`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Safe down
  }
}
