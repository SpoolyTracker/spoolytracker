import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateStorageUnits1777600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('storage_unit'))) {
      await queryRunner.createTable(
        new Table({
          name: 'storage_unit',
          columns: [
            {
              name: 'id',
              type: 'integer',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'name', type: 'varchar', isNullable: false },
            { name: 'location', type: 'varchar', isNullable: true },
            {
              name: 'kind',
              type: 'varchar',
              default: "'shelf'",
              isNullable: false,
            },
            { name: 'levels', type: 'integer', default: 4 },
            { name: 'slotsPerLevel', type: 'integer', default: 6 },
            { name: 'tagId', type: 'varchar', isNullable: true },
            { name: 'organizationId', type: 'integer', isNullable: true },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'now()',
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'now()',
            },
          ],
        }),
      );

      await queryRunner.createForeignKey(
        'storage_unit',
        new TableForeignKey({
          columnNames: ['organizationId'],
          referencedTableName: 'organization',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
      await queryRunner.createIndex(
        'storage_unit',
        new TableIndex({
          name: 'IDX_storage_unit_organization_location',
          columnNames: ['organizationId', 'location'],
        }),
      );
    }

    const filamentColumns = [
      { name: 'storageUnitId', type: 'integer', isNullable: true },
      { name: 'storageLevel', type: 'integer', isNullable: true },
      { name: 'storageSlot', type: 'integer', isNullable: true },
    ];

    for (const column of filamentColumns) {
      if (!(await queryRunner.hasColumn('filament', column.name))) {
        await queryRunner.addColumn('filament', new TableColumn(column));
      }
    }

    const filamentTable = await queryRunner.getTable('filament');
    const hasStorageFk = filamentTable?.foreignKeys.some((fk) =>
      fk.columnNames.includes('storageUnitId'),
    );
    if (!hasStorageFk) {
      await queryRunner.createForeignKey(
        'filament',
        new TableForeignKey({
          columnNames: ['storageUnitId'],
          referencedTableName: 'storage_unit',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_filament_storage_slot_unique" ON "filament" ("organizationId", "storageUnitId", "storageLevel", "storageSlot") WHERE "storageUnitId" IS NOT NULL AND "storageLevel" IS NOT NULL AND "storageSlot" IS NOT NULL AND "deletedAt" IS NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_storage_unit_org_tag_unique" ON "storage_unit" ("organizationId", "tagId") WHERE "tagId" IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_filament_storage_slot_unique"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_storage_unit_org_tag_unique"');

    const filamentTable = await queryRunner.getTable('filament');
    const storageFk = filamentTable?.foreignKeys.find((fk) =>
      fk.columnNames.includes('storageUnitId'),
    );
    if (storageFk) {
      await queryRunner.dropForeignKey('filament', storageFk);
    }

    for (const column of ['storageSlot', 'storageLevel', 'storageUnitId']) {
      if (await queryRunner.hasColumn('filament', column)) {
        await queryRunner.dropColumn('filament', column);
      }
    }

    if (await queryRunner.hasTable('storage_unit')) {
      await queryRunner.dropTable('storage_unit');
    }
  }
}
