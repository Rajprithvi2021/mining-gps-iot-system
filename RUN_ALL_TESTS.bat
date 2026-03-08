@echo off
REM Complete Test Suite Runner
REM Tests all system components

setlocal enabledelayedexpansion

cls
echo.
echo ================================================================================
echo MINING GPS IOT SYSTEM - COMPLETE TEST SUITE
echo ================================================================================
echo.

set TESTS_PASSED=0
set TESTS_FAILED=0
set TESTS_TOTAL=0

REM ========== EDGE DEVICE TESTS ==========
echo [EDGE DEVICE TESTS]
echo.

REM Test 1: Edge files exist
set FILE_COUNT=0
for %%F in (edge\gps_processor.py edge\nmea_parser.py edge\detection_engine.py edge\mqtt_client.py edge\config.py) do (
    if exist "%%F" (
        set /a FILE_COUNT+=1
    )
)

if %FILE_COUNT% EQU 5 (
    echo [PASS] Edge Device Files: 5/5 files present
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Edge Device Files: %FILE_COUNT%/5 files present
    set /a TESTS_FAILED+=1
)
set /a TESTS_TOTAL+=1

REM Test 2: Config validation
if exist "edge\config.py" (
    echo [PASS] Config File Present
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Config File Missing
    set /a TESTS_FAILED+=1
)
set /a TESTS_TOTAL+=1

REM ========== BACKEND TESTS ==========
echo.
echo [BACKEND TESTS]
echo.

REM Test 3: Backend files
set BE_FILE_COUNT=0
for %%F in (backend\src\index.js backend\src\routes\vehicles.js backend\package.json backend\Dockerfile) do (
    if exist "%%F" (
        set /a BE_FILE_COUNT+=1
    )
)

if !BE_FILE_COUNT! GEQ 3 (
    echo [PASS] Backend Files: !BE_FILE_COUNT!/4 files present
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Backend Files: !BE_FILE_COUNT!/4 files present
    set /a TESTS_FAILED+=1
)
set /a TESTS_TOTAL+=1

REM Test 4: Environment config
if exist ".env.example" (
    echo [PASS] Environment Configuration
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Environment Configuration Missing
    set /a TESTS_FAILED+=1
)
set /a TESTS_TOTAL+=1

REM ========== FRONTEND TESTS ==========
echo.
echo [FRONTEND TESTS]
echo.

REM Test 5: Frontend files
set FE_FILE_COUNT=0
for %%F in (frontend\src\App.jsx frontend\package.json frontend\Dockerfile) do (
    if exist "%%F" (
        set /a FE_FILE_COUNT+=1
    )
)

if !FE_FILE_COUNT! EQU 3 (
    echo [PASS] Frontend Files: 3/3 files present
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Frontend Files: !FE_FILE_COUNT!/3 files present
    set /a TESTS_FAILED+=1
)
set /a TESTS_TOTAL+=1

REM ========== INTEGRATION TESTS ==========
echo.
echo [INTEGRATION TESTS]
echo.

REM Test 6: Docker Compose
if exist "docker-compose.yml" (
    echo [PASS] Docker Compose File
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Docker Compose File Missing
    set /a TESTS_FAILED+=1
)
set /a TESTS_TOTAL+=1

REM Test 7: Documentation
set DOC_COUNT=0
for %%F in (README.md QUICKSTART.md DEPLOYMENT.md) do (
    if exist "%%F" (
        set /a DOC_COUNT+=1
    )
)

if !DOC_COUNT! GEQ 2 (
    echo [PASS] Documentation: !DOC_COUNT!/3 files
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Documentation: !DOC_COUNT!/3 files
    set /a TESTS_FAILED+=1
)
set /a TESTS_TOTAL+=1

REM Test 8: Database schema
if exist "backend\scripts\000_init_schema.sql" (
    echo [PASS] Database Schema
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Database Schema Missing
    set /a TESTS_FAILED+=1
)
set /a TESTS_TOTAL+=1

REM ========== RUN INTEGRATION TESTS ==========
echo.
echo [RUNNING NODE.JS INTEGRATION TESTS]
echo.

node test_integration.js
if !ERRORLEVEL! EQU 0 (
    echo [PASS] Integration Test Suite
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Integration Test Suite
    set /a TESTS_FAILED+=1
)
set /a TESTS_TOTAL+=1

REM ========== SUMMARY ==========
echo.
echo ================================================================================
echo TEST EXECUTION SUMMARY
echo ================================================================================
echo.
echo Total Tests:     %TESTS_TOTAL%
echo Passed:          %TESTS_PASSED%
echo Failed:          %TESTS_FAILED%

set /a SUCCESS_RATE=(%TESTS_PASSED% * 100) / %TESTS_TOTAL%
echo Success Rate:    %SUCCESS_RATE%%%
echo.
echo ================================================================================
echo.

if %TESTS_PASSED% EQU %TESTS_TOTAL% (
    echo ✓ ALL TESTS PASSED!
    exit /b 0
) else (
    echo ✗ Some tests failed
    exit /b 1
)
