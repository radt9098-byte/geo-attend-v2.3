GEO ATTEND - YOUR OFFICE'S CLOUDFLARE SERVER

This package deploys the attendance API in YOUR Cloudflare account.
Database: geo-attend-db
Database ID: 623bb805-041f-4ad4-a913-e08bfd918abd
Binding: DB (this is the name the application code expects)

1. Extract the ZIP. Open its GeoAttend-Cloudflare folder.
2. In that folder's File Explorer address bar, type cmd and press Enter.
3. Confirm you are logged into the correct account with npx wrangler whoami.
4. Run setup.cmd.
5. When prompted, enter your CURRENT Geo Attend admin ID and PIN locally.
   The PIN is hidden, is not saved, and is sent only over HTTPS to the existing
   attendance service. This copies your accounts, workplace and attendance.
   Pause employee tracking during the migration; keep it paused until switching
   to the new APK, so records do not diverge between the two servers.
6. Wrangler will deploy the server. It may ask you to create a workers.dev
   subdomain for your Cloudflare account if this is your first Worker.
7. Send ONLY the resulting workers.dev URL to ChatGPT. A new APK must be built
   to point at your server. The current APK still points at the original server.
   It has NOT been switched merely by deploying this package.

The copy intentionally excludes login sessions and failed-login counters.
Users log in again after the app switches to the new server. Removed employee
accounts and historical attendance are preserved. An open session may be closed
at its last verified GPS update while the move is taking place.

Do not delete the original service or data during this process. Do not run
setup.cmd against a populated target database: import uses INSERT, never
REPLACE, and will fail rather than overwrite an existing admin or attendance.
If a step fails, stop and share only the error text, never migration-data.sql,
PINs, tokens, or database backups. Migration SQL contains hashed credentials
and attendance. It stays on your computer and must be protected.

BACKUPS
Run backup.cmd to download a dated full SQL backup into backups/. Copy backups
to a protected location off this computer. These are manual backups; no automatic
export schedule is installed by this package. D1 additionally provides its own
Time Travel recovery: current Free-plan retention is 7 days, Paid is 30 days.
Reference: https://developers.cloudflare.com/d1/reference/time-travel/
Do not restore a backup into a live database without a separate recovery plan.

ONGOING OWNERSHIP
You control this Cloudflare Worker and D1 database. Hosting availability depends
on your account staying active, applicable service limits, and maintenance.
No service can promise permanent uninterrupted operation. The supplied APK is
still a test-signed build; long-term releases should use a signing key controlled
by your office, and need physical-device GPS testing.

Source: worker.ts; runnable entrypoint: worker.js. No framework install is needed
on your PC. Cloudflare Wrangler is the only deployment tool used here.
