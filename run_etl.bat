@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set "PROJECT_DIR=C:\My_Project\Project_X"
set "LOG_DIR=%PROJECT_DIR%\db\logs"

cd /d "%PROJECT_DIR%" || (
  echo [ERROR] Cannot cd to %PROJECT_DIR%
  exit /b 1
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo ============================================================
echo ETL batch start: %date% %time%
echo Project: %PROJECT_DIR%
echo ============================================================

set PYTHONIOENCODING=utf-8
set DATABASE_PATH=%PROJECT_DIR%\vsm_database.db

echo.
echo [1/3] etl_loader.py
python notify_etl.py "python etl_loader.py" >> "%LOG_DIR%\etl_batch.log" 2>&1
set ETL_RC=!ERRORLEVEL!
if !ETL_RC! neq 0 (
  echo [FAIL] etl_loader.py exit code !ETL_RC!
  exit /b !ETL_RC!
)
echo [OK] etl_loader.py

echo.
echo [2/3] clean_data.py
python notify_etl.py "python clean_data.py" >> "%LOG_DIR%\clean_batch.log" 2>&1
set CLEAN_RC=!ERRORLEVEL!
if !CLEAN_RC! neq 0 (
  echo [WARN] clean_data.py exit code !CLEAN_RC!
)

echo.
echo [3/3] dq_check.py
python notify_etl.py "python dq_check.py" >> "%LOG_DIR%\dq_batch.log" 2>&1
set DQ_RC=!ERRORLEVEL!
if !DQ_RC! neq 0 (
  echo [WARN] dq_check.py exit code !DQ_RC!
)

echo.
echo ============================================================
echo ETL batch finished: %date% %time%
echo Logs: %LOG_DIR%
echo ============================================================
exit /b 0
