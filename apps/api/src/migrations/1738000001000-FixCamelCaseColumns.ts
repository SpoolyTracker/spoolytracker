import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCamelCaseColumns1738000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix tiger_brand_mappings
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_brand_mappings',
      'tigerId',
      'tiger_id',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_brand_mappings',
      'tigerName',
      'tiger_name',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_brand_mappings',
      'brandId',
      'brand_id',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_brand_mappings',
      'organizationId',
      'organization_id',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_brand_mappings',
      'createdAt',
      'created_at',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_brand_mappings',
      'updatedAt',
      'updated_at',
    );

    // Fix tiger_material_mappings
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_material_mappings',
      'tigerId',
      'tiger_id',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_material_mappings',
      'tigerName',
      'tiger_name',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_material_mappings',
      'materialId',
      'material_id',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_material_mappings',
      'organizationId',
      'organization_id',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_material_mappings',
      'createdAt',
      'created_at',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_material_mappings',
      'updatedAt',
      'updated_at',
    );

    // Fix tiger_type_mappings
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_type_mappings',
      'tigerId',
      'tiger_id',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_type_mappings',
      'tigerName',
      'tiger_name',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_type_mappings',
      'typeId',
      'type_id',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_type_mappings',
      'organizationId',
      'organization_id',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_type_mappings',
      'createdAt',
      'created_at',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_type_mappings',
      'updatedAt',
      'updated_at',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting this is tricky if we want to go back to mixed state,
    // effectively we can rename back snake_case to camelCase

    // Revert tiger_brand_mappings
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_brand_mappings',
      'tiger_id',
      'tigerId',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_brand_mappings',
      'tiger_name',
      'tigerName',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_brand_mappings',
      'brand_id',
      'brandId',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_brand_mappings',
      'organization_id',
      'organizationId',
    );

    // Revert tiger_material_mappings
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_material_mappings',
      'tiger_id',
      'tigerId',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_material_mappings',
      'tiger_name',
      'tigerName',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_material_mappings',
      'material_id',
      'materialId',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_material_mappings',
      'organization_id',
      'organizationId',
    );

    // Revert tiger_type_mappings
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_type_mappings',
      'tiger_id',
      'tigerId',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_type_mappings',
      'tiger_name',
      'tigerName',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_type_mappings',
      'type_id',
      'typeId',
    );
    await this.renameColumnIfExists(
      queryRunner,
      'tiger_type_mappings',
      'organization_id',
      'organizationId',
    );
  }

  private async renameColumnIfExists(
    queryRunner: QueryRunner,
    table: string,
    oldCol: string,
    newCol: string,
  ) {
    // Configure quoting for column names to handle case sensitivity
    const hasColumn = await queryRunner.hasColumn(table, oldCol);
    if (hasColumn) {
      console.log(`Renaming ${table}.${oldCol} to ${newCol}`);
      await queryRunner.renameColumn(table, oldCol, newCol);
    }
  }
}
