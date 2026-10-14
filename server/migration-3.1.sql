CREATE TABLE IF NOT EXISTS devices (
 account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 id TEXT NOT NULL,
 public_key TEXT NOT NULL,
 name TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','approved','revoked')),
 created INTEGER NOT NULL,
 PRIMARY KEY(account,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_approved_phone ON devices(account) WHERE state='approved';
CREATE TABLE IF NOT EXISTS session_devices (
 token TEXT PRIMARY KEY NOT NULL REFERENCES sessions(token) ON DELETE CASCADE,
 account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 device TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS request_nonces (nonce TEXT PRIMARY KEY NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS nonce_expiry ON request_nonces(expires);
CREATE TABLE IF NOT EXISTS admin_recovery (
 account TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 hash TEXT NOT NULL,
 created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS removed_employees (
 account TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 removed_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO removed_employees(account,removed_at)
 SELECT id,CAST(strftime('%s','now') AS INTEGER)*1000 FROM accounts WHERE role='employee' AND active=0;

CREATE INDEX IF NOT EXISTS removed_time ON removed_employees(removed_at);
