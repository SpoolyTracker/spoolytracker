import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTigerTagMappingTables1738000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tiger_brand_mappings table
    await queryRunner.query(`
            CREATE TABLE "tiger_brand_mappings" (
                "id" SERIAL NOT NULL,
                "tiger_id" integer UNIQUE NOT NULL,
                "tiger_name" varchar(255) NOT NULL,
                "brand_id" integer,
                "organization_id" integer,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_tiger_brand_mappings" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_tiger_brand_mappings_tiger_id" ON "tiger_brand_mappings" ("tiger_id")
        `);

    await queryRunner.query(`
            ALTER TABLE "tiger_brand_mappings" 
            ADD CONSTRAINT "FK_tiger_brand_mappings_brand" 
            FOREIGN KEY ("brand_id") REFERENCES "brand"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "tiger_brand_mappings" 
            ADD CONSTRAINT "FK_tiger_brand_mappings_organization" 
            FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    // Create tiger_material_mappings table
    await queryRunner.query(`
            CREATE TABLE "tiger_material_mappings" (
                "id" SERIAL NOT NULL,
                "tiger_id" integer UNIQUE NOT NULL,
                "tiger_name" varchar(255) NOT NULL,
                "material_id" integer,
                "organization_id" integer,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_tiger_material_mappings" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_tiger_material_mappings_tiger_id" ON "tiger_material_mappings" ("tiger_id")
        `);

    await queryRunner.query(`
            ALTER TABLE "tiger_material_mappings" 
            ADD CONSTRAINT "FK_tiger_material_mappings_material" 
            FOREIGN KEY ("material_id") REFERENCES "filament_material"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "tiger_material_mappings" 
            ADD CONSTRAINT "FK_tiger_material_mappings_organization" 
            FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    // Create tiger_type_mappings table (for aspects/characteristics)
    await queryRunner.query(`
            CREATE TABLE "tiger_type_mappings" (
                "id" SERIAL NOT NULL,
                "tiger_id" integer UNIQUE NOT NULL,
                "tiger_name" varchar(255) NOT NULL,
                "type_id" integer,
                "organization_id" integer,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_tiger_type_mappings" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_tiger_type_mappings_tiger_id" ON "tiger_type_mappings" ("tiger_id")
        `);

    await queryRunner.query(`
            ALTER TABLE "tiger_type_mappings" 
            ADD CONSTRAINT "FK_tiger_type_mappings_type" 
            FOREIGN KEY ("type_id") REFERENCES "filament_real_type"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "tiger_type_mappings" 
            ADD CONSTRAINT "FK_tiger_type_mappings_organization" 
            FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tiger_type_mappings
    await queryRunner.query(
      `ALTER TABLE "tiger_type_mappings" DROP CONSTRAINT "FK_tiger_type_mappings_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiger_type_mappings" DROP CONSTRAINT "FK_tiger_type_mappings_type"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_tiger_type_mappings_tiger_id"`);
    await queryRunner.query(`DROP TABLE "tiger_type_mappings"`);

    // Drop tiger_material_mappings
    await queryRunner.query(
      `ALTER TABLE "tiger_material_mappings" DROP CONSTRAINT "FK_tiger_material_mappings_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiger_material_mappings" DROP CONSTRAINT "FK_tiger_material_mappings_material"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_tiger_material_mappings_tiger_id"`,
    );
    await queryRunner.query(`DROP TABLE "tiger_material_mappings"`);

    // Drop tiger_brand_mappings
    await queryRunner.query(
      `ALTER TABLE "tiger_brand_mappings" DROP CONSTRAINT "FK_tiger_brand_mappings_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiger_brand_mappings" DROP CONSTRAINT "FK_tiger_brand_mappings_brand"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_tiger_brand_mappings_tiger_id"`);
    await queryRunner.query(`DROP TABLE "tiger_brand_mappings"`);
  }
}
