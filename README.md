# Geo Attend

**Private Android attendance for your office.** Geo Attend records attendance when an employee’s phone has a verified location inside the workplace zone, and gives the administrator a clear view of working hours, attendance history and tracking status.

**Latest Android release: [v3.7](https://github.com/radt9098-byte/geo-attend-v2.3/releases/tag/v3.7)**  
[All releases](https://github.com/radt9098-byte/geo-attend-v2.3/releases)

## How it works

1. **Set up your office.** On the first office setup, the administrator creates an ID and PIN, enters the workplace name and coordinates, and chooses a 50–80 metre attendance radius.
2. **Add your team.** The admin creates employee accounts and assigns each an ID and PIN. Employees sign in on their phones and the admin approves their attendance phone.
3. **Enable automatic attendance.** Employees allow precise location and enable tracking. Verified location fixes inside the workplace start attendance; reliable outside fixes confirm checkout. A location estimate alone does not guarantee a check-in.
4. **Save and sync.** Attendance evidence is saved on the employee phone during an internet interruption and uploaded when connectivity returns. Sync reconciliation prevents overlapping evidence from counting the same time twice.
5. **Review the day.** The admin can see team totals, individual records and tracking issues, then export a readable attendance CSV. Employees can see their own hours, attendance and live location status.

## Admin features

- **Overview:** checked-in count, team hours, recent attendance and a Needs attention shortcut.
- **Employee management:** add employees, reset PINs, approve replacement phones and remove employee access.
- **Search and filters:** find employees by name or login ID, or filter by Checked in and Needs attention.
- **Employee details:** review recorded hours, last phone contact, last verified location and reported tracking issues.
- **Attendance history:** select a day, month or year and filter by employee.
- **Integrated calendar:** Sundays are holidays by default. Override a date as a working day or holiday, or schedule only selected employees. The phone stops location collection on an unscheduled day once that schedule is applied.
- **Recorded-hours chart:** open the graph when needed; available to admins when the selection contains more than three days of attendance.
- **CSV export:** export the selected period and employee from the top of Attendance history. Rows include a month category, separate IST dates and AM/PM times, recorded duration and attendance status.
- **Silent notifications:** receive employee check-in and checkout alerts with the employee’s name, and tap to open their attendance.
- **Account recovery:** create or replace an admin recovery code through Settings.

## Employee features

- Own attendance status, hours today and recent attendance.
- Live workplace distance, GPS accuracy, latest location update and pending-sync count.
- Own schedule through Attendance.
- Tracking controls and location/battery settings under **Settings → Controls**.
- Offline attendance storage with syncing after reconnection.
- Optional profile photo, or a consistent coloured initials avatar.
- Appearance preferences and **Settings → App updates**.

CSV exports, team charts, schedule editing and employee management are admin-only.

## Clear attendance and tracking status

Geo Attend distinguishes **verified attendance** from **phone connectivity**. An online phone is not automatically checked in, and an offline report does not prove that an employee left the workplace.

When verified location updates stop, the app allows a short interruption window, then ends recorded time at the last verified location rather than adding unverified hours. History distinguishes a confirmed checkout from an unconfirmed departure or tracking interruption. Older phone reports are labelled as historical status.

Recovered fragments are reconciled before completed sessions shorter than one minute are excluded from attendance reports.

## Appearance

Geo Attend uses floating logo and navigation capsules, translucent cards and an AMOLED mode with ambient lighting that changes when the app is closed and reopened. Existing light and dark appearances remain available.

Version 3.7 adds a compact workplace/status row, cleaner Overview metrics, searchable employee cards and employee detail sheets while retaining the existing theme colours, ambient lighting and glass finish.

Settings includes role-specific categories, an optional profile image and a red **Log out** button at the bottom. There is no Google or Facebook sign-in.

## Where data is stored

| Data | Storage |
| --- | --- |
| Accounts, workplace, schedules and synced attendance | The office’s Cloudflare D1 database, accessed through its Cloudflare Worker |
| Pending offline attendance and app session data | Protected storage on the employee phone |
| Optional profile photo | Encrypted local storage on that phone; not uploaded or shared between phones |
| Notification registration and delivery | Cloudflare service and Firebase Cloud Messaging |
| CSV exports and manual backups | Wherever the admin saves the downloaded files |

Firebase Messaging delivers alerts; it is not the attendance database. Active employee attendance has no automatic age-based deletion in the current implementation. Removed employee attendance is retained for 30 days, then deleted from the live database through scheduled cleanup. Exported files and backups remain separate copies.

## Security

- ID and PIN sign-in with server-side credential verification.
- Device-bound sessions and signed requests using an Android Keystore key.
- Checks for modified requests, expired timestamps and replayed requests.
- One admin-approved attendance phone per employee; approving a replacement revokes the previous phone’s access.
- Employee PIN reset and admin recovery revoke the affected sessions.
- Recovery codes are stored as hashes and rotate after use.
- Private APK signing for compatible future updates.
- Optional manual encrypted database backups; keep the backup password separately.

Sync pending records before replacing a phone or uninstalling the app.

## Install or update

1. Download **GeoAttend-v3.7.apk** from the [v3.7 release](https://github.com/radt9098-byte/geo-attend-v2.3/releases/tag/v3.7).
2. Install it over the existing privately signed Geo Attend app on both admin and employee phones. **Do not uninstall or clear app data.**
3. Open the employee app after installation and check that tracking and the required Android permissions are enabled.

Current attendance features require the matching office server setup. The v3.5 server update supplies the calendar and reporting features.

### In-app updates

Version 3.7 includes **Settings → App updates → Check for updates** for both roles.

The office owner must first deploy the matching **v3.7 Update Pack** using `Enable-In-App-Updates.cmd`. Future signed APKs must then be published to that update service; uploading an APK to GitHub alone does not make it appear inside the app.

Downloads require a signed-in authorised phone. The app verifies the download size, SHA-256, application ID, version and signing certificate before offering installation. Android asks for installation confirmation; updates are not installed silently.

## Release highlights

| Version | Main changes |
| --- | --- |
| **3.7** | Cleaner Overview and Employees screens, compact workplace/status row, initials avatars, search and filters, employee details, private in-app update support |
| **3.6** | Attendance UI improvements, calendar and graph controls, clearer record presentation |
| **3.5 — Major** | Integrated calendar, selected-employee schedules, month/year CSV reporting and lower-power tracking |
| **3.4** | Offline overlap reconciliation, retry deduplication and clearer attendance exports |
| **3.3** | Silent admin attendance notifications and tracking-health reporting |
| **3.2** | AMOLED ambient appearance, floating capsules and organised Settings |
| **3.1 — Major** | Phone approval, signed requests, account recovery, removal retention and encrypted manual backups |

## Repository

- `android/`: native Java Android application.
- `server/`: Cloudflare Worker, database migrations, tests and Windows administration tools.

Use the versioned APK under **Release assets** to install a release. The default-branch source and GitHub-generated source archives may be older than the published APKs; their version should not be inferred from this README.

This is a private office project. Keep signing keys, passwords, recovery codes, Firebase server credentials, attendance exports and database backups out of repository commits and release assets.
