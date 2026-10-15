CREATE TABLE IF NOT EXISTS `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`login` text NOT NULL,
	`hash` text NOT NULL,
	`salt` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`last_seen` integer,
	`last_distance` real,
	`accuracy` real,
	`outside_since` integer,
	`created` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `accounts_login_unique` ON `accounts` (`login`);
CREATE TABLE IF NOT EXISTS `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer,
	`reason` text,
	`distance` real NOT NULL,
	FOREIGN KEY (`account`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX IF NOT EXISTS `attendance_account` ON `attendance` (`account`);
CREATE UNIQUE INDEX IF NOT EXISTS `one_open_session` ON `attendance` (`account`) WHERE end IS NULL;
CREATE TABLE IF NOT EXISTS `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer NOT NULL,
	`until` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `organization` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`radius` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`viewer` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`account`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX IF NOT EXISTS `session_account` ON `sessions` (`account`);
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
-- Repeatable notification migration. Existing accounts and attendance are preserved.
CREATE TABLE IF NOT EXISTS push_registrations (
 id TEXT PRIMARY KEY, token TEXT NOT NULL, session TEXT NOT NULL,
 account TEXT NOT NULL, device TEXT NOT NULL, created INTEGER NOT NULL,
 FOREIGN KEY(session) REFERENCES sessions(token) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS push_token_unique ON push_registrations(token);
CREATE TABLE IF NOT EXISTS push_events (
 id TEXT PRIMARY KEY, employee TEXT NOT NULL, name TEXT NOT NULL,
 kind TEXT NOT NULL, at INTEGER NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS push_deliveries (
 event TEXT NOT NULL, registration TEXT NOT NULL, session TEXT NOT NULL,
 recipient TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL,
 lease_until INTEGER NOT NULL DEFAULT 0, lease TEXT, sent INTEGER,
 PRIMARY KEY(event,registration),
 FOREIGN KEY(event) REFERENCES push_events(id) ON DELETE CASCADE,
 FOREIGN KEY(registration) REFERENCES push_registrations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS push_due ON push_deliveries(sent,next_at,lease_until);
CREATE TRIGGER IF NOT EXISTS attendance_push_in AFTER INSERT ON attendance
WHEN NEW.end IS NULL
BEGIN
 INSERT OR IGNORE INTO push_events(id,employee,name,kind,at,reason,created)
 SELECT NEW.id||':in',NEW.account,a.name,'in',NEW.start,'',CAST(strftime('%s','now') AS INTEGER)*1000 FROM accounts a WHERE a.id=NEW.account;
 INSERT OR IGNORE INTO push_deliveries(event,registration,session,recipient,next_at)
 SELECT NEW.id||':in',p.id,p.session,p.account,CAST(strftime('%s','now') AS INTEGER)*1000
 FROM push_registrations p JOIN sessions s ON s.token=p.session JOIN accounts a ON a.id=p.account
 WHERE s.expires>CAST(strftime('%s','now') AS INTEGER)*1000 AND a.active=1 AND a.role='admin';
END;
CREATE TRIGGER IF NOT EXISTS attendance_push_out AFTER UPDATE OF end ON attendance
WHEN OLD.end IS NULL AND NEW.end IS NOT NULL
BEGIN
 INSERT OR IGNORE INTO push_events(id,employee,name,kind,at,reason,created)
 SELECT NEW.id||':out',NEW.account,a.name,'out',NEW.end,COALESCE(NEW.reason,''),CAST(strftime('%s','now') AS INTEGER)*1000 FROM accounts a WHERE a.id=NEW.account;
 INSERT OR IGNORE INTO push_deliveries(event,registration,session,recipient,next_at)
 SELECT NEW.id||':out',p.id,p.session,p.account,CAST(strftime('%s','now') AS INTEGER)*1000
 FROM push_registrations p JOIN sessions s ON s.token=p.session JOIN accounts a ON a.id=p.account
 WHERE s.expires>CAST(strftime('%s','now') AS INTEGER)*1000 AND a.active=1 AND a.role='admin';
END;
