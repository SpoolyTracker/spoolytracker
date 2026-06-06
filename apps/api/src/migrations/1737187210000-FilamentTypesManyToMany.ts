import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class FilamentTypesManyToMany1737187210000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create Junction Table: filament_types
    // This links filaments to filament_real_type (Many-to-Many)
    await queryRunner.createTable(
      new Table({
        name: 'filament_types',
        columns: [
          {
            name: 'filamentId',
            type: 'integer',
            isPrimary: true,
          },
          {
            name: 'typeId',
            type: 'integer',
            isPrimary: true,
          },
        ],
      }),
      true,
    );

    // 2. Cleanup orphaned data from junction table (Robustness for failed re-runs)
    await queryRunner.query(`
            DELETE FROM filament_types 
            WHERE "typeId" NOT IN (SELECT id FROM filament_real_type)
            OR "filamentId" NOT IN (SELECT id FROM filament)
        `);

    // 3. Add Foreign Keys (with existence checks)
    const typesTable = await queryRunner.getTable('filament_types');
    if (typesTable) {
      const hasFilamentFK = typesTable.foreignKeys.some((fk) =>
        fk.columnNames.includes('filamentId'),
      );
      if (!hasFilamentFK) {
        await queryRunner.createForeignKey(
          'filament_types',
          new TableForeignKey({
            columnNames: ['filamentId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'filament',
            onDelete: 'CASCADE',
          }),
        );
      }

      const hasTypeFK = typesTable.foreignKeys.some((fk) =>
        fk.columnNames.includes('typeId'),
      );
      if (!hasTypeFK) {
        await queryRunner.createForeignKey(
          'filament_types',
          new TableForeignKey({
            columnNames: ['typeId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'filament_real_type',
            onDelete: 'CASCADE',
          }),
        );
      }
    }

    // 4. Migrate existing data (One-to-Many -> Many-to-Many)
    const filamentTable = await queryRunner.getTable('filament');
    if (filamentTable) {
      const typeIdColumn = filamentTable.findColumnByName('typeId');
      if (typeIdColumn) {
        // Copy data - only for IDs that actually exist to avoid FK violations
        await queryRunner.query(`
                    INSERT INTO filament_types ("filamentId", "typeId")
                    SELECT f.id, f."typeId" 
                    FROM filament f
                    INNER JOIN filament_real_type t ON f."typeId" = t.id
                    WHERE f."typeId" IS NOT NULL
                    ON CONFLICT DO NOTHING
                `);

        // 5. Drop old column and its FK
        const fk = filamentTable.foreignKeys.find(
          (fk) => fk.columnNames.indexOf('typeId') !== -1,
        );
        if (fk) {
          await queryRunner.dropForeignKey('filament', fk);
        }
        await queryRunner.dropColumn('filament', 'typeId');
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('filament_types');
  }
}
