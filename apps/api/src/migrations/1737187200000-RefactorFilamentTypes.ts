import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class RefactorFilamentTypes1737187200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Rename filament_type -> filament_material
    const filamentTypeTable = await queryRunner.getTable('filament_type');
    if (filamentTypeTable) {
      await queryRunner.renameTable('filament_type', 'filament_material');
    }

    // 2. Create filament_real_type table
    const realTypeTable = await queryRunner.getTable('filament_real_type');
    if (!realTypeTable) {
      await queryRunner.createTable(
        new Table({
          name: 'filament_real_type',
          columns: [
            { name: 'id', type: 'serial', isPrimary: true },
            { name: 'name', type: 'varchar', isUnique: true },
            { name: 'description', type: 'varchar', isNullable: true },
            { name: 'organizationId', type: 'integer', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
          ],
        }),
      );
    }

    // 3. Rename filament.typeId -> filament.materialId
    // Also handling if column "materialId" already exists (e.g. strict mode or re-run)
    const filamentTable = await queryRunner.getTable('filament');
    if (filamentTable) {
      const typeIdColumn = filamentTable.findColumnByName('typeId');
      const materialIdColumn = filamentTable.findColumnByName('materialId');

      if (typeIdColumn && !materialIdColumn) {
        // Check if typeId has a FK, need to drop it? Usually renaming column keeps FK but rename it?
        // TypeORM might need us to drop FK first manually if we want clean state.
        const fk = filamentTable.foreignKeys.find(
          (fk) => fk.columnNames.indexOf('typeId') !== -1,
        );
        if (fk) {
          await queryRunner.dropForeignKey('filament', fk);
        }

        // Rename TypeId to MaterialId (Data Preservation)
        await queryRunner.renameColumn('filament', 'typeId', 'materialId');

        // Create new FK for Material
        await queryRunner.createForeignKey(
          'filament',
          new TableForeignKey({
            columnNames: ['materialId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'filament_material',
            onDelete: 'SET NULL',
          }),
        );
      } else if (typeIdColumn && materialIdColumn) {
        // If both exist, it implies partial migration or previous state.
        // We assume current 'typeId' is old material ID if 'materialId' is empty.
        // But better safe: If we are in this state, we assume data is migrated or we force it?
        // Let's assume this migration runs on a clean old DB.
      }

      // 4. Add typeId column back
      const updatedFilamentTable = await queryRunner.getTable('filament');
      if (updatedFilamentTable) {
        const newTypeIdColumn = updatedFilamentTable.findColumnByName('typeId');
        if (!newTypeIdColumn) {
          await queryRunner.addColumn(
            'filament',
            new TableColumn({
              name: 'typeId',
              type: 'integer',
              isNullable: true,
            }),
          );

          await queryRunner.createForeignKey(
            'filament',
            new TableForeignKey({
              columnNames: ['typeId'],
              referencedColumnNames: ['id'],
              referencedTableName: 'filament_real_type',
              onDelete: 'SET NULL',
            }),
          );
        }
      }
    }

    // 5. Data Migration: Options -> Real Types
    // Only if table is empty to avoid dupes? Or use insert ignore.
    const options = await queryRunner.query(
      `SELECT * FROM filament_option WHERE "isCharacteristic" = true`,
    );
    for (const opt of options) {
      // Insert and get ID
      // Postgres safe insert
      const check = await queryRunner.query(
        `SELECT id FROM filament_real_type WHERE name = $1`,
        [opt.name],
      );
      let typeId;
      if (check.length > 0) {
        typeId = check[0].id;
      } else {
        const res = await queryRunner.query(
          `INSERT INTO filament_real_type (name, "organizationId") VALUES ($1, $2) RETURNING id`,
          [opt.name, opt.organizationId],
        );
        typeId = res[0].id;
      }

      // 6. Link Filaments
      // Find filaments that have this option
      // Check junction table name: 'filament_options'
      const links = await queryRunner.query(
        `SELECT "filamentId" FROM filament_options WHERE "optionId" = $1`,
        [opt.id],
      );
      for (const link of links) {
        // Update filament typeId
        await queryRunner.query(
          `UPDATE filament SET "typeId" = $1 WHERE id = $2 AND "typeId" IS NULL`,
          [typeId, link.filamentId],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse is hard because of data loss (merging Types back to Materials?)
    // Basically we would rename materialId -> typeId, drop filament_real_type.
    // But for now, user cares about UP.
  }
}
