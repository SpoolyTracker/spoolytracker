import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateProjectsTable1769800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Projects Table
    await queryRunner.createTable(
      new Table({
        name: 'project',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', default: "'PLANNING'" }, // PLANNING, IN_PROGRESS, COMPLETED, ARCHIVED
          { name: 'global_cost', type: 'float', isNullable: true },
          { name: 'start_date', type: 'timestamp', isNullable: true },
          { name: 'end_date', type: 'timestamp', isNullable: true },
          { name: 'image_url', type: 'varchar', isNullable: true },
          { name: 'created_by', type: 'integer', isNullable: false }, // User ID
          { name: 'organizationId', type: 'integer', isNullable: false }, // Organization ID
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

    // 2. Project Items (BOM)
    await queryRunner.createTable(
      new Table({
        name: 'project_item',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'projectId', type: 'integer', isNullable: false },
          { name: 'filamentId', type: 'integer', isNullable: true }, // Optional link to real stock
          { name: 'material', type: 'varchar', isNullable: true }, // Generic requirement (e.g. PLA)
          { name: 'color', type: 'varchar', isNullable: true }, // Generic requirement (e.g. Red)
          {
            name: 'weight_required_g',
            type: 'float',
            isNullable: false,
            default: 0,
          },
          {
            name: 'weight_used_g',
            type: 'float',
            isNullable: false,
            default: 0,
          },
        ],
      }),
      true,
    );

    // 3. Project Files
    await queryRunner.createTable(
      new Table({
        name: 'project_file',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'projectId', type: 'integer', isNullable: false },
          { name: 'file_url', type: 'varchar', isNullable: false },
          { name: 'file_type', type: 'varchar', isNullable: false }, // GCODE, IMAGE, OTHER
          { name: 'file_name', type: 'varchar', isNullable: false },
          { name: 'file_size', type: 'integer', isNullable: true },
          {
            name: 'uploaded_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Foreign Keys
    await queryRunner.createForeignKey(
      'project',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organization',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'project',
      new TableForeignKey({
        columnNames: ['created_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'project_item',
      new TableForeignKey({
        columnNames: ['projectId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'project',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'project_item',
      new TableForeignKey({
        columnNames: ['filamentId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'filament',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'project_file',
      new TableForeignKey({
        columnNames: ['projectId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'project',
        onDelete: 'CASCADE',
      }),
    );

    // Add projectId to consumption_log
    await queryRunner.query(
      'ALTER TABLE consumption_log ADD COLUMN "projectId" integer NULL',
    );
    await queryRunner.createForeignKey(
      'consumption_log',
      new TableForeignKey({
        columnNames: ['projectId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'project',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first (checking manually usually not needed if dropping tables, but good practice)

    const table = await queryRunner.getTable('consumption_log');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('projectId') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('consumption_log', foreignKey);
    }
    await queryRunner.query(
      'ALTER TABLE consumption_log DROP COLUMN projectId',
    );

    await queryRunner.dropTable('project_file');
    await queryRunner.dropTable('project_item');
    await queryRunner.dropTable('project');
  }
}
