import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppleIdToUser1775950000000 implements MigrationInterface {
  name = 'AddAppleIdToUser1775950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "appleId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_appleId" UNIQUE ("appleId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_appleId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "appleId"`);
  }
}
