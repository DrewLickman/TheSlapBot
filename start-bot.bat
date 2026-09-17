@echo off
setlocal
cd /d "%~dp0"
set "BOTDIR=%~dp0"

rem If the saved process is still alive, do not start a second bot.
if exist ".bot.pid" (
    set /p BOTPID=<".bot.pid"
    if defined BOTPID (
        tasklist /FI "PID eq %BOTPID%" 2>NUL | findstr /R /C:"[ ]%BOTPID%[ ]" >NUL
        if not errorlevel 1 exit /b 0
    )
    del /q ".bot.pid" >NUL 2>&1
)

rem Fail silently but leave the reason in bot.log.
where node >NUL 2>&1
if errorlevel 1 (
    >"bot.log" echo ERROR: Node.js was not found in PATH. Install Node.js 22.12 or newer.
    exit /b 1
)

rem Launch a detached, hidden PowerShell process.
rem Its PID is saved so stop-bot.bat can terminate the entire process tree.
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$script = '$ErrorActionPreference=''Stop''; Set-Location -LiteralPath $env:BOTDIR; try { if (-not (Test-Path -LiteralPath ''node_modules'')) { & npm.cmd install *>> ''bot.log''; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }; & npm.cmd start *>> ''bot.log''; exit $LASTEXITCODE } finally { Remove-Item -LiteralPath ''.bot.pid'' -Force -ErrorAction SilentlyContinue }'; $p = Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command',$script; Set-Content -LiteralPath (Join-Path $env:BOTDIR '.bot.pid') -Value $p.Id"

exit /b 0
