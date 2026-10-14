@echo off
setlocal
cd /d "%~dp0"
echo FIRST: pause tracking on EVERY old app while online and confirm 0 pending records.
echo Version 3.1 disables old app sessions and uses a new APK signing key.
set /p geo_synced=Type SYNCED only when all phones have synced: 
if /I not "%geo_synced%"=="SYNCED" exit /b 0
echo Applying repeatable Geo Attend 3.1 security tables...
call npx --yes wrangler@4.150.0 d1 execute geo-attend-db --remote --file migration-3.1.sql --yes --config wrangler.jsonc
if errorlevel 1 goto failed
echo Deploying Geo Attend 3.1 and its daily retention cleanup...
call npx --yes wrangler@4.150.0 deploy --config wrangler.jsonc
if errorlevel 1 goto failed
echo DONE. Install the 3.1 APK after syncing any pending records in your old app.
echo Existing employees must request phone approval by logging in to version 3.1.
pause
exit /b 0
:failed
echo STOPPED. Share only the error message, never PINs or keys.
pause
exit /b 1
