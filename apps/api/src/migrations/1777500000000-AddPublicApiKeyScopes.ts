import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPublicApiKeyScopes1777500000000 implements MigrationInterface {
  name = 'AddPublicApiKeyScopes1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "api_keys"
      ADD COLUMN IF NOT EXISTS "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "api_keys"
      ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP
    `);
    await queryRunner.query(`
      UPDATE "api_keys"
      SET "scopes" = CASE
        WHEN "scope" = 'orca' THEN '["gcode:inspect", "consumption:write"]'::jsonb
        ELSE jsonb_build_array("scope")
      END
      WHERE "scopes" = '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "expiresAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "scopes"
    `);
  }
}
