import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class SafeAddMissingColumns1776969521000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. User table migrations
    if (!(await queryRunner.hasColumn('user', 'appleId'))) {
      await queryRunner.addColumn('user', new TableColumn({
        name: 'appleId',
        type: 'varchar',
        isNullable: true,
        isUnique: true
      }));
    }

    // 2. Project table migrations (Handling the "printer_power_kw" issue and others)
    const projectColumns = [
      { name: 'print_time_seconds', type: 'integer', isNullable: true },
      { name: 'labor_time_seconds', type: 'integer', isNullable: true, default: 0 },
      { name: 'machine_hourly_rate', type: 'decimal', precision: 10, scale: 2, default: 0 },
      { name: 'labor_hourly_rate', type: 'decimal', precision: 10, scale: 2, default: 0 },
      { name: 'misc_costs', type: 'decimal', precision: 10, scale: 2, default: 0 },
      { name: 'target_selling_price', type: 'decimal', precision: 10, scale: 2, isNullable: true },
      { name: 'printer_power_kw', type: 'decimal', precision: 10, scale: 3, isNullable: true },
      { name: 'electricity_cost_kwh', type: 'decimal', precision: 10, scale: 3, isNullable: true },
      { name: 'notes', type: 'text', isNullable: true },
      { name: 'tags', type: 'text', isNullable: true }, // Simple array is stored as text in typeorm postgres
    ];

    for (const col of projectColumns) {
      if (!(await queryRunner.hasColumn('project', col.name))) {
        await queryRunner.addColumn('project', new TableColumn(col));
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Down migration is harder to make "conditional" but we usually don't rollback missing columns in this context
  }
}
