import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1768990342101 implements MigrationInterface {
    name = 'InitialMigration1768990342101'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "wallets" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "merchant_id" text NOT NULL,
                "currency" text NOT NULL,
                "balance_available" numeric(20, 2) NOT NULL DEFAULT '0',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_25e3d57d63cb975ff4fa5d0266" ON "wallets" ("merchant_id", "currency")
        `);
        await queryRunner.query(`
            CREATE TABLE "payouts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "merchant_id" text NOT NULL,
                "amount" numeric(20, 2) NOT NULL,
                "currency" text NOT NULL,
                "status" text NOT NULL,
                "failure_reason" text,
                "external_reference" text,
                "attempt_count" integer NOT NULL DEFAULT '0',
                "next_retry_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_76855dc4f0a6c18c72eea302e87" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_6fad1dd15c1ca7657539ce369a" ON "payouts" ("next_retry_at")
        `);
        await queryRunner.query(`
            CREATE TABLE "payout_requests" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "merchant_id" text NOT NULL,
                "idempotency_key" text NOT NULL,
                "request_hash" text NOT NULL,
                "payout_id" uuid,
                "status" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_3a6acb302f56ad7dadda35c86b8" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_1ae456fb73e7cd51a0bd075b0f" ON "payout_requests" ("merchant_id", "idempotency_key")
        `);
        await queryRunner.query(`
            CREATE TABLE "wallet_ledger_entries" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "wallet_id" uuid NOT NULL,
                "payout_id" uuid,
                "entry_type" text NOT NULL,
                "amount" numeric(20, 2) NOT NULL,
                "currency" text NOT NULL,
                "balance_before" numeric(20, 2) NOT NULL,
                "balance_after" numeric(20, 2) NOT NULL,
                "correlation_id" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_d18ec2600fc04a812dc53af2be1" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_4a3a591ddde4fb1dd7c7522c0e" ON "wallet_ledger_entries" ("wallet_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_34a6ef0ea5e823475145c5dac7" ON "wallet_ledger_entries" ("payout_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "audit_events" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "entity_type" text NOT NULL,
                "entity_id" text NOT NULL,
                "event_type" text NOT NULL,
                "payload_json" jsonb NOT NULL,
                "actor" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_910f64d901a5c3e9878f0d4a407" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_42f49cbb3e259a4c89534994b0" ON "audit_events" ("entity_type", "entity_id", "created_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX "public"."IDX_42f49cbb3e259a4c89534994b0"
        `);
        await queryRunner.query(`
            DROP TABLE "audit_events"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_34a6ef0ea5e823475145c5dac7"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_4a3a591ddde4fb1dd7c7522c0e"
        `);
        await queryRunner.query(`
            DROP TABLE "wallet_ledger_entries"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_1ae456fb73e7cd51a0bd075b0f"
        `);
        await queryRunner.query(`
            DROP TABLE "payout_requests"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_6fad1dd15c1ca7657539ce369a"
        `);
        await queryRunner.query(`
            DROP TABLE "payouts"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_25e3d57d63cb975ff4fa5d0266"
        `);
        await queryRunner.query(`
            DROP TABLE "wallets"
        `);
    }

}
