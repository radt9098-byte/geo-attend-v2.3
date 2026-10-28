# Geo Attend 3.2

Private Android office attendance app with a Cloudflare Worker and D1 database.

- `android/`: Java Android app, version 3.2 / versionCode 19. Android 8+, SDK 36, JDK 17.
- `server/`: Worker, repeatable migration, daily removal-retention cleanup and encrypted manual backup scripts.

The app uses the office-owned Worker at https://geo-attend-office.caresystemsandcontrols.workers.dev.
Version 3.2 is a UI update compatible with the existing v3.1 server. Install its APK over v3.1 without uninstalling or rerunning a server migration. For older installations that have not migrated to server v3.1, first follow `server/UPDATE-3.1.txt` in order.

## Security and management

Each employee has one admin-approved phone. Phone requests follow successful PIN authentication; a P-256 private key in Android Keystore signs requests. The server binds sessions to the approved key and checks signatures, request content, timestamps and one-use nonces. Approving a replacement revokes previous sessions. Admin management access remains available from more than one phone.

Admins can reset employee PINs, revoking sessions without deleting history. Existing admins create a recovery code from Settings with current-PIN verification. New office setup creates one automatically. Recovery codes are high-entropy, hashed on the server, rotate after use, and never displayed again. Recovery revokes existing admin sessions.

Removed employees lose access immediately. History is held for 30 days after removal, then hidden from reports and deleted by daily cleanup in bounded batches. Existing inactive employees get 30 days from migration. Active attendance has no time-based deletion. Downloaded backups are independent copies.

## Upgrade and APK signing

Sync and pause all old apps before deploying `server/update-3.1.cmd`, which makes old unbound sessions incompatible. Version 3.1 is signed with a private release key rather than the previous test key, so the first upgrade requires uninstall/reinstall. Synced cloud history remains; uninstall deletes unsynced phone records. Future builds must use the same private release key. Keys/passwords and live data are excluded from this repository.

## Backups

`server/backup.cmd` exports the full D1 database on the owner's Windows computer and encrypts it using scrypt-derived AES-256-GCM. Backups are manual and add no subscription; existing Cloudflare usage limits still apply. `decrypt-backup.mjs` decrypts a private backup for restoration to a new empty database. Keep backup passwords separately and test restoration before relying on a backup.

## Validation

`cd server && npm test` checks offline synchronization, device approval/revocation, signature replay/tampering, role access, PIN reset, recovery rotation, 30-day cleanup, repeatable migration, and backup encryption. Tests use Node and Python SQLite with foreign keys and transactional batches.

Android tests in `android/tests` check status presentation and Java ECDSA conversion. The Java-generated signature is also verified with WebCrypto. Native Java/resource compilation, APK version metadata and release signatures are verified. Physical-device GPS/background/UI testing and deployed-server validation remain required.

## UI

Floating logo/name capsule at top-left and capsule navigation over the page. Workplace and sync details scroll. Theme, tracking and logout controls are in Settings; logout is red and last. Attendance automatic refresh updates records in place while preserving scroll/filter selection.

## Version 3.2 UI

AMOLED is the default, with stable session lighting that changes on closing/reopening the app. The ambient seed survives UI redraws, tab changes, rotation, and system photo/settings pickers. Dark, Light, Emerald Glass, and Frosted Slate are also available. Cards and floating capsules use translucent tinted fills and subtle edges; no continuous blur loop or background animation runs.

The approved doorway/check logo is packaged as a raster resource. Navigation has a 280 ms slide/fade, sliding selection, ripple feedback, and light press animations. System-disabled animations and the local Reduce motion setting are respected. Automatic refresh does not replay page entrances; Attendance updates its records in place and keeps scroll/filter state.

Settings uses a profile strip, two tiles (Appearance + Controls for employees; Appearance + Workplace for admins), and full-width rows for About and admin Security & Backup. The red logout control stays last. Categories open scrollable bottom sheets. Login retains office ID/PIN, includes PIN visibility, and adds no social sign-in.

Optional profile photos are selected with the Android document picker, sampled/cropped to a 256 px thumbnail, stripped of original metadata, and stored with the existing AES-GCM encrypted storage per account. No broad gallery permission or server upload is used; photos stay on that phone.


### v3.3 notification build

Adds Firebase Messaging for silent admin attendance alerts. The Windows `server/setup-notifications.cmd` applies the repeatable notification migration, imports a private local credential as a Cloudflare secret, and deploys the sender. Attendance and ID/PIN authentication remain in Cloudflare D1. The private server credential must never be committed or included in a GitHub release. See `server/NOTIFICATIONS.txt` for setup and phone verification. Other planned v3.3 UI changes remain pending.


### v3.3.1 tracking reliability

Separates live location requests from historical upload work, adds fused location with native fallback, and reports advisory employee tracking health without changing verified attendance rules. The repeatable Windows update uses the existing Worker and notification secret. Install the APK on both roles; see `server/TRACKING-3.3.1.txt` for verification.


## Version 3.4
Attendance recovery now subtracts overlaps transactionally and uses stable retry receipts. GPS evidence is saved independently of HTTP uploads. CSV exports include readable IST dates and AM/PM times, worked duration, confirmed departure versus last verified time, and UTC reference columns. Run `server/update-3.4.cmd`, then install the signed v3.4 APK over the existing app. See `server/UPDATE-3.4.txt` for verification steps.

## Version 3.5
Integrated Attendance calendar with Sunday holidays and selected-employee working days;
admin-only period-filtered IST CSV at the top of history; short-session filtering after
recovery reconciliation; 90-second location requests and two-minute routine sync;
100 m approach geofence with precise attendance verification; no continuous app CPU
wake lock. Existing light/dark/AMOLED themes and floating navigation are retained.
Run server/update-3.5.cmd before installing the APK. See server/UPDATE-3.5.txt.
