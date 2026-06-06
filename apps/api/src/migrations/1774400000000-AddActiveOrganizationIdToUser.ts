import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveOrganizationIdToUser1774400000000 implements MigrationInterface {
  name = 'AddActiveOrganizationIdToUser1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "activeOrganizationId" integer`,
    );

    // Set default: for each user, set activeOrganizationId to their first organization
    await queryRunner.query(`
            UPDATE "user" u
            SET "activeOrganizationId" = sub."organizationId"
            FROM (
                SELECT DISTINCT ON ("userId") "userId", "organizationId"
                FROM "user_organizations"
                ORDER BY "userId", "joinedAt" ASC
            ) sub
            WHERE u.id = sub."userId"
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "activeOrganizationId"`,
    );
  }
}
