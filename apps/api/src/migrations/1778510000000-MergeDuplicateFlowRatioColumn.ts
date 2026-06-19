import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Some environments ended up with two flow-ratio columns on `filament`:
 * the entity-backed `"flowRatio"` (camelCase, quoted) and a stray lowercase
 * `flowratio` (created by an older unquoted synchronize/migration that
 * Postgres folded to lowercase). TypeORM only reads/writes `"flowRatio"`, so
 * the lowercase one is dead weight that could silently hold orphaned data.
 *
 * Consolidate onto `"flowRatio"` and drop the duplicate. Safe to run when the
 * stray column doesn't exist (fresh DBs) — it's a no-op there.
 */
export class MergeDuplicateFlowRatioColumn1778510000000
  implements MigrationInterface
{
  name = 'MergeDuplicateFlowRatioColumn1778510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('filament');
    if (!table) return;

    const hasStray = table.columns.some((c) => c.name === 'flowratio');
    if (!hasStray) return;

    const hasCanonical = table.columns.some((c) => c.name === 'flowRatio');
    if (!hasCanonical) {
      // Only the stray exists: just rename it to the canonical name.
      await queryRunner.query(
        `ALTER TABLE "filament" RENAME COLUMN "flowratio" TO "flowRatio"`,
      );
      return;
    }

    // Both exist: preserve any value that only lives in the stray column,
    // then drop it.
    await queryRunner.query(
      `UPDATE "filament" SET "flowRatio" = "flowratio" WHERE "flowRatio" IS NULL AND "flowratio" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN IF EXISTS "flowratio"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('filament');
    if (!table) return;
    if (!table.columns.some((c) => c.name === 'flowratio')) {
      await queryRunner.query(
        `ALTER TABLE "filament" ADD "flowratio" double precision`,
      );
    }
  }
}
