/**
 * Bulk Insert 500+ Vehicles into Database
 * Creates realistic mining equipment data with varying specifications
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mining_iot'
});

const vehicleTypes = ['Dump Truck', 'Excavator', 'Loader', 'Dozer', 'Grader', 'Compactor', 'Motor Grader', 'Articulated Truck'];
const zones = ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F', 'Zone G', 'Zone H'];
const locations = ['North Site', 'South Site', 'East Pit', 'West Pit', 'Central Hub', 'Processing Plant', 'Loading Bay', 'Depot'];

// Generate realistic vehicle data
function generateVehicle(id) {
  const vType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
  const isActive = Math.random() > 0.15; // 85% active, 15% idle
  const speed = isActive ? Math.floor(Math.random() * 55) + 5 : 0; // 5-55 km/h if active, 0 if idle
  const fuel = Math.floor(Math.random() * 60) + 30; // 30-90%
  const temp = Math.floor(Math.random() * 20) + 28; // 28-48°C
  const efficiency = (Math.random() * 3 + 6.5).toFixed(1); // 6.5-9.5 rating
  const location = locations[Math.floor(Math.random() * locations.length)];
  const zone = zones[Math.floor(Math.random() * zones.length)];
  
  // Realistic GPS coordinates (mining site area)
  const lat = (22.5 + Math.random() * 0.1).toFixed(6);
  const lng = (74.5 + Math.random() * 0.1).toFixed(6);
  
  return {
    id,
    name: `Vehicle-${String(id).padStart(4, '0')}`,
    type: vType,
    active: isActive,
    latitude: parseFloat(lat),
    longitude: parseFloat(lng),
    speed: speed,
    fuel: fuel,
    temp: temp,
    efficiency: parseFloat(efficiency),
    location: location,
    zone: zone
  };
}

async function bulkInsertVehicles() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting bulk insert...\n');
    
    // Clear existing vehicles
    console.log('🗑️  Clearing existing vehicles...');
    await client.query('TRUNCATE TABLE vehicles CASCADE');
    
    // Reset sequence
    await client.query(`ALTER SEQUENCE vehicles_id_seq RESTART WITH 1`);
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Number of vehicles to insert
    const vehicleCount = 550;
    const batchSize = 50; // Insert in batches
    let insertedCount = 0;
    
    console.log(`📊 Inserting ${vehicleCount} vehicles in batches of ${batchSize}...\n`);
    
    for (let batch = 0; batch < vehicleCount; batch += batchSize) {
      const batchEnd = Math.min(batch + batchSize, vehicleCount);
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      
      for (let i = batch; i < batchEnd; i++) {
        const vehicle = generateVehicle(i + 1);
        values.push(
          vehicle.name,
          vehicle.type,
          vehicle.active,
          vehicle.latitude,
          vehicle.longitude,
          vehicle.speed,
          vehicle.fuel,
          vehicle.temp,
          vehicle.efficiency,
          vehicle.location,
          new Date().toISOString()
        );
        
        placeholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10})`
        );
        paramIndex += 11;
      }
      
      const query = `
        INSERT INTO vehicles (name, type, active, current_latitude, current_longitude, current_speed_kmh, fuel_percentage, temperature, efficiency_rating, location, updated_at)
        VALUES ${placeholders.join(', ')}
      `;
      
      await client.query(query, values);
      insertedCount = batchEnd;
      
      // Show progress
      const progress = Math.round((insertedCount / vehicleCount) * 100);
      console.log(`  ✓ Batch ${Math.ceil(batch / batchSize)}: ${progress}% complete (${insertedCount}/${vehicleCount})`);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Verify insertion
    const result = await client.query('SELECT COUNT(*) FROM vehicles');
    const totalVehicles = result.rows[0].count;
    
    console.log(`\n✅ Successfully inserted ${totalVehicles} vehicles!`);
    console.log(`\n📊 Database Statistics:`);
    console.log(`   Total Vehicles: ${totalVehicles}`);
    console.log(`   Active Vehicles: ~${Math.round(totalVehicles * 0.85)}`);
    console.log(`   Idle Vehicles: ~${Math.round(totalVehicles * 0.15)}`);
    
    // Show sample vehicles
    const samples = await client.query('SELECT * FROM vehicles LIMIT 5');
    console.log(`\n📋 Sample Vehicles:`);
    samples.rows.forEach(v => {
      console.log(`   • ${v.name}: ${v.type} - ${v.active ? 'Active' : 'Idle'} (Speed: ${v.current_speed_kmh} km/h)`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during bulk insert:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the bulk insert
bulkInsertVehicles().then(() => {
  console.log('\n🎉 Bulk insert completed successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
