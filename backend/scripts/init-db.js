#!/usr/bin/env node
/**
 * Database Initialization Script
 * Creates tables and inserts sample data into PostgreSQL
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres' // Connect to default db first
});

const DATABASE_NAME = process.env.DB_NAME || 'mining_iot';

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Initializing DatabaseDatabase...');

    // Create database if not exists
    const dbExists = await client.query(
      `SELECT datname FROM pg_catalog.pg_database WHERE datname = '${DATABASE_NAME}'`
    );

    if (dbExists.rows.length === 0) {
      console.log(`📦 Creating database: ${DATABASE_NAME}`);
      await client.query(`CREATE DATABASE ${DATABASE_NAME}`);
      console.log(`✅ Database created: ${DATABASE_NAME}`);
    } else {
      console.log(`✅ Database already exists: ${DATABASE_NAME}`);
    }

  } finally {
    client.release();
  }

  // Connect to the actual database
  const dbPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: DATABASE_NAME
  });

  const dbClient = await dbPool.connect();

  try {
    console.log('\n📋 Creating tables...');

    // Create tables
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        type VARCHAR(50),
        active BOOLEAN DEFAULT true,
        current_latitude DECIMAL(9, 6),
        current_longitude DECIMAL(9, 6),
        current_speed_kmh DECIMAL(5, 2) DEFAULT 0,
        fuel_percentage INTEGER DEFAULT 100,
        temperature DECIMAL(5, 2),
        location VARCHAR(100),
        efficiency_rating DECIMAL(3, 1),
        last_gps_update TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ vehicles table created');

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id),
        vehicle_name VARCHAR(100),
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT,
        resolved BOOLEAN DEFAULT false,
        acknowledged BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ alerts table created');

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS gps_readings (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id),
        latitude DECIMAL(9, 6),
        longitude DECIMAL(9, 6),
        speed_kmh DECIMAL(5, 2),
        altitude_m DECIMAL(8, 2),
        accuracy_m DECIMAL(5, 2),
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ gps_readings table created');

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS dashboard_metrics (
        id SERIAL PRIMARY KEY,
        active_vehicles INTEGER,
        total_vehicles INTEGER,
        fuel_consumption_liters DECIMAL(10, 2),
        efficiency_rating DECIMAL(3, 1),
        cost_per_km DECIMAL(6, 2),
        avg_temperature DECIMAL(5, 2),
        system_uptime DECIMAL(5, 2),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ dashboard_metrics table created');

    // Clear existing data
    console.log('\n🗑️  Clearing existing data...');
    await dbClient.query('TRUNCATE TABLE alerts, gps_readings, vehicles, dashboard_metrics CASCADE');
    console.log('✅ Data cleared');

    // Insert vehicles
    console.log('\n➕ Inserting sample vehicles...');
    const vehicles = [
      { name: 'Truck-001', type: 'Excavator', latitude: 48.8566, longitude: 2.3522, speed: 45, fuel: 75, temp: 45, location: 'Zone A', efficiency: 8 },
      { name: 'Truck-002', type: 'Dump Truck', latitude: 48.8590, longitude: 2.3510, speed: 52, fuel: 60, temp: 42, location: 'Zone B', efficiency: 7 },
      { name: 'Truck-003', type: 'Loader', latitude: 48.8540, longitude: 2.3535, speed: 38, fuel: 85, temp: 38, location: 'Zone C', efficiency: 9 },
      { name: 'Truck-004', type: 'Excavator', latitude: 48.8500, longitude: 2.3450, speed: 0, fuel: 40, temp: 28, location: 'Base', efficiency: 6, active: false },
      { name: 'Truck-005', type: 'Dump Truck', latitude: 48.8555, longitude: 2.3545, speed: 48, fuel: 70, temp: 41, location: 'Zone A', efficiency: 8 }
    ];

    const vehicleIds = {};
    for (const v of vehicles) {
      const result = await dbClient.query(
        `INSERT INTO vehicles (name, type, active, current_latitude, current_longitude, current_speed_kmh, fuel_percentage, temperature, location, efficiency_rating, last_gps_update)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         RETURNING id`,
        [v.name, v.type, v.active !== false, v.latitude, v.longitude, v.speed, v.fuel, v.temp, v.location, v.efficiency]
      );
      vehicleIds[v.name] = result.rows[0].id;
    }
    console.log(`✅ ${vehicles.length} vehicles inserted`);

    // Insert alerts
    console.log('\n➕ Inserting sample alerts...');
    const alerts = [
      { vehicle_name: 'Truck-001', type: 'High Temperature', severity: 'warning', message: 'Engine temperature exceeded threshold' },
      { vehicle_name: 'Truck-004', type: 'Fuel Low', severity: 'critical', message: 'Fuel level below 50%' },
      { vehicle_name: 'Truck-002', type: 'Route Deviation', severity: 'info', message: 'Vehicle deviated from planned route' },
      { vehicle_name: 'Truck-003', type: 'Idle Detected', severity: 'info', message: 'Vehicle idle for 25 minutes' }
    ];

    for (const a of alerts) {
      const vehicleId = vehicleIds[a.vehicle_name];
      if (vehicleId) {
        await dbClient.query(
          `INSERT INTO alerts (vehicle_id, vehicle_name, type, severity, message)
           VALUES ($1, $2, $3, $4, $5)`,
          [vehicleId, a.vehicle_name, a.type, a.severity, a.message]
        );
      }
    }
    console.log(`✅ ${alerts.length} alerts inserted`);

    // Insert GPS readings
    console.log('\n➕ Inserting GPS readings...');
    const now = new Date();
    const gpsReadings = [
      { vehicle_name: 'Truck-001', lat: 48.8566, lon: 2.3522, speed: 45 },
      { vehicle_name: 'Truck-002', lat: 48.8590, lon: 2.3510, speed: 52 },
      { vehicle_name: 'Truck-003', lat: 48.8540, lon: 2.3535, speed: 38 },
      { vehicle_name: 'Truck-004', lat: 48.8500, lon: 2.3450, speed: 0 },
      { vehicle_name: 'Truck-005', lat: 48.8555, lon: 2.3545, speed: 48 }
    ];

    for (const gps of gpsReadings) {
      const vehicleId = vehicleIds[gps.vehicle_name];
      if (vehicleId) {
        await dbClient.query(
          `INSERT INTO gps_readings (vehicle_id, latitude, longitude, speed_kmh, timestamp)
           VALUES ($1, $2, $3, $4, NOW())`,
          [vehicleId, gps.lat, gps.lon, gps.speed]
        );
      }
    }
    console.log(`✅ ${gpsReadings.length} GPS readings inserted`);

    // Insert dashboard metrics
    console.log('\n➕ Inserting dashboard metrics...');
    await dbClient.query(
      `INSERT INTO dashboard_metrics (active_vehicles, total_vehicles, fuel_consumption_liters, efficiency_rating, cost_per_km, avg_temperature, system_uptime)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [4, 5, 4500, 8.5, 125, 35.75, 99.8]
    );
    console.log('✅ Dashboard metrics inserted');

    console.log('\n✅ Database initialization complete!');
    console.log(`📊 Database: ${DATABASE_NAME}`);
    console.log('📦 Tables: vehicles, alerts, gps_readings, dashboard_metrics');
    console.log('📈 Sample data: 5 vehicles, 4 alerts, 5 GPS readings');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    dbClient.release();
    await dbPool.end();
    await pool.end();
  }
}

initializeDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
