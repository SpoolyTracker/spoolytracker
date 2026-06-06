import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectFileAnalysisMetadata1774200228072 implements MigrationInterface {
  name = 'AddProjectFileAnalysisMetadata1774200228072';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_file" ADD "analysis_metadata" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_item" ALTER COLUMN "material" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_item" ALTER COLUMN "color" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_file" ALTER COLUMN "file_url" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "image_url" TYPE text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "image_url" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_file" ALTER COLUMN "file_url" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_item" ALTER COLUMN "color" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_item" ALTER COLUMN "material" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_file" DROP COLUMN "analysis_metadata"`,
    );
  }
}
