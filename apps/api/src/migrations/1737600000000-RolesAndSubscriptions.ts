import { MigrationInterface, QueryRunner } from 'typeorm';

export class RolesAndSubscriptions1737600000000 implements MigrationInterface {
  name = 'RolesAndSubscriptions1737600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Organization Table Updates
    // Check/Add 'plan' column
    const table = await queryRunner.getTable('organization');
    if (table) {
      if (!table.findColumnByName('plan')) {
        await queryRunner.query(
          `ALTER TABLE "organization" ADD "plan" character varying NOT NULL DEFAULT 'free'`,
        );
      }
      if (!table.findColumnByName('stripeCustomerId')) {
        await queryRunner.query(
          `ALTER TABLE "organization" ADD "stripeCustomerId" character varying`,
        );
      }
      if (!table.findColumnByName('stripeSubscriptionId')) {
        await queryRunner.query(
          `ALTER TABLE "organization" ADD "stripeSubscriptionId" character varying`,
        );
      }
      if (!table.findColumnByName('settings')) {
        await queryRunner.query(
          `ALTER TABLE "organization" ADD "settings" jsonb`,
        );
      }
    }

    // 2. UserOrganization Table Updates (Roles)
    const uoTable = await queryRunner.getTable('user_organizations'); // Entity name is user_organizations
    if (uoTable) {
      if (!uoTable.findColumnByName('role')) {
        // Create Enum type if Postgres?
        // TypeORM usually handles enums as strings or custom types.
        // In the entity it is: @Column({ type: 'enum', enum: [...], default: 'member' })
        // We'll use simple varchar check for safety or try to create type.
        await queryRunner.query(
          `ALTER TABLE "user_organizations" ADD "role" character varying NOT NULL DEFAULT 'member'`,
        );
      }
      if (!uoTable.findColumnByName('hasConfirmed')) {
        await queryRunner.query(
          `ALTER TABLE "user_organizations" ADD "hasConfirmed" boolean DEFAULT true`,
        );
      }
      if (!uoTable.findColumnByName('joinedAt')) {
        await queryRunner.query(
          `ALTER TABLE "user_organizations" ADD "joinedAt" timestamp DEFAULT now()`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // We generally don't want to drop these in down if they might have been created by sync?
    // But for completeness:
    const table = await queryRunner.getTable('organization');
    if (table) {
      if (table.findColumnByName('stripeSubscriptionId'))
        await queryRunner.dropColumn('organization', 'stripeSubscriptionId');
      if (table.findColumnByName('stripeCustomerId'))
        await queryRunner.dropColumn('organization', 'stripeCustomerId');
    }
  }
}
