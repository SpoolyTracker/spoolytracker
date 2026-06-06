import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixNotificationUserCascade1775960000000 implements MigrationInterface {
  name = 'FixNotificationUserCascade1775960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing foreign key constraint
    // The name was identified from the error message: FK_692a909ee0fa9383e7859f9b406
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_692a909ee0fa9383e7859f9b406"`,
    );

    // Re-create it with ON DELETE CASCADE
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to NO ACTION (normal TypeORM default if not specified)
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
