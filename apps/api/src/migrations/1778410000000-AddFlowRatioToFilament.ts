import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlowRatioToFilament1778410000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('filament');
    if (!table) return;

    if (!table.findColumnByName('flowRatio')) {
      await queryRunner.query(
        `ALTER TABLE "filament" ADD "flowRatio" double precision`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "filament" DROP COLUMN IF EXISTS "flowRatio"`,
    );
  }
}
