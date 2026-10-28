@echo off
setlocal
cd /d "%~dp0"
echo Geo Attend 3.5 - calendar, clear CSV and lower-power tracking
call npx --yes wrangler@4.150.0 d1 execute geo-attend-db --remote --file migration-3.3.sql --yes --config wrangler.jsonc
if errorlevel 1 goto failed
call npx --yes wrangler@4.150.0 d1 execute geo-attend-db --remote --file migration-3.3.1.sql --yes --config wrangler.jsonc
if errorlevel 1 goto failed
call npx --yes wrangler@4.150.0 d1 execute geo-attend-db --remote --file migration-3.4.sql --yes --config wrangler.jsonc
if errorlevel 1 goto failed
call npx --yes wrangler@4.150.0 d1 execute geo-attend-db --remote --file migration-3.5.sql --yes --config wrangler.jsonc
if errorlevel 1 goto failed
call npx --yes wrangler@4.150.0 deploy --config wrangler.jsonc
if errorlevel 1 goto failed
echo DONE. Install GeoAttend-v3.5.apk over the existing app on BOTH roles.
echo Open the employee app after installing. Do not uninstall or clear its data.
echo In Controls - Location and battery settings, Allow all the time enables the approach fence.
echo Existing accounts, workplace coordinates and notification secret are preserved.
pause
exit /b 0
:failed
echo STOPPED. Share only the error text, never credentials or PINs.
pause
exit /b 1
