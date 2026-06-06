import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBrandCatalogTable1769201386620 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "brand_catalog" (
                "id" SERIAL NOT NULL,
                "brand_id" integer NOT NULL,
                "material_id" integer NOT NULL,
                "type_id" integer NOT NULL,
                "organization_id" integer,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_brand_catalog" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            ALTER TABLE "brand_catalog" 
            ADD CONSTRAINT "FK_brand_catalog_brand" FOREIGN KEY ("brand_id") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "brand_catalog" 
            ADD CONSTRAINT "FK_brand_catalog_material" FOREIGN KEY ("material_id") REFERENCES "filament_material"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "brand_catalog" 
            ADD CONSTRAINT "FK_brand_catalog_type" FOREIGN KEY ("type_id") REFERENCES "filament_real_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" DROP CONSTRAINT "FK_brand_catalog_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" DROP CONSTRAINT "FK_brand_catalog_material"`,
    );
    await queryRunner.query(
      `ALTER TABLE "brand_catalog" DROP CONSTRAINT "FK_brand_catalog_brand"`,
    );
    await queryRunner.query(`DROP TABLE "brand_catalog"`);
  }
}
