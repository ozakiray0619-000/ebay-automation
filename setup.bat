@echo off
REM ============================================================
REM  Claude Code + Cursor x GitHub  ワンクリックランチャ
REM  このファイルをダブルクリックすると setup.ps1 が起動します
REM ============================================================
chcp 65001 > nul
setlocal
cd /d "%~dp0"
echo.
echo [ Claude Code + Cursor x GitHub ワンクリックセットアップ ]
echo.
echo  PowerShell を起動して setup.ps1 を実行します ...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
echo.
pause
endlocal
