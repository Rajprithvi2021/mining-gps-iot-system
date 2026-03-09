#!/usr/bin/env node
/**
 * Fix Fuel Data Script
 * Updates all vehicles with proper fuel percentages
 * Also updates hardware telemetry with fuel levels
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://skylark:skylark_dev_password@localhost:5432/skylark_drones';

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10
});

async function fixFuelData() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing fuel data in database...\n');

    // Fix 1: Update vehicles table - Set proper fuel_percentage values
    console.log('1️⃣  Updating fuel_percentage in vehicles table...');
    const fixVehiclesFuelResult = await client.query(`
      UPDATE vehicles
      SET fuel_percentage = (20 + floor(random() * 70))::INTEGER
      WHERE vehicle_id IS NOT NULL
    `);
    console.log(`✅ Updated ${fixVehiclesFuelResult.rowCount} vehicles with fuel percentages (20-90%)\n`);

    // Fix 2: Update hardware telemetry - Set proper fuel_level values
    console.log('2️⃣  Updating fuel_level in hardware_telemetry table...');
    const fixTelemetryResult = await client.query(`
      UPDATE hardware_telemetry
      SET fuel_level = (20 + floor(random() * 70))::INTEGER
      WHERE vehicle_id IS NOT NULL
    `);
    console.log(`✅ Updated ${fixTelemetryResult.rowCount} hardware telemetry records with fuel levels\n`);

    // Fix 3: Update dashboard metrics - Set proper fuel consumption values
    console.log('3️⃣  Updating fuel_consumption_liters in dashboard_metrics...');
    const fixMetricsResult = await client.query(`
      UPDATE dashboard_metrics
      SET fuel_consumption_liters = (2500 + random() * 1000)::DECIMAL(10, 2)
      WHERE recorded_at IS NOT NULL
    `);
    console.log(`✅ Updated ${fixMetricsResult.rowCount} dashboard metrics with fuel consumption\n`);

    // Fix 4: Verify the fix
    console.log('4️⃣  Verifying fuel data...');
    
    const vehiclesCheck = await client.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN fuel_percentage > 0 THEN 1 END) as with_fuel,
        AVG(fuel_percentage)::DECIMAL(5,2) as avg_fuel,
        MIN(fuel_percentage) as min_fuel,
        MAX(fuel_percentage) as max_fuel
      FROM vehicles
    `);
    
    const vCheck = vehiclesCheck.rows[0];
    console.log(`   Vehicles Table:`);
    console.log(`   - Total vehicles: ${vCheck.total_count}`);
    console.log(`   - Vehicles with fuel > 0: ${vCheck.with_fuel}`);
    console.log(`   - Average fuel: ${vCheck.avg_fuel}%`);
    console.log(`   - Min fuel: ${vCheck.min_fuel}%`);
    console.log(`   - Max fuel: ${vCheck.max_fuel}%\n`);

    const telemetryCheck = await client.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN fuel_level > 0 THEN 1 END) as with_fuel,
        AVG(fuel_level)::DECIMAL(5,2) as avg_fuel,
        MIN(fuel_level) as min_fuel,
        MAX(fuel_level) as max_fuel
      FROM hardware_telemetry
    `);
    
    const tCheck = telemetryCheck.rows[0];
    console.log(`   Hardware Telemetry Table:`);
    console.log(`   - Total telemetry records: ${tCheck.total_count}`);
    console.log(`   - Records with fuel > 0: ${tCheck.with_fuel}`);
    console.log(`   - Average fuel: ${tCheck.avg_fuel}`);
    console.log(`   - Min fuel: ${tCheck.min_fuel}`);
    console.log(`   - Max fuel: ${tCheck.max_fuel}\n`);

    const metricsCheck = await client.query(`
      SELECT 
        fuel_consumption_liters,
        recorded_at
      FROM dashboard_metrics
      ORDER BY recorded_at DESC
      LIMIT 1
    `);
    
    if (metricsCheck.rows.length > 0) {
      const mCheck = metricsCheck.rows[0];
      console.log(`   Dashboard Metrics Table:`);
      console.log(`   - Fuel consumption: ${mCheck.fuel_consumption_liters} liters`);
      console.log(`   - Last updated: ${mCheck.recorded_at}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Fuel data fix completed successfully!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📱 Restart the backend to see updated fuel data:');
    console.log('   cd backend && npm start\n');

  } catch (error) {
    console.error('❌ Error fixing fuel data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixFuelData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
