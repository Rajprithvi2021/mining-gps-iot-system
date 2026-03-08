-- ============================================================================
-- SKYLARK MINING GPS SYSTEM - PostgreSQL Schema
-- ============================================================================
-- Tables for vehicle tracking, anomaly detection, and analytics
-- Extensions: PostGIS (spatial queries), TimescaleDB (time-series compression)
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================================
-- 1. ORGANIZATIONS & FLEET MANAGEMENT
-- ============================================================================

CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    industry VARCHAR(100),  -- 'mining', 'logistics', etc.
    country VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id VARCHAR(50) NOT NULL UNIQUE,  -- e.g., "MINE-001"
    type VARCHAR(50),  -- 'truck', 'excavator', 'tipper'
    model VARCHAR(100),
    license_plate VARCHAR(20) UNIQUE,
    capacity_tons DECIMAL(10, 2),  -- Max load capacity
    fuel_tank_capacity_liters DECIMAL(10, 2),
    vin VARCHAR(17),
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'maintenance', 'inactive'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, vehicle_id)
);

CREATE TABLE approved_routes (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255),  -- e.g., "Mine A -> Dump Site B"
    waypoints GEOMETRY(LineString, 4326),  -- GPS coordinates (lat/lon)
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. GPS DATA - TIME-SERIES (using TimescaleDB)
-- ============================================================================

CREATE TABLE gps_data (
    time TIMESTAMP NOT NULL,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    latitude FLOAT8 NOT NULL,
    longitude FLOAT8 NOT NULL,
    speed_kmh FLOAT8,
    altitude_m FLOAT8,
    satellites INTEGER,
    hdop FLOAT8,  -- Horizontal Dilution of Precision
    accuracy_m FLOAT8,  -- GPS accuracy estimate
    location GEOMETRY(Point, 4326),  -- PostGIS point for spatial queries
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Convert to hypertable for compression (TimescaleDB)
SELECT create_hypertable('gps_data', 'time', if_not_exists => TRUE);

-- Indexes for fast queries
CREATE INDEX idx_gps_vehicle_time ON gps_data (vehicle_id, time DESC);
CREATE INDEX idx_gps_location ON gps_data USING GIST (location);  -- PostGIS index

-- Enable compression (drops after 7 days)
ALTER TABLE gps_data SET (
    timescaledb.compress,
    timescaledb.compress_orderby = 'time DESC',
    timescaledb.compress_segmentby = 'vehicle_id'
);

SELECT add_compression_policy('gps_data', INTERVAL '7 days', if_not_exists => TRUE);

-- ============================================================================
-- 3. ANOMALIES & ALERTS
-- ============================================================================

CREATE TABLE anomalies (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    anomaly_type VARCHAR(50) NOT NULL,  -- 'ROUTE_DEVIATION', 'IDLE', etc.
    severity VARCHAR(20) NOT NULL,  -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    latitude FLOAT8,
    longitude FLOAT8,
    location GEOMETRY(Point, 4326),
    timestamp TIMESTAMP NOT NULL,
    duration_sec INTEGER,  -- How long the anomaly lasted
    data JSONB,  -- Flexible schema for different anomaly types
    human_reviewed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Convert anomalies to hypertable for compression
SELECT create_hypertable('anomalies', 'timestamp', if_not_exists => TRUE);

CREATE INDEX idx_anomalies_vehicle ON anomalies (vehicle_id, timestamp DESC);
CREATE INDEX idx_anomalies_severity ON anomalies (severity, timestamp DESC);
CREATE INDEX idx_anomalies_type ON anomalies (anomaly_type, timestamp DESC);

-- ============================================================================
-- 4. ALERTS SENT TO USERS
-- ============================================================================

CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    anomaly_id INTEGER REFERENCES anomalies(id) ON DELETE SET NULL,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    alert_type VARCHAR(50),
    severity VARCHAR(20),
    message TEXT,
    status VARCHAR(20) DEFAULT 'new',  -- 'new', 'acknowledged', 'resolved'
    recipient_id INTEGER,  -- User ID
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT create_hypertable('alerts', 'sent_at', if_not_exists => TRUE);
CREATE INDEX idx_alerts_vehicle ON alerts (vehicle_id, sent_at DESC);
CREATE INDEX idx_alerts_status ON alerts (status, sent_at DESC);

-- ============================================================================
-- 5. TRIPS & JOURNEYS
-- ============================================================================

CREATE TABLE trips (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    start_location GEOMETRY(Point, 4326),
    end_location GEOMETRY(Point, 4326),
    distance_km FLOAT8,
    fuel_consumed_liters FLOAT8,
    duration_minutes INTEGER,
    load_state VARCHAR(50),  -- 'EMPTY', 'HALF_LOADED', 'FULL'
    load_confidence FLOAT8,  -- ML confidence 0-1
    num_anomalies INTEGER DEFAULT 0,
    anomaly_summary JSONB,  -- {route_deviation: 2, harsh_driving: 5}
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trips_vehicle ON trips (vehicle_id, start_time DESC);
CREATE INDEX idx_trips_org ON trips (org_id, start_time DESC);

-- ============================================================================
-- 6. DRIVER PROFILES
-- ============================================================================

CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(255),
    driver_license_number VARCHAR(30),
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'inactive', 'training'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE driver_vehicle_assignments (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unassigned_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- 7. PERFORMANCE METRICS & KPIs
-- ============================================================================

CREATE TABLE daily_vehicle_metrics (
    time TIMESTAMP NOT NULL,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    distance_km FLOAT8,
    fuel_consumed_liters FLOAT8,
    fuel_efficiency_km_per_liter FLOAT8,
    idle_minutes INTEGER,
    harsh_acceleration_count INTEGER,
    harsh_braking_count INTEGER,
    route_deviation_count INTEGER,
    avg_speed_kmh FLOAT8,
    max_speed_kmh FLOAT8,
    num_trips INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Convert to hypertable
SELECT create_hypertable('daily_vehicle_metrics', 'time', if_not_exists => TRUE);
CREATE INDEX idx_daily_metrics_vehicle ON daily_vehicle_metrics (vehicle_id, time DESC);

-- ============================================================================
-- 8. MAINTENANCE & SERVICE RECORDS
-- ============================================================================

CREATE TABLE maintenance_records (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(100),  -- 'tire_rotation', 'oil_change', 'inspection'
    performed_at TIMESTAMP,
    odometer_km FLOAT8,
    cost_usd FLOAT8,
    notes TEXT,
    scheduled_next TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 9. USERS & PERMISSIONS
-- ============================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),  -- bcrypt hash
    full_name VARCHAR(255),
    role VARCHAR(50),  -- 'admin', 'manager', 'driver', 'analyst'
    status VARCHAR(20) DEFAULT 'active',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource VARCHAR(100),  -- 'vehicles', 'analytics', 'alerts'
    action VARCHAR(50),  -- 'read', 'write', 'delete'
    grant_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 10. AUDIT LOG
-- ============================================================================

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    action VARCHAR(100),  -- 'vehicle_created', 'route_deleted'
    resource_type VARCHAR(50),
    resource_id INTEGER,
    changes JSONB,  -- What changed
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user ON audit_log (user_id, timestamp DESC);
CREATE INDEX idx_audit_log_org ON audit_log (org_id, timestamp DESC);

-- ============================================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================================================

-- Vehicle status dashboard
CREATE MATERIALIZED VIEW vehicle_status_latest AS
SELECT
    v.id,
    v.org_id,
    v.vehicle_id,
    g.latitude,
    g.longitude,
    g.speed_kmh,
    g.time as last_gps_update,
    EXTRACT(EPOCH FROM (NOW() - g.time))::INT as seconds_since_update,
    (NOW() - g.time) < INTERVAL '5 minutes' as is_active
FROM vehicles v
LEFT JOIN LATERAL (
    SELECT latitude, longitude, speed_kmh, time
    FROM gps_data
    WHERE gps_data.vehicle_id = v.id
    ORDER BY time DESC
    LIMIT 1
) g ON TRUE;

-- Weekly anomaly summary
CREATE MATERIALIZED VIEW weekly_anomaly_summary AS
SELECT
    date_trunc('week', timestamp) as week,
    vehicle_id,
    anomaly_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical_count
FROM anomalies
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY date_trunc('week', timestamp), vehicle_id, anomaly_type;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

-- Calculate daily KPIs
CREATE OR REPLACE FUNCTION calculate_daily_metrics()
RETURNS void AS $$
BEGIN
    INSERT INTO daily_vehicle_metrics (time, vehicle_id, org_id, distance_km, fuel_consumed_liters)
    SELECT
        date_trunc('day', t.start_time) as day,
        t.vehicle_id,
        t.org_id,
        SUM(t.distance_km) as distance_km,
        SUM(t.fuel_consumed_liters) as fuel_consumed_liters
    FROM trips t
    WHERE date_trunc('day', t.start_time) = date_trunc('day', NOW() - INTERVAL '1 day')
    GROUP BY date_trunc('day', t.start_time), t.vehicle_id, t.org_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant read-only permissions for analytics users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO "analytics_role";
GRANT SELECT ON ALL MATERIALIZED VIEWS IN SCHEMA public TO "analytics_role";

COMMIT;
