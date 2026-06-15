import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiAlertState1778310000000 implements MigrationInterface {
  name = 'CreateAiAlertState1778310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_alert_state" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" integer NOT NULL,
        "alertKey" character varying NOT NULL,
        "severity" character varying NOT NULL,
        "lastSentAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_alert_state" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ai_alert_state_org_key" UNIQUE ("organizationId", "alertKey")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_alert_state_org" ON "ai_alert_state" ("organizationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_alert_state"`);
  }
}
