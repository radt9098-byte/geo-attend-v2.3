# Geo Attend

Private Android attendance app for an office, with a Cloudflare Worker API and D1 database.

## Project

- `android/`: native Java app, version 2.3, Android 8.0 and newer. Open this folder in Android Studio with JDK 17 and SDK 36.
- `server/`: standalone Worker, schema, deployment and migration scripts, and a manual backup command.

The app connects to the office-owned server at https://geo-attend-office.caresystemsandcontrols.workers.dev. Employee login uses IDs and PINs; credentials are hashed on the server and session tokens encrypted with Android Keystore. Foreground GPS attendance requires permission and a visible notification.

The first completed setup creates the shared admin account. Admins manage employees, workplace coordinates and a 50–80 metre radius. Employees automatically check in on reliable GPS entry and check out after confirmed exit.

## Current limits

This is a test-signed app. Background GPS still requires physical-device verification; tracking can stop due to permissions, force-stop, network loss or device battery restrictions. Interrupted tracking is closed at the last verified update.

The existing office database has already been provisioned and accounts migrated. Do not rerun migration scripts against a populated database. Follow `server/README.txt` when provisioning a fresh environment.

Employee data, database backups, migration SQL, tokens and signing keys are intentionally excluded. The office controls its Cloudflare account; this repository stores source code, not live attendance data.
