/**
 * Database Migration Script for Skylark Drones
 * Runs PostgreSQL schema initialization
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://skylark:skylark_dev_password@localhost:5432/skylark_drones'
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Running database migration...');
        
        // Read and execute init schema SQL
        const schemaPath = path.join(__dirname, '000_init_schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        await client.query(schemaSql);
        console.log('✓ Database schema initialized successfully');
        
        return true;
    } catch (error) {
        console.error('✗ Migration failed:', error.message);
        return false;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    runMigration().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = runMigration;
