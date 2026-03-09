#!/usr/bin/env node
/**
 * Database Verification Script
 * Checks if database is properly set up with all tables and data
 * 
 * Run: node scripts/verify-db.js
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://skylark:skylark_dev_password@localhost:5432/skylark_drones'
});

async function verify() {
  const client = await pool.connect();
  let issues = [];
  let warnings = [];

  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         Database Verification & Health Check              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Test connection
    console.log('🔍 Testing database connection...');
    await client.query('SELECT 1');
    console.log('✅ Database connection: OK\n');

    // Check tables
    console.log('📋 Checking tables...');
    const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(r => r.table_name);
    const requiredTables = ['vehicles', 'gps_points', 'alerts', 'routes', 'hardware_telemetry', 'dashboard_metrics'];
    
    requiredTables.forEach(table => {
      if (tables.includes(table)) {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} - MISSING`);
        issues.push(`Table '${table}' not found`);
      }
    });
    console.log();

    // Check data counts
    console.log('📊 Checking data...');
    const counts = {};

    for (const table of requiredTables) {
      if (tables.includes(table)) {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        counts[table] = parseInt(result.rows[0].count);
        
        // Display with expected count
        let status = '✅';
        let expected = '';
        
        if (table === 'vehicles' && counts[table] !== 550) {
          status = '⚠️ ';
          expected = ` (expected 550, got ${counts[table]})`;
        }
        if (table === 'gps_points' && counts[table] < 5000) {
          status = '⚠️ ';
          expected = ` (expected ~11000, got ${counts[table]})`;
        }
        if (table === 'alerts' && counts[table] < 100) {
          status = '⚠️ ';
          expected = ` (expected ~2750, got ${counts[table]})`;
        }
        if (table === 'routes' && counts[table] !== 8) {
          status = '⚠️ ';
          expected = ` (expected 8, got ${counts[table]})`;
        }
        
        console.log(`  ${status} ${table}: ${counts[table]}${expected}`);
        
        if (counts[table] === 0) {
          warnings.push(`Table '${table}' is empty`);
        }
      }
    }
    console.log();

    // Check sample vehicle
    if (tables.includes('vehicles')) {
      console.log('🚗 Sample Vehicle Data:');
      const vehicleResult = await client.query(
        'SELECT * FROM vehicles LIMIT 1'
      );
      
      if (vehicleResult.rows.length > 0) {
        const vehicle = vehicleResult.rows[0];
        console.log(`  ✅ Vehicle ID: ${vehicle.vehicle_id}`);
        console.log(`  ✅ Name: ${vehicle.name}`);
        console.log(`  ✅ Type: ${vehicle.type}`);
        console.log(`  ✅ Status: ${vehicle.active ? 'Active' : 'Inactive'}`);
        console.log(`  ✅ Location: ${vehicle.latitude}, ${vehicle.longitude}`);
        console.log(`  ✅ Speed: ${vehicle.current_speed_kmh} km/h`);
        console.log(`  ✅ Fuel: ${vehicle.fuel_percentage}%`);
      }
      console.log();
    }

    // Check database size
    console.log('💾 Database Size:');
    const sizeResult = await client.query(`
      SELECT pg_size_pretty(pg_database_size('skylark_drones')) as size
    `);
    console.log(`  ${sizeResult.rows[0].size}\n`);

    // Check indexes
    console.log('🔍 Checking indexes...');
    const indexResult = await client.query(`
      SELECT indexname FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY indexname
    `);
    
    if (indexResult.rows.length > 0) {
      console.log(`  ✅ ${indexResult.rows.length} indexes found`);
      indexResult.rows.forEach(idx => {
        console.log(`     - ${idx.indexname}`);
      });
    } else {
      console.log('  ⚠️ No indexes found');
    }
    console.log();

    // Summary
    console.log('╔════════════════════════════════════════════════════════════╗');
    
    if (issues.length === 0 && warnings.length === 0) {
      console.log('║              ✅ DATABASE VERIFICATION PASSED               ║');
    } else if (issues.length === 0) {
      console.log('║          ⚠️  DATABASE HAS WARNINGS                         ║');
    } else {
      console.log('║              ❌ DATABASE VERIFICATION FAILED               ║');
    }
    
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Display issues and warnings
    if (issues.length > 0) {
      console.log('❌ Issues:');
      issues.forEach(issue => console.log(`  - ${issue}`));
      console.log();
    }

    if (warnings.length > 0) {
      console.log('⚠️  Warnings:');
      warnings.forEach(warning => console.log(`  - ${warning}`));
      console.log();
    }

    // Statistics
    console.log('📈 Statistics:');
    console.log(`  Total Vehicles: ${counts.vehicles || 0}`);
    console.log(`  Total GPS Points: ${counts.gps_points || 0}`);
    console.log(`  Total Alerts: ${counts.alerts || 0}`);
    console.log(`  Total Routes: ${counts.routes || 0}`);
    console.log(`  Total Telemetry Records: ${counts.hardware_telemetry || 0}`);
    console.log();

    // Final status
    if (issues.length > 0) {
      console.log('❌ Status: FAILED - Please run setup again');
      console.log('   Command: node scripts/setup-complete-db.js\n');
      process.exit(1);
    } else if (warnings.length > 0) {
      console.log('⚠️  Status: WARNING - Database is partially set up');
      console.log('   Some data is missing or incomplete\n');
      process.exit(0);
    } else {
      console.log('✅ Status: HEALTHY - Database is ready for production\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Check if PostgreSQL is running');
    console.error('  2. Verify DATABASE_URL in .env file');
    console.error('  3. Run: node scripts/setup-complete-db.js\n');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(console.error);
