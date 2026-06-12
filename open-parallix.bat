@echo off
chcp 65001 >nul

set PARALLIX=%USERPROFILE%\OneDrive\ドキュメント\Claude\Projects\Parallix

:: フォルダがなければ作成
if not exist "%PARALLIX%" (
    echo Parallix フォルダを作成します...
    mkdir "%PARALLIX%"
)

:: cursor コマンドが使えるか確認
where cursor >nul 2>&1
if %ERRORLEVEL% == 0 (
    cursor "%PARALLIX%"
    goto :end
)

:: AppData の一般的なインストール先を確認
set CURSOR_EXE=%LOCALAPPDATA%\Programs\cursor\Cursor.exe
if exist "%CURSOR_EXE%" (
    "%CURSOR_EXE%" "%PARALLIX%"
    goto :end
)

:: 見つからなければメッセージ
echo [ERROR] Cursor が見つかりません。
echo 以下を手動でやってください：
echo   1. Cursor を起動
echo   2. File → Open Folder
echo   3. 以下のフォルダを選択：
echo      %PARALLIX%
pause

:end
