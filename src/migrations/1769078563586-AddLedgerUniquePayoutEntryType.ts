import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLedgerUniquePayoutEntryType1769078563586 implements MigrationInterface {
    name = 'AddLedgerUniquePayoutEntryType1769078563586'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "wallet_ledger_entries"
            ADD CONSTRAINT "uq_ledger_payout_entry_type" UNIQUE ("payout_id", "entry_type")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "wallet_ledger_entries" DROP CONSTRAINT "uq_ledger_payout_entry_type"
        `);
    }

}
