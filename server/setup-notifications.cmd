@echo off
setlocal
cd /d "%~dp0"
echo Geo Attend - silent admin notification setup
echo Existing accounts, PINs and attendance will be preserved.
if not exist notification-credentials.json goto missing
node verify-notification-key.mjs
if errorlevel 1 goto failed
echo Checking your existing Cloudflare login...
call npx --yes wrangler@4.150.0 whoami
if errorlevel 1 goto failed
echo Adding notification queue tables...
call npx --yes wrangler@4.150.0 d1 execute geo-attend-db --remote --file migration-3.3.sql --yes --config wrangler.jsonc
if errorlevel 1 goto failed
echo Saving the Firebase credential as an encrypted Cloudflare secret...
call npx --yes wrangler@4.150.0 secret put FCM_SERVICE_ACCOUNT --config wrangler.jsonc < notification-credentials.json
if errorlevel 1 goto failed
echo Deploying the notification sender and retry schedule...
call npx --yes wrangler@4.150.0 deploy --config wrangler.jsonc
if errorlevel 1 goto failed
echo.
echo DONE. Install the included APK over your current app. Do not uninstall.
echo Log in as admin, allow notifications, then open Settings - Notifications.
echo Choose Check server connection and Send silent test.
echo Keep notification-credentials.json private. Never upload it to GitHub.
pause
exit /b 0
:missing
echo Missing notification-credentials.json. Extract the complete PRIVATE setup ZIP.
pause
exit /b 1
:failed
echo SETUP STOPPED. Share only the error text, never credential files or tokens.
echo If Wrangler says you are not logged in, run npx wrangler login in CMD.
pause
exit /b 1
