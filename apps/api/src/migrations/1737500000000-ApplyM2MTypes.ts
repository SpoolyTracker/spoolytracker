import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApplyM2MTypes1737500000000 implements MigrationInterface {
  name = 'ApplyM2MTypes1737500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create filament_types table (Junction table)
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "filament_types" (
                "filamentId" integer NOT NULL,
                "typeId" integer NOT NULL,
                CONSTRAINT "PK_filament_types" PRIMARY KEY ("filamentId", "typeId")
            )
        `);

    // 2. Add Foreign Keys
    // We drop them first to be idempotent if re-run on partially applied state
    await queryRunner.query(
      `ALTER TABLE "filament_types" DROP CONSTRAINT IF EXISTS "FK_filament_types_filament"`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament_types" ADD CONSTRAINT "FK_filament_types_filament" FOREIGN KEY ("filamentId") REFERENCES "filament"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "filament_types" DROP CONSTRAINT IF EXISTS "FK_filament_types_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament_types" ADD CONSTRAINT "FK_filament_types_type" FOREIGN KEY ("typeId") REFERENCES "filament_real_type"("id") ON DELETE CASCADE`,
    );

    // 3. Migrate Data from filament.typeId column if it exists
    const hasTypeId = await queryRunner.hasColumn('filament', 'typeId');
    if (hasTypeId) {
      console.log('Migrating data from filament.typeId to filament_types...');
      await queryRunner.query(`
                INSERT INTO "filament_types" ("filamentId", "typeId")
                SELECT id, "typeId" FROM "filament" 
                WHERE "typeId" IS NOT NULL
                ON CONFLICT DO NOTHING
            `);

      // 4. Drop the old column
      console.log('Dropping filament.typeId column...');
      await queryRunner.dropColumn('filament', 'typeId');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse is tricky because we lost data structure (M2M -> 1:N is lossy if multiple types)
    // But we can try to restore the column
    await queryRunner.addColumn('filament', {
      name: 'typeId',
      type: 'integer',
      isNullable: true,
    } as any);

    // Try to restore one type per filament (pick the first one)
    await queryRunner.query(`
            UPDATE "filament" f
            SET "typeId" = ft."typeId"
            FROM "filament_types" ft
            WHERE f.id = ft."filamentId"
        `);

    // Drop the table
    await queryRunner.query(`DROP TABLE "filament_types"`);
  }
}
