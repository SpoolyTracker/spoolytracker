import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsolidateTypes1737400000000 implements MigrationInterface {
  name = 'ConsolidateTypes1737400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create filament_real_type table
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "filament_real_type" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "description" character varying,
                "organizationId" integer,
                CONSTRAINT "PK_filament_real_type_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_filament_real_type_name" UNIQUE ("name")
            )
        `);

    // 2. Migrate Options to Types
    // Only if filament_option table exists
    const hasOptionTable = await queryRunner.hasTable('filament_option');
    if (hasOptionTable) {
      console.log('Migrating options to filament_real_type...');
      const options = await queryRunner.query(
        `SELECT * FROM "filament_option" WHERE "isCharacteristic" = true`,
      );

      for (const opt of options) {
        await queryRunner.query(
          `
                    INSERT INTO "filament_real_type" ("name", "organizationId") 
                    VALUES ($1, $2) 
                    ON CONFLICT ("name") DO NOTHING
                `,
          [opt.name, opt.organizationId],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "filament_real_type"`);
  }
}
