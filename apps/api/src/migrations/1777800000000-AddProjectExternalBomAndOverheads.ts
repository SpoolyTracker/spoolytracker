import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddProjectExternalBomAndOverheads1777800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'project',
      new TableColumn({
        name: 'overhead_rates',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'project_external_item',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'projectId', type: 'integer', isNullable: false },
          { name: 'title', type: 'text', isNullable: false },
          { name: 'external_ref', type: 'text', isNullable: true },
          { name: 'source', type: 'text', isNullable: true },
          { name: 'url', type: 'text', isNullable: true },
          {
            name: 'unit_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'quantity',
            type: 'decimal',
            precision: 10,
            scale: 3,
            default: 1,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'project_external_item',
      new TableForeignKey({
        columnNames: ['projectId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'project',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('project_external_item');
    await queryRunner.dropColumn('project', 'overhead_rates');
  }
}
