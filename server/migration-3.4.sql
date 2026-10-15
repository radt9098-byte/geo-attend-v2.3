CREATE TABLE IF NOT EXISTS offline_receipts (
 id TEXT PRIMARY KEY NOT NULL,
 account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 start INTEGER NOT NULL,
 end INTEGER NOT NULL,
 created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS offline_receipts_account ON offline_receipts(account);
