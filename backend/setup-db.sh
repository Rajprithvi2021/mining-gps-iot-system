#!/bin/bash

###############################################################################
# Mining GPS IoT System - Database Setup Script (Linux/macOS)
#
# This script initializes the PostgreSQL database with complete schema and
# sample data for 550 vehicles
#
# Prerequisites:
#   - PostgreSQL 12+ installed and running
#   - Node.js 16+ installed
#   - .env file configured with DATABASE_URL
#
# Usage:
#   chmod +x setup-db.sh
#   ./setup-db.sh
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print header
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Mining GPS IoT System - Database Setup                  ║"
echo "║   Setting up database with 550 vehicles...                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Check if .env exists
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    echo ""
    echo "Please create .env file with database configuration:"
    echo ""
    echo "  DATABASE_URL=postgresql://username:password@localhost:5432/skylark_drones"
    echo ""
    exit 1
fi

# Check if PostgreSQL is running
echo -e "${YELLOW}📋 Checking PostgreSQL connection...${NC}"
if ! psql -h localhost -U postgres -d postgres -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL is not running or not accessible${NC}"
    echo ""
    echo "Please start PostgreSQL:"
    echo "  - macOS: brew services start postgresql"
    echo "  - Linux: sudo service postgresql start"
    echo ""
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL is running${NC}"

# Navigate to backend directory
cd "$BACKEND_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
fi

# Run the database setup script
echo -e "${GREEN}🚀 Starting database setup...${NC}"
echo ""

node scripts/setup-complete-db.js

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ Database setup failed!${NC}"
    echo ""
    echo "Common issues:"
    echo "  1. PostgreSQL is not running"
    echo "  2. Database credentials are wrong - Check .env file"
    echo "  3. Database already exists - Run 'DROP DATABASE skylark_drones;' first"
    echo ""
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo -e "║                 ${GREEN}✅ DATABASE SETUP COMPLETE${NC}                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}🎉 Next steps:${NC}"
echo "   1. Start backend: npm start"
echo "   2. Open browser: http://localhost:5000/health"
echo "   3. View dashboard at frontend URL"
echo ""

exit 0
