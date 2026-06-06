import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePushTokenTable1774600000000 implements MigrationInterface {
  name = 'CreatePushTokenTable1774600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create push_token table
    await queryRunner.query(`
            CREATE TABLE "push_token" (
                "id" SERIAL PRIMARY KEY,
                "token" text UNIQUE NOT NULL,
                "deviceId" text,
                "deviceName" text,
                "lastSeenAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "userId" integer NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "FK_push_token_user_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);

    // 2. Create indices
    await queryRunner.query(
      `CREATE INDEX "IDX_push_token_token" ON "push_token" ("token")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_push_token_userId" ON "push_token" ("userId")`,
    );

    // 3. Migrate existing data from User.fcmTokens
    // We split the comma-separated strings into individual rows
    await queryRunner.query(`
            INSERT INTO "push_token" ("token", "userId", "lastSeenAt")
            SELECT DISTINCT token, "id", CURRENT_TIMESTAMP
            FROM (
                SELECT "id", unnest(string_to_array("fcmTokens", ',')) as token
                FROM "user"
                WHERE "fcmTokens" IS NOT NULL AND "fcmTokens" != ''
            ) AS sub
            ON CONFLICT ("token") DO NOTHING
        `);

    // 4. Drop the old column
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "fcmTokens"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Re-add fcmTokens column
    await queryRunner.query(`ALTER TABLE "user" ADD "fcmTokens" text`);

    // 2. Re-migrate data back to simple-array
    await queryRunner.query(`
            UPDATE "user"
            SET "fcmTokens" = sub.tokens
            FROM (
                SELECT "userId", string_agg("token", ',') as tokens
                FROM "push_token"
                GROUP BY "userId"
            ) AS sub
            WHERE "user"."id" = sub."userId"
        `);

    // 3. Drop indices and table
    await queryRunner.query(`DROP INDEX "IDX_push_token_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_push_token_token"`);
    await queryRunner.query(`DROP TABLE "push_token"`);
  }
}
