@echo off
chcp 65001 > nul
setlocal
cd /d "%~dp0"
echo.
echo [ ebay-automation finish launcher ]
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0finish.ps1"
echo.
pause
endlocal
