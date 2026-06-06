import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFilamentDryingAndChamberFields1777000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns = [
      { name: 'chamberTempMin', type: 'integer', isNullable: true },
      { name: 'chamberTempMax', type: 'integer', isNullable: true },
      { name: 'dryTemp', type: 'integer', isNullable: true },
      { name: 'dryTime', type: 'integer', isNullable: true },
    ];

    for (const column of columns) {
      if (!(await queryRunner.hasColumn('filament', column.name))) {
        await queryRunner.addColumn('filament', new TableColumn(column));
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columns = ['dryTime', 'dryTemp', 'chamberTempMax', 'chamberTempMin'];

    for (const column of columns) {
      if (await queryRunner.hasColumn('filament', column)) {
        await queryRunner.dropColumn('filament', column);
      }
    }
  }
}
