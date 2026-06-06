import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisplayNameToUser1772567638881 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "displayName" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "displayName"`);
  }
}
