/**
 * Add sample alerts to the database
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mining_iot'
});

async function addAlerts() {
  try {
    const result = await pool.query(`
      INSERT INTO alerts (vehicle_id, vehicle_name, type, severity, message, resolved, acknowledged, created_at) 
      VALUES 
        (1, 'Vehicle-0001', 'High Temperature', 'warning', 'Temperature exceeds 45C', false, false, NOW()),
        (4, 'Vehicle-0004', 'Idle Detected', 'info', 'Vehicle idle for 30 minutes', false, true, NOW()),
        (2, 'Vehicle-0002', 'Route Deviation', 'info', 'Vehicle off designated route', false, false, NOW()),
        (4, 'Vehicle-0004', 'Fuel Low', 'critical', 'Fuel level below 40 percent', false, false, NOW()),
        (3, 'Vehicle-0003', 'Low Fuel', 'warning', 'Fuel level below 50 percent', false, false, NOW()),
        (5, 'Vehicle-0005', 'Maintenance Due', 'warning', 'Service required soon', false, false, NOW())
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Added 6 sample alerts');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addAlerts();
