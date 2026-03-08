-- Skylark Drones Database Schema Initialization
-- This script initializes all required tables for the mining GPS IoT system

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organizations(id),
    vehicle_id VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(100),
    license_plate VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GPS Data table (TimescaleDB hypertable for time-series)
CREATE TABLE IF NOT EXISTS gps_data (
    time TIMESTAMP NOT NULL,
    vehicle_id VARCHAR(50) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    altitude DECIMAL(10, 2),
    speed DECIMAL(10, 2),
    heading DECIMAL(10, 2),
    accuracy DECIMAL(10, 2),
    satellites_used SMALLINT,
    hdop DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create TimescaleDB hypertable for better performance
SELECT create_hypertable('gps_data', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time ON gps_data (vehicle_id, time DESC);

-- Anomalies table
CREATE TABLE IF NOT EXISTS anomalies (
    id SERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    description TEXT,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20),
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    start_lat DECIMAL(10, 8),
    start_lon DECIMAL(11, 8),
    end_lat DECIMAL(10, 8),
    end_lon DECIMAL(11, 8),
    distance DECIMAL(10, 2),
    duration INTERVAL,
    status VARCHAR(20)
);

-- Daily metrics table
CREATE TABLE IF NOT EXISTS daily_vehicle_metrics (
    id SERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    total_distance DECIMAL(10, 2),
    total_idle_time INTERVAL,
    avg_speed DECIMAL(10, 2),
    max_speed DECIMAL(10, 2),
    anomaly_count INTEGER,
    fuel_consumed DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vehicle_id, date)
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_org ON vehicles(org_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_vehicle_time ON anomalies(vehicle_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_vehicle_time ON alerts(vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_time ON trips(vehicle_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_vehicle_date ON daily_vehicle_metrics(vehicle_id, date DESC);

COMMIT;
