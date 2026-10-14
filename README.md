# Geo Attend

Private Android attendance app for an office, with a Cloudflare Worker API and D1 database.

## Project

- `android/`: native Java app, version 2.4.6, Android 8.0 and newer. Open this folder in Android Studio with JDK 17 and SDK 36.
- `server/`: standalone Worker, schema, deployment and migration scripts, and a manual backup command.

The app connects to the office-owned server at https://geo-attend-office.caresystemsandcontrols.workers.dev. Employee login uses IDs and PINs; credentials are hashed on the server and session tokens encrypted with Android Keystore. Foreground GPS attendance requires permission and a visible notification.

The first completed setup creates the shared admin account. Admins manage employees, workplace coordinates and a 50–80 metre radius. Employees automatically check in on reliable GPS entry and check out after confirmed exit.

## Current limits

This is a test-signed app. Background GPS still requires physical-device verification; tracking can stop due to permissions, force-stop, network loss or device battery restrictions. Interrupted tracking is closed at the last verified update.

The existing office database has already been provisioned and accounts migrated. Do not rerun migration scripts against a populated database. Follow `server/README.txt` when provisioning a fresh environment.

Employee data, database backups, migration SQL, tokens and signing keys are intentionally excluded. The office controls its Cloudflare account; this repository stores source code, not live attendance data.

## Version 2.4.6

Admin and employee Settings screens include the corresponding profile (name, login ID, role, workplace), a persistent dark-mode switch, and Log out. The workplace name is highlighted at the top of signed-in screens.

Employees must sign in online at least once. With a cached workplace and encrypted session, the app can reopen offline, show cached history, and record reliable GPS attendance locally. Pending intervals are encrypted with Android Keystore. They sync in batches when the app or tracking service reconnects. No employee route coordinates are retained; the cached office coordinates are encrypted.

Offline records use stable IDs and are labelled `offline device record` in server history/CSV. Duplicate uploads are acknowledged without duplicating records. Invalid timestamps, changed workplaces and overlaps are rejected; pending data is retained. The server accepts records from the previous seven days, for active authenticated employees. Offline records are device-reported times, not live server verification.

Deploy `server/update-2.4.cmd` on the office owner's Windows computer before using offline sync. This updates the Worker without importing accounts, changing the schema, or resetting attendance. Do not rerun `setup.cmd` or `migrate.mjs` for this update.

Physical-device tests of GPS, airplane mode, screen-off tracking and dark theme remain necessary. No automatic restart after force-stop/reboot is included.

Server validation tests: `cd server` then `npm test` (requires Node and Python 3).

Employee tracking controls and location/battery settings are in Settings. Overview retains the Live Location Attendance status, distance, GPS accuracy, and pending sync data.

Version 2.4.6 preserves the scroll position before the next draw during automatic dashboard refreshes. Switching tabs still opens the chosen screen at the top.

Version 2.4.6 uses a floating pill navigation bar with vector icons and selected-tab capsules. Status colours, GPS detail rows, labelled dashboard metrics, date-grouped attendance, offline/sync banners and Settings sections improve readability in both themes.

Version 2.4.6 keeps only the Geo Attend header pinned; workplace and sync details scroll with content. Signed-in requests do not show a loading bar. Errors show briefly, while login retains its pinned status area.
