import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateAdminAuditLogTable1775700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'admin_audit_log',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'action',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'performedById',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'performedByUsername',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'targetType',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'targetId',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'targetLabel',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'admin_audit_log',
      new TableIndex({ name: 'IDX_audit_action', columnNames: ['action'] }),
    );
    await queryRunner.createIndex(
      'admin_audit_log',
      new TableIndex({
        name: 'IDX_audit_performedBy',
        columnNames: ['performedById'],
      }),
    );
    await queryRunner.createIndex(
      'admin_audit_log',
      new TableIndex({
        name: 'IDX_audit_createdAt',
        columnNames: ['createdAt'],
      }),
    );

    await queryRunner.createForeignKey(
      'admin_audit_log',
      new TableForeignKey({
        name: 'FK_audit_performedBy',
        columnNames: ['performedById'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('admin_audit_log', true);
  }
}
