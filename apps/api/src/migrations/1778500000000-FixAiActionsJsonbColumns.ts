import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The ai_actions.payload / result columns were created as `text` in some
 * environments (table pre-existed the CreateAiActions migration's
 * `CREATE TABLE IF NOT EXISTS`). The entity declares them as `jsonb`, and the
 * pg driver only auto-parses jsonb — text columns come back as raw strings, so
 * `action.payload.filament_id` was `undefined` at execution time.
 *
 * Align the DB with the entity. Stored values are already valid JSON, so the
 * cast is lossless; running this when the columns are already jsonb is a no-op.
 */
export class FixAiActionsJsonbColumns1778500000000 implements MigrationInterface {
  name = 'FixAiActionsJsonbColumns1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_actions" ALTER COLUMN "payload" TYPE jsonb USING "payload"::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_actions" ALTER COLUMN "result" TYPE jsonb USING "result"::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_actions" ALTER COLUMN "result" TYPE text USING "result"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_actions" ALTER COLUMN "payload" TYPE text USING "payload"::text`,
    );
  }
}
