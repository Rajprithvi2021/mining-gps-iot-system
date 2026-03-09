@echo off
REM ========================================================================
REM Mining GPS IoT System - Database Setup Script (Windows)
REM ========================================================================
REM This script initializes the database with 550 vehicles and sample data
REM
REM Prerequisites:
REM   - PostgreSQL installed and running
REM   - Node.js installed
REM   - Database credentials configured in .env
REM ========================================================================

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║   Mining GPS IoT System - Database Setup                  ║
echo ║   Setting up database with 550 vehicles...                 ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Change to backend directory
cd /d "%~dp0.."

REM Check if .env exists
if not exist .env (
    echo ❌ Error: .env file not found!
    echo.
    echo Please create .env file with database configuration:
    echo   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Run the database setup script
echo.
echo 🚀 Starting database setup...
echo.

node scripts\setup-complete-db.js

if errorlevel 1 (
    echo.
    echo ❌ Database setup failed!
    echo.
    echo Common issues:
    echo   1. PostgreSQL is not running - Start PostgreSQL service
    echo   2. Database credentials are wrong - Check .env file
    echo   3. Database already exists - Run 'DROP DATABASE mining_iot;' first
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Database setup completed successfully!
echo.
echo 🎉 Next steps:
echo   1. Start backend: npm start
echo   2. Open browser: http://localhost:5000/health
echo   3. View dashboard at frontend URL
echo.
pause
