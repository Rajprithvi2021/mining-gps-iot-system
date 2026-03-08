# Mining GPS IoT System - Architecture

## System Overview

```
┌─────────────────────┐
│  Mining Vehicles    │
│  (3x Dump Trucks)   │
└──────────┬──────────┘
           │
           │GPS Data (USB)
           │
┌──────────▼──────────────────────┐
│   Raspberry Pi 3B+/4             │
│  ┌─────────────────────────────┐ │
│  │ GPS Reader (Multi-threaded) │ │
│  │  - 2x NEO-6M USB Modules    │ │
│  │  - NMEA $GPRMC, $GPGGA      │ │
│  │  - Error Recovery           │ │
│  └──────────┬────────────────────┤ │
│  ┌──────────▼──────────────────┐ │
│  │ Detection Engines           │ │
│  │  - Route Deviation (50m)    │ │
│  │  - Idle Detection (45min)   │ │
│  │  - Fuel Consumption (35L/h) │ │
│  └──────────┬──────────────────┤ │
│  ┌──────────▼──────────────────┐ │
│  │ Local Buffer (SQLite)       │ │
│  │  - In-memory deque          │ │
│  │  - Persistence if offline   │ │
│  └──────────┬──────────────────┤ │
│             │HTTP POST (batches)
└─────────────┼──────────────────────┘
              │
    ┌─────────▼──────────┐
    │   Rate Limiting    │
    │  (1000 req/min)    │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────────────────────────┐
    │    Express.js Backend  (Port 3000)     │
    │  ┌────────────────────────────────────┐│
    │  │ API Routes (5 endpoints)           ││
    │  │  - POST /api/v1/gps-data           ││
    │  │  - GET  /api/v1/vehicles           ││
    │  │  - GET  /api/v1/alerts             ││
    │  │  - GET  /api/v1/dashboard/summary  ││
    │  │  - GET  /api/v1/routes             ││
    │  └────────────────────────────────────┘│
    │  ┌────────────────────────────────────┐│
    │  │ WebSocket (Socket.io)              ││
    │  │  - Real-time vehicle updates       ││
    │  │  - Live alert broadcasting         ││
    │  └────────────────────────────────────┘│
    │  ┌────────────────────────────────────┐│
    │  │ Database Connection Pool (pg)      ││
    │  │  - Min 2, Max 10 connections       ││
    │  └────────────────────────────────────┘│
    └─────────┬──────────────────────────────┘
              │
    ┌─────────▼───────────────────────────┐
    │  PostgreSQL 12+ (Railway.app)       │
    │  ┌────────────────────────────────┐ │
    │  │ PostGIS Extension (Geo-queries)│ │
    │  │  - ST_Distance                 │ │
    │  │  - ST_Contains                 │ │
    │  └────────────────────────────────┘ │
    │  ┌────────────────────────────────┐ │
    │  │ Tables (Partitioned by Date)   │ │
    │  │  - vehicles (3 rows)           │ │
    │  │  - gps_points (partitioned)    │ │
    │  │  - alerts (partitioned)        │ │
    │  │  - idle_sessions               │ │
    │  │  - fuel_consumption_records    │ │
    │  │  - routes (3 mining routes)    │ │
    │  └────────────────────────────────┘ │
    └─────────────────────────────────────┘
              │
    ┌─────────▼──────────────────────────┐
    │  React Dashboard (Vercel)          │
    │  ┌────────────────────────────────┐│
    │  │ Mapbox GL JS                   ││
    │  │  - Vehicle markers             ││
    │  │  - Path trails                 ││
    │  │  - Route zones                 ││
    │  │  - Alert overlays              ││
    │  └────────────────────────────────┘│
    │  ┌────────────────────────────────┐│
    │  │ Components                     ││
    │  │  - KPI Summary (4 cards)       ││
    │  │  - Vehicle Panel               ││
    │  │  - Alert Panel                 ││
    │  │  - Route Manager               ││
    │  └────────────────────────────────┘│
    │  ┌────────────────────────────────┐│
    │  │ State Management (Zustand)     ││
    │  │  - Vehicle store               ││
    │  │  - Alert store                 ││
    │  │  - Map store                   ││
    │  │  - Filter store                ││
    │  └────────────────────────────────┘│
    │  ┌────────────────────────────────┐│
    │  │ WebSocket Client               ││
    │  │  - Live position updates       ││
    │  │  - Real-time alerts            ││
    │  └────────────────────────────────┘│
    └────────────────────────────────────┘
```

---

## Data Flow

### 1. GPS Data Ingestion
```
Raspberry Pi GPS Modules
    ↓
Parse NMEA Sentences ($GPRMC, $GPGGA)
    ↓
Detect Anomalies (Route, Idle, Fuel)
    ↓
Buffer in Local SQLite/Memory
    ↓
Batch & Send to Backend (HTTP POST)
    ↓
Backend receives, validates, stores in PostgreSQL
```

### 2. Real-time Updates
```
GPS Data Received
    ↓
Update vehicle position in DB
    ↓
Emit WebSocket event 'vehicle_update'
    ↓
Frontend receives via Socket.io
    ↓
Update Zustand store
    ↓
Re-render React component with new position
    ↓
Mapbox marker moves
```

### 3. Alert Generation
```
Detection Engine (Pi) detects anomaly
    ↓
Creates alert object with metadata
    ↓
Sends with next batch of GPS data
    ↓
Backend stores in alerts table
    ↓
Emit WebSocket event 'alert_triggered'
    ↓
Frontend shows in Alert Panel
    ↓
User can manually resolve with notes
```

---

## Technology Stack

### Raspberry Pi Layer
- **Language**: Python 3.8+
- **GPS Parsing**: pynmea2
- **SerialPort**: pyserial
- **Config**: PyYAML
- **HTTP Client**: requests
- **Threading**: Built-in (3 threads)
- **Local Storage**: SQLite3

### Backend Layer
- **Runtime**: Node.js 14+
- **Framework**: Express.js
- **WebSocket**: Socket.io
- **Database**: PostgreSQL 12+
  - PostGIS extension (geospatial queries)
  - Partitioning by date (gps_points, alerts)
  - Connection pooling (pg)
- **Logging**: Winston
- **Security**: Helmet, CORS, rate-limiting

### Frontend Layer
- **Framework**: React 18+
- **Map Library**: Mapbox GL JS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **WebSocket**: socket.io-client
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

### Simulator
- **Runtime**: Node.js
- **HTTP Client**: Axios
- **Haversine**: Custom calculation

---

## Database Schema

### vehicles (3 rows)
```
id (UUID)
name (VARCHAR)
type (dump_truck, excavator, loader)
driver_id, driver_name
color
active (BOOLEAN)
current_latitude, current_longitude
current_speed_kmh
last_gps_update (TIMESTAMP)
created_at, updated_at
```

### gps_points (PARTITIONED BY MONTH)
```
id, vehicle_id, latitude, longitude
speed_kmh, heading_degrees, accuracy_m
satellites_count, hdop
timestamp (PARTITION KEY)
gps_source (GPS_1, GPS_2, SIMULATOR)
created_at
```

### alerts (PARTITIONED BY MONTH)
```
id, vehicle_id
alert_type (route_deviation, high_idle_duration, high_fuel_consumption)
severity (low, medium, high, critical)
latitude, longitude
timestamp (PARTITION KEY)
description, metadata (JSONB)
resolved (BOOLEAN)
resolved_at, resolved_by, resolution_notes
created_at
```

### idle_sessions
```
id, vehicle_id
start_time, end_time, duration_minutes
latitude, longitude, location_type
fuel_wasted_liters, cost_inr
created_at
```

### fuel_consumption_records
```
id, vehicle_id, route_id
session_start, session_end
total_fuel_liters
base_consumption, acceleration_consumption
extra_distance_consumption, idle_consumption
distance_km, avg_consumption_l_per_km
max_fuel_rate_l_per_hour, max_acceleration_ms2
cost_inr
created_at
```

### routes (3 rows)
```
id, name, description
waypoints (JSONB array)
deviation_threshold_m
expected_duration_min, expected_distance_km
created_at, updated_at
```

---

## API Contracts

### HTTP REST APIs (12 endpoints)
- **POST** `/api/v1/gps-data` - Receive GPS data
- **GET** `/api/v1/vehicles` - List vehicles
- **GET** `/api/v1/vehicles/:id` - Get vehicle
- **GET** `/api/v1/vehicles/:id/current` - Current position
- **GET** `/api/v1/vehicles/:id/history` - GPS history
- **GET** `/api/v1/alerts` - List alerts
- **POST** `/api/v1/alerts/:id/resolve` - Resolve alert
- **GET** `/api/v1/dashboard/summary` - KPI dashboard
- **GET** `/api/v1/routes` - List routes
- **POST** `/api/v1/routes` - Create route
- **GET** `/health` - Health check

### WebSocket Events
- **emit** `subscribe_vehicle` - Subscribe to vehicle updates
- **on** `vehicle_update` - Position update
- **on** `alert_triggered` - New alert

---

## Scalability Considerations for 500+ Vehicles

### Current Design (3-10 vehicles)
- Single Node.js backend (1 process)
- PostgreSQL on shared hosting
- WebSocket on single server
- Simple partitioning by month

### For 500+ Vehicles

#### 1. **Message Queue (MQTT/Redis)**
```
Raspberry Pi → MQTT Broker
            ↓
      Message Queue
            ↓
    Multiple Backend Workers
            ↓
      PostgreSQL
```

#### 2. **Horizontal Scaling**
```
Load Balancer (nginx)
    ↓
[Backend 1] [Backend 2] [Backend 3]
       ↓
   PostgreSQL (Read Replicas)
```

#### 3. **Database Optimization**
- Partition gps_points by vehicle_id + date
- Table sharding (split vehicles 1-200, 201-400, 401-600)
- Read replicas for analytics
- Caching layer (Redis) for vehicle positions

#### 4. **WebSocket Distribution**
```
Redis Pub/Sub
    ↓
[WebSocket Server 1]
[WebSocket Server 2]
[WebSocket Server 3]
```

#### 5. **Performance Targets**
- **GPS Data**: 50,000 points/min (500 vehicles × 1 point/6 sec)
- **Alert Generation**: 100-200 alerts/min
- **Dashboard Queries**: <500ms response time
- **WebSocket Latency**: <1 second position update

---

## Deployment Architecture

### Local Development
```
Raspberry Pi (localhost)
Backend (localhost:3000)
PostgreSQL (localhost:5432)
Frontend (localhost:3000)
Simulator (optional)
```

### Production
```
Raspberry Pi (mine site) ──────────┐
                                   │
                          Internet │
                                   │
Vercel Frontend ←─────────────────┬────────────→ Railway Backend
https://mining-gps.vercel.app     │   https://mining-gps-backend.railway.app
                                   │
                          PostgreSQL (Railway)
```

---

## Security

- **CORS**: Restricted to frontend domain
- **Rate Limiting**: 1000 req/min per IP
- **HTTPS**: TLS 1.3 (Railway, Vercel)
- **Database**: PostgreSQL user with minimal permissions
- **Input Validation**: express-validator on all routes
- **Error Handling**: No sensitive data in error messages

---

## Monitoring

### Metrics
- GPS data ingestion rate
- API response times
- Database query performance
- WebSocket connection count
- Alert generation rate
- Fuel consumption trends

### Logging
- Backend: Winston (file + console)
- Database: PostgreSQL logs
- Frontend: Browser console + Sentry (optional)

---

## Development Workflow

1. **Pi Development** - Test GPS reader with mock data or real modules
2. **Backend Development** - API routes in isolation using API client
3. **Database** - Schema migrations, seed data
4. **Frontend Development** - Component development with mock API
5. **Integration** - Connect all layers
6. **Simulator** - Test with mock GPS data
7. **Deployment** - Railway (backend) + Vercel (frontend)

