import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntroSeenToUser1771532737703 implements MigrationInterface {
  name = 'AddIntroSeenToUser1771532737703';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "introSeen" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "introSeen"`);
  }
}
