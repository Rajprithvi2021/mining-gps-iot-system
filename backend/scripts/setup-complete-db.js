#!/usr/bin/env node
/**
 * Complete Database Setup & Seeding Script
 * Creates all tables and populates with 550 realistic mining vehicles
 * 
 * Run: node scripts/setup-complete-db.js
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://skylark:skylark_dev_password@localhost:5432/skylark_drones';
const VEHICLE_COUNT = 550;
const GPS_POINTS_PER_VEHICLE = 20;
const ROUTES_COUNT = 8;

// Mining site coordinates (realistic Indian mining areas)
const MINING_SITES = [
  { name: 'Chhattisgarh - Zone A', lat: 21.5589, lng: 72.6251, radius: 0.05 },
  { name: 'Jharkhand - Zone B', lat: 22.9375, lng: 84.8440, radius: 0.05 },
  { name: 'Odisha - Zone C', lat: 20.9517, lng: 84.0055, radius: 0.05 },
  { name: 'Karnataka - Zone D', lat: 14.5204, lng: 75.8950, radius: 0.05 },
  { name: 'Telangana - Zone E', lat: 17.3850, lng: 78.4867, radius: 0.05 },
  { name: 'Madhya Pradesh - Zone F', lat: 22.9068, lng: 78.6091, radius: 0.05 },
  { name: 'Maharashtra - Zone G', lat: 19.7515, lng: 75.7139, radius: 0.05 },
  { name: 'Rajasthan - Zone H', lat: 27.7172, lng: 73.7619, radius: 0.05 }
];

const VEHICLE_TYPES = [
  'Dump Truck',
  'Articulated Truck',
  'Excavator',
  'Wheel Loader',
  'Dozer',
  'Motor Grader',
  'Compactor',
  'Water Tanker',
  'Hyab Truck',
  'Haul Truck'
];

const ALERT_TYPES = [
  'SPEEDING',
  'HARSH_ACCELERATION',
  'IDLE_TIMEOUT',
  'ROUTE_DEVIATION',
  'FUEL_ANOMALY',
  'ENGINE_TEMPERATURE_HIGH',
  'LOW_FUEL_LEVEL'
];

// Initialize database pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

// Utility functions
function generateRandomCoordinate(centerLat, centerLng, radius) {
  const lat = centerLat + (Math.random() - 0.5) * radius;
  const lng = centerLng + (Math.random() - 0.5) * radius;
  return { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
}

function generateVehicleData(index) {
  const site = MINING_SITES[index % MINING_SITES.length];
  const coords = generateRandomCoordinate(site.lat, site.lng, site.radius);
  const typeIndex = index % VEHICLE_TYPES.length;
  const isActive = Math.random() > 0.15; // 85% active
  
  return {
    vehicle_id: `VEH${String(index + 1).padStart(4, '0')}`,
    name: `Vehicle ${VEHICLE_TYPES[typeIndex]}-${String(index + 1).padStart(3, '0')}`,
    type: VEHICLE_TYPES[typeIndex],
    driver_name: `Driver-${String(index + 1).padStart(4, '0')}`,
    driver_id: `DRV${String(index + 1).padStart(4, '0')}`,
    license_plate: `MH${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
    color: ['Red', 'Blue', 'Yellow', 'White', 'Silver', 'Black'][Math.floor(Math.random() * 6)],
    active: isActive,
    latitude: coords.lat,
    longitude: coords.lng,
    speed: isActive ? Math.floor(Math.random() * 60) + 10 : 0,
    fuel: Math.floor(Math.random() * 70) + 20, // 20-90%
    temperature: Math.floor(Math.random() * 25) + 65, // 65-90°C
    efficiency: Math.random() * 2.5 + 6.5, // 6.5-9.0 km/l
    site: site.name,
    zone: site.name.split(' - ')[1]
  };
}

function generateGPSPoints(vehicleId, count = GPS_POINTS_PER_VEHICLE) {
  const points = [];
  const site = MINING_SITES[parseInt(vehicleId.substring(3)) % MINING_SITES.length];
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(Date.now() - (count - i) * 5 * 60000); // 5 min intervals
    const coords = generateRandomCoordinate(site.lat, site.lng, site.radius * 0.5);
    
    points.push({
      vehicle_id: vehicleId,
      latitude: coords.lat,
      longitude: coords.lng,
      speed: Math.floor(Math.random() * 60),
      heading: Math.floor(Math.random() * 360),
      altitude: 200 + Math.floor(Math.random() * 300),
      accuracy: Math.floor(Math.random() * 15) + 3,
      satellites: Math.floor(Math.random() * 8) + 10,
      hdop: (Math.random() * 2).toFixed(1),
      timestamp: timestamp.toISOString()
    });
  }
  
  return points;
}

function generateAlerts(vehicleId, count = 3) {
  const alerts = [];
  const alertTypes = ['SPEEDING', 'HARSH_ACCELERATION', 'IDLE_TIMEOUT', 'FUEL_ANOMALY'];
  
  for (let i = 0; i < count; i++) {
    if (Math.random() > 0.7) { // Only 30% of vehicles have unresolved alerts
      const severity = ['CRITICAL', 'HIGH', 'MEDIUM'];
      alerts.push({
        vehicle_id: vehicleId,
        type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
        severity: severity[Math.floor(Math.random() * severity.length)],
        message: `Alert for ${vehicleId}`,
        resolved: Math.random() > 0.3, // 70% resolved
        created_at: new Date(Date.now() - Math.random() * 24 * 60 * 60000).toISOString()
      });
    }
  }
  
  return alerts;
}

function generateHardwareTelemetry(vehicleId) {
  return {
    vehicle_id: vehicleId,
    engine_temp: Math.floor(Math.random() * 25) + 65,
    fuel_level: Math.floor(Math.random() * 70) + 20,
    battery_voltage: parseFloat((12 + Math.random() * 0.5).toFixed(2)),
    rpm: Math.floor(Math.random() * 2500) + 500,
    oil_pressure: Math.floor(Math.random() * 40) + 20,
    gear: ['P', 'R', 'N', 'D'][Math.floor(Math.random() * 4)],
    timestamp: new Date().toISOString()
  };
}

async function createTables(client) {
  console.log('\n📋 Creating tables...');
  
  const sql = `
    -- Enable extensions (if available)
    -- Note: PostGIS not required for basic functionality

    -- ============================================================================
    -- VEHICLES TABLE
    -- ============================================================================
    DROP TABLE IF EXISTS vehicles CASCADE;
    CREATE TABLE vehicles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        driver_id VARCHAR(50),
        driver_name VARCHAR(100),
        license_plate VARCHAR(20),
        color VARCHAR(20),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_gps_update TIMESTAMP,
        current_latitude DECIMAL(10, 8),
        current_longitude DECIMAL(11, 8),
        current_speed_kmh DECIMAL(5, 2) DEFAULT 0,
        fuel_percentage INTEGER DEFAULT 100,
        temperature DECIMAL(5, 2),
        efficiency_rating DECIMAL(3, 1),
        location VARCHAR(100)
    );

    CREATE INDEX idx_vehicles_active ON vehicles(active);
    CREATE INDEX idx_vehicles_vehicle_id ON vehicles(vehicle_id);
    CREATE INDEX idx_vehicles_updated ON vehicles(updated_at DESC);

    -- ============================================================================
    -- GPS POINTS TABLE (Partitioned)
    -- ============================================================================
    DROP TABLE IF EXISTS gps_points CASCADE;
    CREATE TABLE gps_points (
        id UUID DEFAULT gen_random_uuid(),
        vehicle_id VARCHAR(50) NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        speed_kmh DECIMAL(5, 2) DEFAULT 0,
        heading_degrees DECIMAL(5, 2),
        accuracy_m DECIMAL(5, 2),
        satellites_count SMALLINT,
        hdop DECIMAL(4, 2),
        timestamp TIMESTAMP NOT NULL,
        gps_source VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at);

    -- Create partition for current month (March 2026)
    CREATE TABLE gps_points_202603 PARTITION OF gps_points
        FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

    CREATE INDEX idx_gps_vehicle_time ON gps_points(vehicle_id, timestamp DESC);
    CREATE INDEX idx_gps_timestamp ON gps_points(timestamp DESC);

    -- ============================================================================
    -- ROUTES TABLE
    -- ============================================================================
    DROP TABLE IF EXISTS routes CASCADE;
    CREATE TABLE routes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        waypoints JSONB NOT NULL,
        deviation_threshold_m INTEGER DEFAULT 50,
        expected_duration_min INTEGER,
        expected_distance_km DECIMAL(6, 2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by VARCHAR(100)
    );

    CREATE INDEX idx_routes_name ON routes(name);

    -- ============================================================================
    -- ALERTS TABLE (Partitioned)
    -- ============================================================================
    DROP TABLE IF EXISTS alerts CASCADE;
    CREATE TABLE alerts (
        id UUID DEFAULT gen_random_uuid(),
        vehicle_id VARCHAR(50) NOT NULL,
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium',
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        timestamp TIMESTAMP NOT NULL,
        description TEXT,
        metadata JSONB,
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP,
        resolved_by VARCHAR(100),
        resolution_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at);

    CREATE TABLE alerts_202603 PARTITION OF alerts
        FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

    CREATE INDEX idx_alerts_vehicle_unresolved ON alerts(vehicle_id) WHERE resolved = FALSE;
    CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

    -- ============================================================================
    -- HARDWARE TELEMETRY TABLE
    -- ============================================================================
    DROP TABLE IF EXISTS hardware_telemetry CASCADE;
    CREATE TABLE hardware_telemetry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_id VARCHAR(50) NOT NULL,
        engine_temp DECIMAL(5, 2),
        fuel_level INTEGER,
        battery_voltage DECIMAL(4, 2),
        rpm INTEGER,
        oil_pressure INTEGER,
        gear VARCHAR(5),
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX idx_telemetry_vehicle_time ON hardware_telemetry(vehicle_id, timestamp DESC);

    -- ============================================================================
    -- DASHBOARD METRICS TABLE (For KPI aggregation)
    -- ============================================================================
    DROP TABLE IF EXISTS dashboard_metrics CASCADE;
    CREATE TABLE dashboard_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        active_vehicles INTEGER,
        total_vehicles INTEGER,
        fuel_consumption_liters DECIMAL(10, 2),
        efficiency_rating DECIMAL(3, 1),
        cost_per_km DECIMAL(6, 2),
        avg_temperature DECIMAL(5, 2),
        system_uptime DECIMAL(5, 2),
        recorded_at TIMESTAMP DEFAULT NOW()
    );
  `;

  try {
    await client.query(sql);
    console.log('✅ All tables created successfully');
  } catch (err) {
    console.error('❌ Error creating tables:', err.message);
    throw err;
  }
}

async function insertVehicles(client) {
  console.log(`\n🚗 Inserting ${VEHICLE_COUNT} vehicles...`);
  
  const batchSize = 50;
  let inserted = 0;

  for (let batch = 0; batch < VEHICLE_COUNT; batch += batchSize) {
    const batchEnd = Math.min(batch + batchSize, VEHICLE_COUNT);
    const values = [];
    let paramIndex = 1;
    
    for (let i = batch; i < batchEnd; i++) {
      const vehicle = generateVehicleData(i);
      values.push(
        vehicle.vehicle_id,
        vehicle.name,
        vehicle.type,
        vehicle.driver_id,
        vehicle.driver_name,
        vehicle.license_plate,
        vehicle.color,
        vehicle.active,
        vehicle.latitude,
        vehicle.longitude,
        vehicle.speed,
        vehicle.fuel,
        vehicle.temperature,
        vehicle.efficiency,
        vehicle.site
      );
      paramIndex++;
    }

    const placeholders = Array.from({ length: batchEnd - batch }, (_, i) => 
      `($${i * 15 + 1}, $${i * 15 + 2}, $${i * 15 + 3}, $${i * 15 + 4}, $${i * 15 + 5}, $${i * 15 + 6}, $${i * 15 + 7}, $${i * 15 + 8}, $${i * 15 + 9}, $${i * 15 + 10}, $${i * 15 + 11}, $${i * 15 + 12}, $${i * 15 + 13}, $${i * 15 + 14}, $${i * 15 + 15})`
    ).join(',');

    const query = `
      INSERT INTO vehicles (
        vehicle_id, name, type, driver_id, driver_name, license_plate, color, 
        active, current_latitude, current_longitude, current_speed_kmh, fuel_percentage, 
        temperature, efficiency_rating, location
      ) VALUES ${placeholders}
    `;

    try {
      await client.query(query, values);
      inserted += (batchEnd - batch);
      process.stdout.write(`\r  Progress: ${inserted}/${VEHICLE_COUNT} vehicles inserted`);
    } catch (err) {
      console.error(`\n❌ Error inserting batch ${batch}-${batchEnd}:`, err.message);
      throw err;
    }
  }

  console.log(`\n✅ ${VEHICLE_COUNT} vehicles inserted successfully`);
}

async function insertGPSData(client) {
  console.log(`\n📍 Inserting GPS data (${VEHICLE_COUNT * GPS_POINTS_PER_VEHICLE} points)...`);
  
  const batchSize = 10; // vehicles per batch
  let processed = 0;

  for (let batch = 0; batch < VEHICLE_COUNT; batch += batchSize) {
    const batchEnd = Math.min(batch + batchSize, VEHICLE_COUNT);
    const values = [];
    let paramIndex = 1;

    for (let i = batch; i < batchEnd; i++) {
      const vehicleId = `VEH${String(i + 1).padStart(4, '0')}`;
      const gpsPoints = generateGPSPoints(vehicleId, GPS_POINTS_PER_VEHICLE);

      gpsPoints.forEach(point => {
        values.push(
          point.vehicle_id,
          point.latitude,
          point.longitude,
          point.speed,
          point.heading,
          point.accuracy,
          point.satellites,
          point.hdop,
          point.timestamp,
          'GPS_NEO6M'
        );
        paramIndex++;
      });
    }

    const placeholders = Array.from(
      { length: (batchEnd - batch) * GPS_POINTS_PER_VEHICLE },
      (_, i) => 
        `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`
    ).join(',');

    const query = `
      INSERT INTO gps_points (
        vehicle_id, latitude, longitude, speed_kmh, heading_degrees, 
        accuracy_m, satellites_count, hdop, timestamp, gps_source
      ) VALUES ${placeholders}
    `;

    try {
      await client.query(query, values);
      processed += (batchEnd - batch);
      process.stdout.write(`\r  Progress: ${processed}/${VEHICLE_COUNT} vehicles processed`);
    } catch (err) {
      console.error(`\n❌ Error inserting GPS data:`, err.message);
      throw err;
    }
  }

  console.log(`\n✅ GPS data inserted successfully`);
}

async function insertAlerts(client) {
  console.log(`\n⚠️  Creating sample alerts...`);
  
  const batchSize = 50;
  let inserted = 0;
  const totalAlerts = Math.floor(VEHICLE_COUNT * 0.3 * 3); // 30% of vehicles with ~3 alerts each

  for (let i = 0; i < VEHICLE_COUNT; i += batchSize) {
    const batchEnd = Math.min(i + batchSize, VEHICLE_COUNT);
    const values = [];
    let paramIndex = 1;

    for (let j = i; j < batchEnd; j++) {
      const vehicleId = `VEH${String(j + 1).padStart(4, '0')}`;
      const alerts = generateAlerts(vehicleId);

      alerts.forEach(alert => {
        values.push(
          alert.vehicle_id,
          alert.type,
          alert.severity,
          null, // latitude
          null, // longitude
          new Date(alert.created_at).toISOString(),
          alert.message,
          JSON.stringify({}),
          alert.resolved,
          alert.resolved ? new Date(alert.created_at) : null,
          alert.resolved ? 'system' : null,
          ''
        );
        paramIndex++;
      });
    }

    if (values.length === 0) continue;

    const alertCount = values.length / 12;
    const placeholders = Array.from(
      { length: alertCount },
      (_, i) => 
        `($${i * 12 + 1}, $${i * 12 + 2}, $${i * 12 + 3}, $${i * 12 + 4}, $${i * 12 + 5}, $${i * 12 + 6}, $${i * 12 + 7}, $${i * 12 + 8}, $${i * 12 + 9}, $${i * 12 + 10}, $${i * 12 + 11}, $${i * 12 + 12})`
    ).join(',');

    const query = `
      INSERT INTO alerts (
        vehicle_id, alert_type, severity, latitude, longitude, timestamp, 
        description, metadata, resolved, resolved_at, resolved_by, resolution_notes
      ) VALUES ${placeholders}
    `;

    try {
      await client.query(query, values);
      inserted += alertCount;
      process.stdout.write(`\r  Progress: ${Math.min(inserted, totalAlerts)}/${totalAlerts} alerts created`);
    } catch (err) {
      console.error(`\n❌ Error inserting alerts:`, err.message);
      throw err;
    }
  }

  console.log(`\n✅ Alerts created successfully`);
}

async function insertHardwareTelemetry(client) {
  console.log(`\n🔧 Inserting hardware telemetry data...`);
  
  const batchSize = 50;
  let inserted = 0;

  for (let batch = 0; batch < VEHICLE_COUNT; batch += batchSize) {
    const batchEnd = Math.min(batch + batchSize, VEHICLE_COUNT);
    const values = [];
    let paramIndex = 1;

    for (let i = batch; i < batchEnd; i++) {
      const vehicleId = `VEH${String(i + 1).padStart(4, '0')}`;
      const telemetry = generateHardwareTelemetry(vehicleId);

      values.push(
        telemetry.vehicle_id,
        telemetry.engine_temp,
        telemetry.fuel_level,
        telemetry.battery_voltage,
        telemetry.rpm,
        telemetry.oil_pressure,
        telemetry.gear,
        telemetry.timestamp
      );
      paramIndex++;
    }

    const placeholders = Array.from(
      { length: batchEnd - batch },
      (_, i) => 
        `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`
    ).join(',');

    const query = `
      INSERT INTO hardware_telemetry (
        vehicle_id, engine_temp, fuel_level, battery_voltage, 
        rpm, oil_pressure, gear, timestamp
      ) VALUES ${placeholders}
    `;

    try {
      await client.query(query, values);
      inserted += (batchEnd - batch);
      process.stdout.write(`\r  Progress: ${inserted}/${VEHICLE_COUNT} vehicles processed`);
    } catch (err) {
      console.error(`\n❌ Error inserting telemetry:`, err.message);
      throw err;
    }
  }

  console.log(`\n✅ Hardware telemetry inserted successfully`);
}

async function insertRoutes(client) {
  console.log(`\n🛣️  Creating sample routes...`);
  
  const routes = MINING_SITES.map((site, index) => ({
    name: `Route-${String(index + 1).padStart(2, '0')}`,
    description: `Mining route in ${site.name}`,
    waypoints: [
      { lat: site.lat, lng: site.lng, name: 'Start' },
      { lat: site.lat + 0.01, lng: site.lng + 0.01, name: 'Checkpoint 1' },
      { lat: site.lat - 0.01, lng: site.lng + 0.01, name: 'End' }
    ],
    deviation_threshold_m: 50,
    expected_duration_min: 180,
    expected_distance_km: parseFloat((15 + Math.random() * 25).toFixed(2))
  }));

  try {
    for (const route of routes) {
      await client.query(
        `INSERT INTO routes (name, description, waypoints, deviation_threshold_m, expected_duration_min, expected_distance_km)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [route.name, route.description, JSON.stringify(route.waypoints), route.deviation_threshold_m, route.expected_duration_min, route.expected_distance_km]
      );
    }
    console.log(`✅ ${routes.length} routes created successfully`);
  } catch (err) {
    console.error('❌ Error inserting routes:', err.message);
    throw err;
  }
}

async function insertDashboardMetrics(client) {
  console.log(`\n📊 Creating dashboard metrics...`);
  
  try {
    await client.query(
      `INSERT INTO dashboard_metrics (active_vehicles, total_vehicles, fuel_consumption_liters, efficiency_rating, cost_per_km, avg_temperature, system_uptime)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [468, VEHICLE_COUNT, 2867.89, 8.2, 12.50, 72.5, 99.2]
    );
    console.log('✅ Dashboard metrics created successfully');
  } catch (err) {
    console.error('❌ Error inserting metrics:', err.message);
    throw err;
  }
}

// Main execution
async function main() {
  const client = await pool.connect();

  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     Mining GPS IoT System - Database Setup & Seeding       ║');
    console.log('║                  Complete Initialization                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    await createTables(client);
    await insertVehicles(client);
    await insertGPSData(client);
    await insertAlerts(client);
    await insertHardwareTelemetry(client);
    await insertRoutes(client);
    await insertDashboardMetrics(client);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                 ✅ DATABASE SETUP COMPLETE                 ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  ✅ Vehicles Created:           ${VEHICLE_COUNT}                    ║`);
    console.log(`║  ✅ GPS Data Points:            ${VEHICLE_COUNT * GPS_POINTS_PER_VEHICLE}                     ║`);
    console.log(`║  ✅ Alerts Created:             ~${Math.floor(VEHICLE_COUNT * 0.3 * 3)}                      ║`);
    console.log(`║  ✅ Hardware Telemetry:         ${VEHICLE_COUNT}                    ║`);
    console.log(`║  ✅ Routes Created:             ${MINING_SITES.length}                        ║`);
    console.log('║  ✅ Dashboard Metrics:         Ready                    ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Status: 🟢 PRODUCTION READY                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
