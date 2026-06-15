import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiActions1778000000000 implements MigrationInterface {
  name = 'CreateAiActions1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_actions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" integer NOT NULL,
        "userId" integer NOT NULL,
        "type" character varying(64) NOT NULL,
        "label" character varying(200) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'proposed',
        "result" jsonb,
        "failureReason" character varying(500),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_actions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_actions_tenant_status"
      ON "ai_actions" ("organizationId", "userId", "status", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_actions_tenant_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_actions"`);
  }
}
