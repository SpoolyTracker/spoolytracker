import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPlannedWeightToFilament1773868500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('filament');
    if (table) {
      if (!table.findColumnByName('planned_weight')) {
        await queryRunner.addColumn(
          'filament',
          new TableColumn({
            name: 'planned_weight',
            type: 'float',
            default: 0,
          }),
        );
      }
      if (!table.findColumnByName('virtual_weight_remaining')) {
        await queryRunner.addColumn(
          'filament',
          new TableColumn({
            name: 'virtual_weight_remaining',
            type: 'float',
            isNullable: true,
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('filament');
    if (table) {
      if (table.findColumnByName('planned_weight')) {
        await queryRunner.dropColumn('filament', 'planned_weight');
      }
      if (table.findColumnByName('virtual_weight_remaining')) {
        await queryRunner.dropColumn('filament', 'virtual_weight_remaining');
      }
    }
  }
}
