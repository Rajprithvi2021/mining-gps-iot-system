-- Mining GPS IoT System Database Schema
-- PostgreSQL 12+
-- With PostGIS for geospatial queries

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- VEHICLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    driver_id VARCHAR(50),
    driver_name VARCHAR(100),
    color VARCHAR(7),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_gps_update TIMESTAMP,
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    current_speed_kmh DECIMAL(5, 2) DEFAULT 0
);

CREATE INDEX idx_vehicles_active ON vehicles(active);
CREATE INDEX idx_vehicles_updated ON vehicles(updated_at DESC);

-- ============================================================================
-- GPS POINTS TABLE (Partitioned by month for performance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gps_points (
    id UUID DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
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

-- Create partition for March 2026
CREATE TABLE IF NOT EXISTS gps_points_202603 PARTITION OF gps_points
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE INDEX idx_gps_vehicle_time ON gps_points(vehicle_id, timestamp DESC);
CREATE INDEX idx_gps_timestamp ON gps_points(timestamp);

-- ============================================================================
-- ROUTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS routes (
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
-- ALERTS TABLE (Partitioned by date)
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    id UUID DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS alerts_202603 PARTITION OF alerts
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE INDEX idx_alerts_vehicle_unresolved ON alerts(vehicle_id) 
    WHERE resolved = FALSE;
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX idx_alerts_type ON alerts(alert_type);

-- ============================================================================
-- IDLE SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS idle_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_minutes DECIMAL(6, 2),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_type VARCHAR(50),
    fuel_wasted_liters DECIMAL(8, 2),
    cost_inr DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_idle_vehicle_date ON idle_sessions(vehicle_id, start_time DESC);

-- ============================================================================
-- FUEL CONSUMPTION RECORDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS fuel_consumption_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    session_start TIMESTAMP NOT NULL,
    session_end TIMESTAMP,
    route_id UUID REFERENCES routes(id),
    total_fuel_liters DECIMAL(8, 2),
    base_consumption_liters DECIMAL(8, 2),
    acceleration_consumption_liters DECIMAL(8, 2),
    extra_distance_consumption_liters DECIMAL(8, 2),
    idle_consumption_liters DECIMAL(8, 2),
    distance_km DECIMAL(8, 2),
    avg_consumption_l_per_km DECIMAL(6, 2),
    max_fuel_rate_l_per_hour DECIMAL(6, 2),
    max_acceleration_ms2 DECIMAL(5, 2),
    cost_inr DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fuel_vehicle_date ON fuel_consumption_records(vehicle_id, session_start DESC);

-- ============================================================================
-- DATABASE VIEWS
-- ============================================================================
-- Current vehicle status summary
CREATE OR REPLACE VIEW vehicle_current_status AS
SELECT 
    v.id,
    v.name,
    v.type,
    v.current_latitude,
    v.current_longitude,
    v.current_speed_kmh,
    v.last_gps_update,
    COUNT(CASE WHEN a.resolved = FALSE THEN 1 END) as unresolved_alerts
FROM vehicles v
LEFT JOIN alerts a ON v.id = a.vehicle_id 
    AND a.created_at > NOW() - INTERVAL '1 day'
WHERE v.active = TRUE
GROUP BY v.id, v.name, v.type, v.current_latitude, v.current_longitude, 
         v.current_speed_kmh, v.last_gps_update;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================
INSERT INTO vehicles (name, type, driver_id, driver_name, color, active) VALUES
    ('Truck-A', 'dump_truck', 'driver-001', 'Ram Kumar', '#FF0000', true),
    ('Truck-B', 'dump_truck', 'driver-002', 'Suresh Singh', '#00FF00', true),
    ('Excavator-1', 'excavator', 'operator-001', 'Vikram Patel', '#0000FF', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO routes (name, description, waypoints, deviation_threshold_m, expected_duration_min, expected_distance_km) VALUES
    (
        'Pit to Dump',
        'Primary haul route from excavation pit to dump site',
        '[
            {"lat": 28.5355, "lng": 77.2031, "name": "Pit Entrance"},
            {"lat": 28.5360, "lng": 77.2035, "name": "Weighbridge"},
            {"lat": 28.5370, "lng": 77.2055, "name": "Dump Site"}
        ]'::jsonb,
        40,
        40,
        6.5
    )
ON CONFLICT (name) DO NOTHING;
