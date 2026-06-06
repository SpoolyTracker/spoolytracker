import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResetPasswordFields1773084611213 implements MigrationInterface {
  name = 'AddResetPasswordFields1773084611213';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "resetPasswordToken" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "resetPasswordExpires" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "resetPasswordExpires"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "resetPasswordToken"`,
    );
  }
}
