import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateGlobalSettingsTable1775900000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "global_settings",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    {
                        name: "key",
                        type: "varchar",
                        isUnique: true,
                        isNullable: false,
                    },
                    {
                        name: "value",
                        type: "text",
                        isNullable: false,
                    },
                    {
                        name: "description",
                        type: "varchar",
                        isNullable: true,
                    },
                    {
                        name: "updatedAt",
                        type: "timestamp",
                        default: "now()",
                    },
                ],
            }),
            true
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("global_settings");
    }
}
