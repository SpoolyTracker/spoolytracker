import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixSequences1737190000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // This migration ensures all sequences are aligned with the actual data
    // Useful for fixing "duplicate key value violates unique constraint" errors after imports/manual inserts

    const tables = [
      'brand',
      'filament_material',
      'filament_real_type',
      'filament_option',
    ];

    for (const table of tables) {
      // Postgres specific: Reset sequence to MAX(id) + 1
      await queryRunner.query(`
                SELECT setval(
                    pg_get_serial_sequence('${table}', 'id'),
                    COALESCE((SELECT MAX(id) + 1 FROM "${table}"), 1),
                    false
                );
            `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No need to revert sequence fixes
  }
}
