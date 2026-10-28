# Geo Attend 3.5 for Android

Private native Java Android app (Android 8/API 26+, target API 36) connected to the
existing geo-attend-office Cloudflare Worker and D1 database. Login uses office
credentials and a signed phone identity; no social login is used.

Install the signed APK over the existing app after running server/update-3.5.cmd.
Do not uninstall or clear data. The owner signing key is not included in source.

## Attendance and calendar
Attendance contains Day/Month/Year selection and a cached office calendar in IST.
Sunday is a holiday by default; admins can override today/future dates for all or
selected employees. Employees see their own schedule. Only admins can export CSV.
History combines touching recovery fragments, then omits completed sessions under
60 seconds. Raw server evidence remains available for reconciliation.

## Tracking
The visible employee-started foreground service requests fused location around
every 90 seconds, with native GPS fallback. Routine location uploads target two
minutes; changed states upload sooner. Fresh evidence is journaled independently
of HTTP. A 100 m approach geofence assists lower-power tracking when background
location permission is available. It never directly marks attendance. Precise
fixes use the configured workplace radius (50 m default on new setups).

The app holds no continuous CPU wake lock. No location requests are made on days
the employee is not scheduled. Schedule polling continues while the foreground
service is permitted to run. Cached schedules apply offline; remote changes need
a successful connection. Normal request intervals are not exact Android guarantees.

Two reliable outside fixes confirm departure. Stale connectivity is advisory;
a six-minute missing-evidence timeout closes at the last verified location, not
at timeout time. Offline replay subtracts overlap transactionally. Mock and stale
fixes are rejected. GPS-off, permission denial, force-stop and manufacturer battery
restrictions can interrupt recording. A phone test is necessary before rollout.

## Build and test
JDK 17, Android SDK 36/build-tools 36.0.0, Gradle 8.11.1, AGP 8.10.1.
Run `gradle :app:assembleRelease :app:lintRelease` from this directory.
Dependencies include Firebase Messaging, Play Services Location and AndroidX Core.
Run `npm install && npm run build && npm test` from server/ for backend checks.
See server/UPDATE-3.5.txt for installation and physical-device verification.
