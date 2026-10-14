@echo off
setlocal
cd /d "%~dp0"
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)"
if errorlevel 1 goto failed
echo Creating the table structure in your office database...
call npx --yes wrangler@4.150.0 d1 execute geo-attend-db --remote --file schema.sql --yes --config wrangler.jsonc
if errorlevel 1 goto failed
echo Transferring existing accounts and attendance...
node migrate.mjs
if errorlevel 1 goto failed
echo Deploying the server in your Cloudflare account...
call npx --yes wrangler@4.150.0 deploy --config wrangler.jsonc
if errorlevel 1 goto failed
echo.
echo DONE. Send the https://geo-attend-office.YOUR-SUBDOMAIN.workers.dev URL to ChatGPT.
echo The existing Android APK still uses the old service until it is updated.
exit /b 0
:failed
echo.
echo STOPPED: a step failed. Keep the existing app in use until the move is completed.
echo Share only the error text. Do not share PINs, tokens, or migration-data.sql.
exit /b 1
