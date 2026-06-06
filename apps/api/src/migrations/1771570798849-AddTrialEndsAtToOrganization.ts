import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrialEndsAtToOrganization1771570798849 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization" ADD "trialEndsAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization" DROP COLUMN "trialEndsAt"`,
    );
  }
}
