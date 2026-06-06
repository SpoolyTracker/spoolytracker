import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionTable1773263768112 implements MigrationInterface {
  name = 'AddSubscriptionTable1773263768112';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" SERIAL NOT NULL, "stripeSubscriptionId" character varying NOT NULL, "stripeCustomerId" character varying NOT NULL, "status" character varying NOT NULL, "planId" character varying NOT NULL, "currentPeriodStart" TIMESTAMP NOT NULL, "currentPeriodEnd" TIMESTAMP NOT NULL, "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false, "canceledAt" TIMESTAMP, "organizationId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_a7a84c705f3e8e4fbd497cfb119" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_a7a84c705f3e8e4fbd497cfb119"`,
    );
    await queryRunner.query(`DROP TABLE "subscriptions"`);
  }
}
