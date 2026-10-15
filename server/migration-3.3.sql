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
