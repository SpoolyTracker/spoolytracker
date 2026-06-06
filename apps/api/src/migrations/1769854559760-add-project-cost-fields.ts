import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProjectCostFields1769854559760 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'project',
      new TableColumn({
        name: 'print_time_seconds',
        type: 'int',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'project',
      new TableColumn({
        name: 'labor_time_seconds',
        type: 'int',
        isNullable: true,
        default: 0,
      }),
    );
    await queryRunner.addColumn(
      'project',
      new TableColumn({
        name: 'machine_hourly_rate',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: 0,
      }),
    );
    await queryRunner.addColumn(
      'project',
      new TableColumn({
        name: 'labor_hourly_rate',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: 0,
      }),
    );
    await queryRunner.addColumn(
      'project',
      new TableColumn({
        name: 'misc_costs',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: 0,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('project', 'misc_costs');
    await queryRunner.dropColumn('project', 'labor_hourly_rate');
    await queryRunner.dropColumn('project', 'machine_hourly_rate');
    await queryRunner.dropColumn('project', 'labor_time_seconds');
    await queryRunner.dropColumn('project', 'print_time_seconds');
  }
}
