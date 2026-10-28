CREATE TABLE IF NOT EXISTS work_calendar (
 day TEXT PRIMARY KEY,
 mode TEXT NOT NULL CHECK(mode IN ('all','holiday','selected')),
 employees TEXT NOT NULL DEFAULT '[]',
 updated INTEGER NOT NULL
);
