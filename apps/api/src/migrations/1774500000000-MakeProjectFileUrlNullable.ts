import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeProjectFileUrlNullable1774500000000 implements MigrationInterface {
  name = 'MakeProjectFileUrlNullable1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Change file_url to nullable.
    // Note: It's already 'text' from a previous migration 1774200228072.
    await queryRunner.query(
      `ALTER TABLE "project_file" ALTER COLUMN "file_url" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to NOT NULL.
    // CAUTION: This will fail if there are any null values in the column.
    await queryRunner.query(
      `ALTER TABLE "project_file" ALTER COLUMN "file_url" SET NOT NULL`,
    );
  }
}
