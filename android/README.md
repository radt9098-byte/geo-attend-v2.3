# Geo Attend for Android

Native Java Android app, Android 8.0 (API 26) and newer. It connects to the shared Geo Attend attendance service over HTTPS.

## Included

- First admin setup
- Shared admin/employee login using login IDs and 6–12 digit PINs
- Add and remove employees; removed employees retain historical attendance
- Workplace latitude, longitude and a 50–80 metre radius
- Live working status, individual history and working time
- CSV export through Android's system file picker
- Employee foreground GPS service, a persistent notification and a pause action
- Session encryption using Android Keystore; no PIN storage or app backup

## Service activation

The app now connects to https://geo-attend-office.caresystemsandcontrols.workers.dev in the office-owned Cloudflare account. The service URL is in `Api.java`. The owner authorized direct Android access. The API is `/api/native`; protected requests use bearer tokens. The first successful setup creates the single shared admin account without an activation code. A transactional insert prevents another admin from being created. Existing accounts can use their assigned ID and PIN.

## Install the test APK

Open `GeoAttend.apk` on an Android phone and allow installation from the app opening the file. The first completed setup creates the admin; later installations use assigned logins. Employees use credentials assigned by the admin. Allow precise location and notifications, then enable automatic attendance.

## Tracking behavior

The employee starts a location-type foreground service from the visible app after disclosure and permission. It may continue with the screen off or another app visible. Tracking is not covert: the service notification exposes its status and a pause action. The service requests fresh GPS/network location updates and sends fresh fixes no more frequently than every 10 seconds. It rejects mock locations and stale fixes. Position coordinates are used transiently to calculate distance; the service stores workplace distance/accuracy and attendance, not route history.

A reliable accuracy circle entirely inside the workplace zone checks in. Two reliable outside fixes at least 15 seconds apart check out at the first outside fix. After 90 seconds without verified updates, attendance closes at the last verified update on the next server request. Pausing, logout and employee removal also end active sessions. There is no offline backfill: interrupted network access is displayed and unverified time is not credited.

The service does not restart itself from boot or a background state. Reopening the app restarts opted-in tracking when the app is visible. Force-stop, disabled location, internet loss, denied permissions and manufacturer battery restrictions can stop tracking. Physical-device tests are still necessary, especially with the screen locked and battery saving enabled.

## Build

Open this `android/` directory in Android Studio using JDK 17 and Android SDK 36. The standard Android Gradle project uses AGP 8.10.1 and Gradle 8.11.1. Build with `gradle :app:assembleDebug`, or Android Studio's Build APK action. No third-party runtime libraries or Google Play Services are required.

The delivered APK uses a test signing certificate. It is for sideloaded device testing, not a Play Store release. A release needs an owner-controlled signing key, a final application ID and device verification. No release signing key is embedded in this source.
