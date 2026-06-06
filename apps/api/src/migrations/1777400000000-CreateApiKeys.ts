import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApiKeys1777400000000 implements MigrationInterface {
  name = 'CreateApiKeys1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "api_keys" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "prefix" character varying NOT NULL,
        "keyHash" character varying NOT NULL,
        "scope" character varying NOT NULL DEFAULT 'orca',
        "userId" integer NOT NULL,
        "organizationId" integer NOT NULL,
        "lastUsedAt" TIMESTAMP,
        "revokedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_api_keys_prefix" UNIQUE ("prefix"),
        CONSTRAINT "UQ_api_keys_keyHash" UNIQUE ("keyHash"),
        CONSTRAINT "PK_api_keys" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "api_keys"
      ADD CONSTRAINT "FK_api_keys_user"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "api_keys"
      ADD CONSTRAINT "FK_api_keys_organization"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_api_keys_org" ON "api_keys" ("organizationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_api_keys_org"`);
    await queryRunner.query(
      `ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "FK_api_keys_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "FK_api_keys_user"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys"`);
  }
}
