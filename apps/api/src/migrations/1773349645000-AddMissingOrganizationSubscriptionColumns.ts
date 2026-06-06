import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingOrganizationSubscriptionColumns1773349645000 implements MigrationInterface {
  name = 'AddMissingOrganizationSubscriptionColumns1773349645000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('organization');
    if (table) {
      if (!table.findColumnByName('stripeSubscriptionEndDate')) {
        await queryRunner.query(
          `ALTER TABLE "organization" ADD "stripeSubscriptionEndDate" TIMESTAMP`,
        );
      }
      if (!table.findColumnByName('isStripeSubscriptionCanceled')) {
        await queryRunner.query(
          `ALTER TABLE "organization" ADD "isStripeSubscriptionCanceled" boolean NOT NULL DEFAULT false`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('organization');
    if (table) {
      if (table.findColumnByName('isStripeSubscriptionCanceled')) {
        await queryRunner.query(
          `ALTER TABLE "organization" DROP COLUMN "isStripeSubscriptionCanceled"`,
        );
      }
      if (table.findColumnByName('stripeSubscriptionEndDate')) {
        await queryRunner.query(
          `ALTER TABLE "organization" DROP COLUMN "stripeSubscriptionEndDate"`,
        );
      }
    }
  }
}
