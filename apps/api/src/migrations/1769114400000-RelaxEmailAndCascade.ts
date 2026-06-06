import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class RelaxEmailAndCascade1769114400000 implements MigrationInterface {
  name = 'RelaxEmailAndCascade1769114400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Remove UNIQUE constraint on email in "user" table
    const userTable = await queryRunner.getTable('user');
    if (userTable) {
      const emailUnique = userTable.uniques.find(
        (uq) => uq.columnNames.indexOf('email') !== -1,
      );
      if (emailUnique) {
        await queryRunner.dropUniqueConstraint('user', emailUnique);
        console.log('Migration: Dropped UNIQUE constraint on user.email');
      }
    }

    // 2. Update user_organizations FKs to CASCADE
    const userOrgTable = await queryRunner.getTable('user_organizations');
    if (userOrgTable) {
      // User FK
      const fkUser = userOrgTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('userId') !== -1,
      );
      if (fkUser) {
        await queryRunner.dropForeignKey('user_organizations', fkUser);
      }
      await queryRunner.createForeignKey(
        'user_organizations',
        new TableForeignKey({
          columnNames: ['userId'],
          referencedColumnNames: ['id'],
          referencedTableName: 'user',
          onDelete: 'CASCADE',
        }),
      );

      // Organization FK
      const fkOrg = userOrgTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('organizationId') !== -1,
      );
      if (fkOrg) {
        await queryRunner.dropForeignKey('user_organizations', fkOrg);
      }
      await queryRunner.createForeignKey(
        'user_organizations',
        new TableForeignKey({
          columnNames: ['organizationId'],
          referencedColumnNames: ['id'],
          referencedTableName: 'organization',
          onDelete: 'CASCADE',
        }),
      );
      console.log('Migration: Updated user_organizations FKs to CASCADE');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert Cascade
    const userOrgTable = await queryRunner.getTable('user_organizations');
    if (userOrgTable) {
      const fkUser = userOrgTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('userId') !== -1,
      );
      if (fkUser)
        await queryRunner.dropForeignKey('user_organizations', fkUser);
      await queryRunner.createForeignKey(
        'user_organizations',
        new TableForeignKey({
          columnNames: ['userId'],
          referencedColumnNames: ['id'],
          referencedTableName: 'user',
          onDelete: 'NO ACTION', // Or whatever default was (usually No Action or Set Null depending on nullable)
        }),
      );

      const fkOrg = userOrgTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('organizationId') !== -1,
      );
      if (fkOrg) await queryRunner.dropForeignKey('user_organizations', fkOrg);
      await queryRunner.createForeignKey(
        'user_organizations',
        new TableForeignKey({
          columnNames: ['organizationId'],
          referencedColumnNames: ['id'],
          referencedTableName: 'organization',
          onDelete: 'NO ACTION',
        }),
      );
    }

    // Revert Unique Email (might fail if duplicates were introduced)
    // We generally shouldn't restore a constraint that might already be violated by data, but for completeness:
    // await queryRunner.createUniqueConstraint("user", new TableUnique({ columnNames: ["email"] }));
  }
}
