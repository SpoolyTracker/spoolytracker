import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFavorites1777700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('filament', 'favorite'))) {
      await queryRunner.addColumn(
        'filament',
        new TableColumn({
          name: 'favorite',
          type: 'boolean',
          default: false,
        }),
      );
    }

    if (
      (await queryRunner.hasTable('storage_unit')) &&
      !(await queryRunner.hasColumn('storage_unit', 'favorite'))
    ) {
      await queryRunner.addColumn(
        'storage_unit',
        new TableColumn({
          name: 'favorite',
          type: 'boolean',
          default: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('storage_unit')) &&
      (await queryRunner.hasColumn('storage_unit', 'favorite'))
    ) {
      await queryRunner.dropColumn('storage_unit', 'favorite');
    }

    if (await queryRunner.hasColumn('filament', 'favorite')) {
      await queryRunner.dropColumn('filament', 'favorite');
    }
  }
}
