import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiMemories1778200000000 implements MigrationInterface {
  name = 'CreateAiMemories1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_memories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" integer NOT NULL,
        "userId" integer NOT NULL,
        "type" character varying(32) NOT NULL,
        "content" text NOT NULL,
        "tags" jsonb NOT NULL DEFAULT '[]',
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_memories" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_memories_tenant"
      ON "ai_memories" ("organizationId", "userId", "type", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_memories_tenant"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_memories"`);
  }
}
