@echo off
setlocal
cd /d "%~dp0"
echo Geo Attend 3.3.2 - live tracking and employee health update
call npx --yes wrangler@4.150.0 d1 execute geo-attend-db --remote --file migration-3.3.sql --yes --config wrangler.jsonc
if errorlevel 1 goto failed
call npx --yes wrangler@4.150.0 d1 execute geo-attend-db --remote --file migration-3.3.2.sql --yes --config wrangler.jsonc
if errorlevel 1 goto failed
call npx --yes wrangler@4.150.0 deploy --config wrangler.jsonc
if errorlevel 1 goto failed
echo DONE. Install GeoAttend-v3.3.2.apk on BOTH admin and employee phones.
echo Install over the current app. Do not uninstall or clear app data.
echo Open the employee app and check Settings - Controls - Enable automatic attendance.
echo Your existing Firebase notification secret stays on the same Worker.
pause
exit /b 0
:failed
echo STOPPED. Share only the error text, never credentials or PINs.
pause
exit /b 1
