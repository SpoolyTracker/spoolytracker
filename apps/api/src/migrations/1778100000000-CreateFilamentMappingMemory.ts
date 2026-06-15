import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFilamentMappingMemory1778100000000 implements MigrationInterface {
  name = 'CreateFilamentMappingMemory1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "filament_mapping_memory" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" integer NOT NULL,
        "sourceMaterial" character varying(120),
        "sourceColor" character varying(120),
        "sourceColorHex" character varying(9),
        "sourceBrand" character varying(120),
        "sourcePresetName" character varying(200),
        "signatureHash" character varying(64) NOT NULL,
        "filamentId" integer NOT NULL,
        "usageCount" integer NOT NULL DEFAULT 1,
        "lastUsedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_filament_mapping_memory" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fmm_org_sig_filament" UNIQUE ("organizationId", "signatureHash", "filamentId"),
        CONSTRAINT "FK_fmm_filament" FOREIGN KEY ("filamentId") REFERENCES "filament"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_fmm_org_signature"
      ON "filament_mapping_memory" ("organizationId", "signatureHash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fmm_org_signature"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "filament_mapping_memory"`);
  }
}
