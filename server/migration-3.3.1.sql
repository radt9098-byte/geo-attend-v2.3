-- Advisory phone health is separate from verified attendance timestamps.
CREATE TABLE IF NOT EXISTS employee_health (
 account TEXT PRIMARY KEY, last_contact INTEGER NOT NULL, state TEXT NOT NULL,
 fix_age INTEGER, pending INTEGER NOT NULL DEFAULT 0,
 battery_restricted INTEGER NOT NULL DEFAULT 0,
 FOREIGN KEY(account) REFERENCES accounts(id) ON DELETE CASCADE
);
