@echo off
REM ======================================================================
REM  Daily MySQL backup for the store (XAMPP on Windows)
REM  Creates D:\backups\store_db_YYYY-MM-DD_HH-mm.sql and keeps 30 days.
REM  Schedule it with Windows Task Scheduler (see README).
REM ======================================================================
setlocal EnableExtensions

REM ---------- Settings (edit if needed) ----------
set "MYSQLDUMP=C:\xampp\mysql\bin\mysqldump.exe"
set "DB_HOST=127.0.0.1"
set "DB_NAME=store_db"
set "DB_USER=root"
set "DB_PASS="
set "BACKUP_DIR=D:\backups"
set "KEEP_DAYS=30"
REM -----------------------------------------------

if not exist "%MYSQLDUMP%" (
    echo [ERROR] mysqldump not found: %MYSQLDUMP%
    exit /b 2
)

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
set "LOG=%BACKUP_DIR%\backup.log"

REM Locale-independent timestamp (works on Arabic/English Windows alike)
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"`) do set "STAMP=%%i"
if not defined STAMP (
    echo [ERROR] Could not read the date via PowerShell >> "%LOG%"
    exit /b 3
)

set "FILE=%BACKUP_DIR%\%DB_NAME%_%STAMP%.sql"

set "PASS_ARG="
if not "%DB_PASS%"=="" set "PASS_ARG=--password=%DB_PASS%"

"%MYSQLDUMP%" --host=%DB_HOST% --user=%DB_USER% %PASS_ARG% ^
    --single-transaction --quick --routines --triggers --events ^
    --default-character-set=utf8mb4 ^
    --databases %DB_NAME% ^
    --result-file="%FILE%" 2>> "%LOG%"

if errorlevel 1 goto :failed
for %%A in ("%FILE%") do if %%~zA LSS 1024 goto :failed

echo [%STAMP%] OK  %FILE% >> "%LOG%"
echo Backup saved: %FILE%

REM Delete backups older than KEEP_DAYS days
forfiles /p "%BACKUP_DIR%" /m "%DB_NAME%_*.sql" /d -%KEEP_DAYS% /c "cmd /c del /q @path" >nul 2>&1

endlocal
exit /b 0

:failed
echo [%STAMP%] FAILED - is MySQL running in XAMPP? >> "%LOG%"
if exist "%FILE%" del /q "%FILE%"
echo [ERROR] Backup failed. See %LOG%
endlocal
exit /b 1
