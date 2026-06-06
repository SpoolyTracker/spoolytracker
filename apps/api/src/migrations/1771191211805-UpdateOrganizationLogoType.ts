import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOrganizationLogoType1771191211805 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Change logo column type to text and ensure it is nullable
    // We use explicit cast to be safe if there was data (though 'Object' was the issue)
    await queryRunner.query(
      `ALTER TABLE "organization" ALTER COLUMN "logo" TYPE text USING "logo"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization" ALTER COLUMN "logo" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to varchar or whatever it was supposed to be.
    // Previously it was likely character varying (string default) but TypeORM inferred Object from something else?
    // Let's just set it back to varchar to be safe for a 'down' migration.
    await queryRunner.query(
      `ALTER TABLE "organization" ALTER COLUMN "logo" TYPE character varying USING "logo"::character varying`,
    );
  }
}
