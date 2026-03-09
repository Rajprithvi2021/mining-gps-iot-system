#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Mining GPS IoT System - Database Setup Script (PowerShell)
    
.DESCRIPTION
    Initializes the PostgreSQL database with complete schema and sample data for 550 vehicles
    
.PREREQUISITES
    - PowerShell 5.0 or higher
    - PostgreSQL installed and running
    - Node.js installed
    - .env file configured with DATABASE_URL
    
.USAGE
    .\setup-db.ps1
    
.NOTES
    This script will create tables and populate with 550 realistic mining vehicles
#>

$ErrorActionPreference = "Stop"

Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║   Mining GPS IoT System - Database Setup                  ║" -ForegroundColor Blue
Write-Host "║   Setting up database with 550 vehicles...                 ║" -ForegroundColor Blue
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host "`n"

# Navigate to backend directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$scriptPath\backend" -ErrorAction SilentlyContinue

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "`nPlease create .env file with database configuration:"
    Write-Host "  DATABASE_URL=postgresql://username:password@localhost:5432/database_name`n" -ForegroundColor Yellow
    Write-Host "Press any key to exit..."
    $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        Write-Host "Press any key to exit..."
        $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
        exit 1
    }
}

# Run the database setup script
Write-Host "🚀 Starting database setup..." -ForegroundColor Green
Write-Host "`n"

node scripts\setup-complete-db.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n"
    Write-Host "❌ Database setup failed!" -ForegroundColor Red
    Write-Host "`nCommon issues:" -ForegroundColor Yellow
    Write-Host "  1. PostgreSQL is not running - Start PostgreSQL service"
    Write-Host "  2. Database credentials are wrong - Check .env file"
    Write-Host "  3. Database already exists - Run DROP DATABASE first"
    Write-Host "`nPress any key to exit..."
    $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
    exit 1
}

Write-Host "`n"
Write-Host "✅ Database setup completed successfully!" -ForegroundColor Green
Write-Host "`n🎉 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Start backend: npm start"
Write-Host "   2. Open browser: http://localhost:5000/health"
Write-Host "   3. View dashboard at frontend URL`n"
Write-Host "Press any key to exit..."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
