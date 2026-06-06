import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleIdToUser1775851075126 implements MigrationInterface {
  name = 'AddGoogleIdToUser1775851075126';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "googleId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_googleId" UNIQUE ("googleId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "password" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "password" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_googleId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "googleId"`);
  }
}
