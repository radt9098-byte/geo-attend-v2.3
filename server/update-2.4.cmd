@echo off
setlocal
cd /d "%~dp0"
echo Updating Geo Attend server to version 2.4...
call npx --yes wrangler@4.150.0 deploy --config wrangler.jsonc
if errorlevel 1 goto failed
echo DONE. Existing accounts and attendance are preserved.
pause
exit /b 0
:failed
echo Update failed. Share the error text without credentials.
pause
exit /b 1
