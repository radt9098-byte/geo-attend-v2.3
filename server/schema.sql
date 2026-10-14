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
