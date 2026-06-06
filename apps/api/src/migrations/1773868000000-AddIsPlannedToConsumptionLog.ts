import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIsPlannedToConsumptionLog1773868000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('consumption_log');
    if (table && !table.findColumnByName('is_planned')) {
      await queryRunner.addColumn(
        'consumption_log',
        new TableColumn({
          name: 'is_planned',
          type: 'boolean',
          default: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('consumption_log', 'is_planned');
  }
}
