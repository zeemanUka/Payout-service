# Payout processor (NestJS + TypeORM)

This app shows a safe way to process payouts with:
- Atomic wallet debit
- Idempotency
- Audit logging
- Retry and recovery for bank failures

Rules:
- No pre-built payout libraries
- Do not store sensitive data in audit JSON

## Quick start

### 1) Install
```bash
npm install
````

### 2) Environment

Copy `.env.example` to `.env` and fill values.

###3) Run migrations

Generate a migration from your Entities (example):

```bash
npm run typeorm -- -d src/database/data-source.ts migration:generate src/migrations/InitialMigration -p
```

Run migrations:

```bash
npm run migration:run
```

Revert last migration (optional):

```bash
npm run migration:revert
```

### 4) Seed data (wallet balances)

This app needs a wallet balance to test payouts. You can seed the wallet using SQL.

Seed NGN wallet for merchant_123 with 50000:

```sql
INSERT INTO wallets (merchant_id, currency, balance_available)
VALUES ('merchant_123', 'NGN', 50000.00)
ON CONFLICT (merchant_id, currency)
DO UPDATE SET balance_available = EXCLUDED.balance_available, updated_at = now();
```

Optional: seed USD wallet for merchant_123 with 200:

```sql
INSERT INTO wallets (merchant_id, currency, balance_available)
VALUES ('merchant_123', 'USD', 200.00)
ON CONFLICT (merchant_id, currency)
DO UPDATE SET balance_available = EXCLUDED.balance_available, updated_at = now();
```

You can run the SQL using any Postgres client connected to your database.

### 5) Start the app

```bash
npm run start:dev
```

## Swagger documentation

Swagger UI:

* [http://localhost:3000/docs](http://localhost:3000/docs)

OpenAPI JSON:

* [http://localhost:3000/docs-json](http://localhost:3000/docs-json)

Main endpoints:

* POST /payouts/process
* GET /payouts/:id

Example request:

```json
{
  "merchantId": "merchant_123",
  "amount": 10000,
  "currency": "NGN",
  "idempotencyKey": "idem_key_001"
}
```

Example success response:

```json
{
  "status": "success",
  "message": "Payout processed",
  "data": {
    "payoutId": "3f8e0b61-8f9c-4a3b-8f79-8b2d0bb7a1f2",
    "status": "SUCCESS"
  }
}
```

Example error response:

```json
{
  "status": "error",
  "message": "insufficient funds",
  "data": null
}
```

## 1. Schema design (tables and key fields)

The design uses a few core tables to ensure correctness and traceability.

### wallets

Stores the available wallet balance for each merchant and currency.
Key fields:

* id (uuid)
* merchant_id (text)
* currency (text, NGN or USD)
* balance_available (numeric)

Key constraint:

* UNIQUE (merchant_id, currency)

### payout_requests

Stores idempotency records.
Key fields:

* id (uuid)
* merchant_id (text)
* idempotency_key (text)
* request_hash (text, sha256 of merchantId, amount, currency)
* payout_id (uuid, nullable)
* status (CREATED, IN_PROGRESS, COMPLETED, FAILED_FINAL)

Key constraint:

* UNIQUE (merchant_id, idempotency_key)

### payouts

Stores the payout state machine.
Key fields:

* id (uuid)
* merchant_id (text)
* amount (numeric)
* currency (text)
* status (PENDING, SUCCESS, FAILED, NEEDS_RETRY)
* attempt_count (int)
* next_retry_at (timestamptz, nullable)
* external_reference (text, nullable)
* failure_reason (text, nullable)

Key index:

* index on (status, next_retry_at) for selecting due retries

### wallet_ledger_entries

Append-only ledger for balance changes.
Key fields:

* id (uuid)
* wallet_id (uuid)
* payout_id (uuid, nullable)
* entry_type (DEBIT or CREDIT)
* amount (numeric)
* balance_before (numeric)
* balance_after (numeric)
* correlation_id (text)

Purpose:

* Financial audit trail for every wallet balance change

### audit_events

Append-only operational audit logs.
Key fields:

* id (uuid)
* entity_type (text)
* entity_id (text)
* event_type (text)
* payload_json (jsonb)
* actor (text)
* created_at (timestamptz)

Important:

* payload_json must never contain sensitive data

## 2. Transaction boundaries

The payout flow is split into safe phases to avoid holding DB locks during network calls.

### Phase A (single DB transaction)

Goals:

* enforce idempotency
* lock wallet row
* debit funds atomically
* create payout record
* write ledger entry
* write audit events

This phase uses a transaction and a wallet row lock (pessimistic write).

### Phase B (outside DB transaction)

Goal:

* call the bank API

This is outside the transaction so DB locks are not held during slow or unreliable network calls.

### Phase C (final DB transaction)

Goals:

* mark payout SUCCESS and store external reference, or
* mark payout NEEDS_RETRY and schedule next_retry_at, or
* mark payout FAILED and credit wallet back (compensation)

This phase writes audit events for the outcome.

## 3. Idempotency strategy

We enforce idempotency with a DB unique constraint:

* payout_requests has UNIQUE (merchant_id, idempotency_key)

Logic:

1. On first request, we create a payout_requests row, then create a payout and store payout_id in payout_requests.
2. On subsequent requests with the same merchantId and idempotencyKey:

   * return the linked payout status, no new payout is created, no extra debit happens.

Idempotency misuse protection:

* We store request_hash (sha256 of merchantId, amount, currency).
* If the same idempotencyKey is reused with different amount or currency:

  * we reject the request (HTTP 400).

## 4. Audit logging approach

We keep two forms of logs:

1. wallet_ledger_entries is the financial truth. Every debit and credit is recorded with before and after balances.
2. audit_events is operational logging for debugging and traceability of state changes.

PCI and sensitive data rule:

* audit_events.payload_json must never store sensitive data like:

  * full card numbers, CVV, PIN
  * bank credentials
  * account numbers, routing numbers, IBAN
  * passwords, tokens, Authorization headers

Enforcement:

* We use an allowlist per event type.
* We drop any keys that are not allowed.
* We hash idempotencyKey and externalReference before storing them in audit logs.

## 5. Retry and recovery explanation

Retryable errors:

* bank timeout
* temporary bank failure

When retryable errors happen:

* payout status becomes NEEDS_RETRY
* attempt_count increments
* next_retry_at is set using exponential backoff
* response to the caller is PENDING (because payout is not final yet)

Retry worker:

* A scheduled worker runs every few seconds (dev default).
* It selects due payouts:

  * status = NEEDS_RETRY
  * next_retry_at <= now()
* It attempts the bank transfer again.

Success on retry:

* payout moves to SUCCESS
* external_reference is saved
* audit event is written

Permanent failure:

* payout moves to FAILED
* wallet is credited back using a ledger CREDIT entry
* audit events are written for failure and compensation

Notes:

* In production, it is best to claim due payouts using row locks and then call the bank outside long DB locks.
* For this assessment, the worker is simple and focused on clarity.

## Testing

Use Swagger to run requests:

* [http://localhost:3000/docs](http://localhost:3000/docs)
