@echo off
setlocal
cd /d "%~dp0"
node backup.mjs
set geo_backup_exit=%errorlevel%
pause
exit /b %geo_backup_exit%
