@echo off
setlocal
cd /d "%~dp0"

if not exist ".bot.pid" exit /b 0

set /p BOTPID=<".bot.pid"

if not defined BOTPID (
    del /q ".bot.pid" >NUL 2>&1
    exit /b 0
)

rem Kill the hidden PowerShell wrapper and all child processes, including npm/node.
taskkill /PID %BOTPID% /T /F >NUL 2>&1

del /q ".bot.pid" >NUL 2>&1
exit /b 0
