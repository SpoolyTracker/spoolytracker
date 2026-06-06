import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddExternalJobIdToConsumptionLog1769800000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'consumption_log',
      new TableColumn({
        name: 'externalJobId',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('consumption_log', 'externalJobId');
  }
}
