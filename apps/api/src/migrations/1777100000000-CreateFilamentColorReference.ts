import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFilamentColorReference1777100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "filament_color_reference" (
        "id" SERIAL NOT NULL,
        "brand_id" integer NOT NULL,
        "material_id" integer,
        "type_id" integer,
        "organization_id" integer,
        "name" character varying NOT NULL,
        "primary_hex" character varying NOT NULL,
        "hexes" text,
        "source" character varying NOT NULL DEFAULT 'manual',
        "source_external_id" character varying,
        "finish" character varying,
        "pattern" character varying,
        "multiColorDirection" character varying,
        "translucent" boolean,
        "glow" boolean,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_filament_color_reference" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "filament_color_reference"
      ADD CONSTRAINT "FK_color_reference_brand" FOREIGN KEY ("brand_id") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "filament_color_reference"
      ADD CONSTRAINT "FK_color_reference_material" FOREIGN KEY ("material_id") REFERENCES "filament_material"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "filament_color_reference"
      ADD CONSTRAINT "FK_color_reference_type" FOREIGN KEY ("type_id") REFERENCES "filament_real_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "filament_color_reference"
      ADD CONSTRAINT "FK_color_reference_organization" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_color_reference_scope" ON "filament_color_reference" ("brand_id", "material_id", "type_id", "organization_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_color_reference_global_name" ON "filament_color_reference" ("brand_id", COALESCE("material_id", 0), COALESCE("type_id", 0), LOWER("name")) WHERE "organization_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_color_reference_org_name" ON "filament_color_reference" ("brand_id", COALESCE("material_id", 0), COALESCE("type_id", 0), "organization_id", LOWER("name")) WHERE "organization_id" IS NOT NULL
    `);

    const hasColorReferenceId = await queryRunner.hasColumn(
      'filament',
      'colorReferenceId',
    );
    if (!hasColorReferenceId) {
      await queryRunner.query(`
        ALTER TABLE "filament" ADD "colorReferenceId" integer
      `);
      await queryRunner.query(`
        ALTER TABLE "filament"
        ADD CONSTRAINT "FK_filament_color_reference" FOREIGN KEY ("colorReferenceId") REFERENCES "filament_color_reference"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColorReferenceId = await queryRunner.hasColumn(
      'filament',
      'colorReferenceId',
    );
    if (hasColorReferenceId) {
      await queryRunner.query(
        `ALTER TABLE "filament" DROP CONSTRAINT IF EXISTS "FK_filament_color_reference"`,
      );
      await queryRunner.query(`ALTER TABLE "filament" DROP COLUMN "colorReferenceId"`);
    }

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_color_reference_org_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_color_reference_global_name"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_color_reference_scope"`);
    await queryRunner.query(
      `ALTER TABLE "filament_color_reference" DROP CONSTRAINT IF EXISTS "FK_color_reference_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament_color_reference" DROP CONSTRAINT IF EXISTS "FK_color_reference_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament_color_reference" DROP CONSTRAINT IF EXISTS "FK_color_reference_material"`,
    );
    await queryRunner.query(
      `ALTER TABLE "filament_color_reference" DROP CONSTRAINT IF EXISTS "FK_color_reference_brand"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "filament_color_reference"`);
  }
}
