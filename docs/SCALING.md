# Mining GPS IoT System - Scaling for 500+ Vehicles

## Current Architecture (3-10 vehicles)

```
Single Raspberry Pi/Simulator
         ↓
Express.js Backend (1 process)
         ↓
PostgreSQL (shared hosting)
         ↓
React Frontend (CDN)
```

**Limitations:**
- Backend processes ~50-100 gps_points/second max
- Single connection pool bottleneck
- WebSocket limited to 1 server
- No fault tolerance

**Capacity:** 200-300 vehicles max

---

## Scaling Strategy for 500+ Vehicles

### Phase 1: Optimize Current Setup (500+ vehicles on 1 backend)

#### 1.1 Database Optimization
```sql
-- Partition GPS points by VEHICLE_ID + DATE
CREATE TABLE gps_points_v1 (
    id UUID,
    vehicle_id UUID,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    timestamp TIMESTAMP,
    PRIMARY KEY (id, vehicle_id, timestamp)
) PARTITION BY RANGE (vehicle_id, timestamp);

-- Create 10 partitions for vehicles 1-50, 51-100, etc
CREATE TABLE gps_points_001 PARTITION OF gps_points_v1
    FOR VALUES FROM (ROW(1), '2024-01-01') 
    TO (ROW(50), '2024-02-01');

-- Add indexes per partition
CREATE INDEX idx_gps_001_time ON gps_points_001(timestamp DESC);

-- Result: 10x faster queries (100 vehicles per partition)
```

#### 1.2 Connection Pooling
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 5,      // Instead of 2
  max: 20,     // Instead of 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

**Expected improvement:** 2-3x more concurrent connections

#### 1.3 Data Aggregation (Summarize GPS Data)
```sql
-- Store 1 point per vehicle per 1 minute (instead of every 10 seconds)
CREATE TABLE gps_points_aggregated_1min (
    id UUID PRIMARY KEY,
    vehicle_id UUID,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    speed_kmh_avg DECIMAL(5, 2),
    speed_kmh_max DECIMAL(5, 2),
    accuracy_m_avg DECIMAL(5, 2),
    timestamp TIMESTAMP
);

-- Trigger (PostgreSQL): Aggregate every minute
CREATE TRIGGER aggregate_gps_points
AFTER INSERT ON gps_points
FOR EACH ROW
EXECUTE FUNCTION aggregate_gps_data();

-- Result: 90% reduction in storage (600 points/day → 60 points/day per vehicle)
```

#### 1.4 Caching with Redis
```javascript
// Cache vehicle positions for 30 seconds
const redis = require('redis');
const client = redis.createClient({ url: process.env.REDIS_URL });

router.get('/vehicles', async (req, res) => {
  const cached = await client.get('vehicles:all');
  if (cached) return res.json(JSON.parse(cached));
  
  const vehicles = await pool.query('SELECT * FROM vehicles');
  
  await client.setEx('vehicles:all', 30, JSON.stringify(vehicles.rows));
  
  res.json(vehicles.rows);
});

// Result: 90%+ hit rate for frequently accessed endpoints
```

#### 1.5 API Batching (Already in Pi code)
- Raspberry Pi sends **10 GPS points per batch** (not 1 at a time)
- Instead of 500 vehicles × 6 points/min = 3,000 req/min
- With batching: 500 vehicles × 0.6 batches/min = 300 req/min
- **10x reduction in API calls**

**Result of Phase 1:** Single-backend support for **500+ vehicles**

---

### Phase 2: Distributed System (1000+ vehicles)

#### 2.1 Message Queue (MQTT/Kafka)
```
Raspberry Pi 1 ─┐
Raspberry Pi 2 ─┤
...            ├─→ MQTT Broker (HiveMQ) ─────┐
Raspberry Pi 500┘                            │
                                             ↓
                                    Message Queue
                                             │
                        ┌────────────────────┼────────────────────┐
                        │                    │                    │
                        ↓                    ↓                    ↓
                    Backend 1            Backend 2            Backend 3
                        │
                        └──────────────────────┬──────────────────┘
                                               ↓
                                       PostgreSQL
```

```javascript
// Backend: Subscribe to MQTT topics
const mqtt = require('mqtt');
const client = mqtt.connect(process.env.MQTT_BROKER_URL);

client.subscribe('gps/vehicle/+/data', (err, granted) => {
  console.log('Subscribed to:', granted);
});

client.on('message', (topic, message) => {
  const vehicleId = topic.split('/')[2];
  const gpsData = JSON.parse(message);
  
  // Process GPS data
  processGPSData(vehicleId, gpsData);
});
```

**Advantages:**
- Decouples Raspberry Pi from backend
- Pi publishes → Broker → Multiple backends
- If backend 1 is down, broker buffers data

#### 2.2 Horizontal Backend Scaling
```
nginx (Load Balancer)
  ├─ Backend 1 :3000
  ├─ Backend 2 :3000
  ├─ Backend 3 :3000
  └─ Backend 4 :3000
```

```nginx
upstream backend {
  least_conn;  # Route to least busy backend
  server backend-1:3000;
  server backend-2:3000;
  server backend-3:3000;
  server backend-4:3000;
}

server {
  listen 80;
  server_name api.mining-gps.com;
  
  location / {
    proxy_pass http://backend;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

#### 2.3 WebSocket Distribution (Redis Pub/Sub)
```javascript
// Without scaling: WebSocket limited to single server
// With scaling: Use Redis to broadcast across all servers

const redis = require('redis');
const redisClient = redis.createClient();

// When backend 1 receives alert
io.to(`vehicle_${vehicleId}`).emit('alert_triggered', alertData);

// Also publish to Redis (so other backends see it)
redisClient.publish(`alert:${vehicleId}`, JSON.stringify(alertData));

// Other backends subscribe and forward to their connected clients
redisClient.subscribe('alert:*', (message, channel) => {
  const vehicleId = channel.split(':')[1];
  io.to(`vehicle_${vehicleId}`).emit('alert_triggered', JSON.parse(message));
});
```

**Result:** WebSocket updates work across all backend instances

#### 2.4 Read-Write Database Splitting
```
                     Primary (Write)
                          │
              ┌────────────┼────────────┐
              │            │            │
            Replica 1    Replica 2    Replica 3
          (Read-only)   (Read-only)   (Read-only)

Backend 1 ────────────→ Write queries go to Primary
Backend 2 ────────────→ Read queries distributed across Replicas
Backend 3 │
Backend 4 └─────────→ Load balanced read queries
```

```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_PRIMARY,  // Writes
});

const readPool = new Pool({
  connectionString: process.env.DATABASE_URL_REPLICA,  // Reads
});

// Write: Use primary
await pool.query('INSERT INTO gps_points ...');

// Read: Use replica (faster)
const result = await readPool.query('SELECT * FROM vehicles ...');
```

**Performance:** Replicas handle 80% of queries → Primary not bottlenecked

---

### Phase 3: Full Microservices (2000+ vehicles)

#### 3.1 Service Decomposition
```
                 API Gateway (nginx/Kong)
                        │
        ┌───────────────┼───────────────┬─────────────┐
        │               │               │             │
   GPS Service      Alert Service   Vehicle Service   Dashboard Service
   (GPS ingestion)  (Alert logic)    (CRUD ops)      (Analytics)
        │               │               │             │
        └───────┬───────┼───────────────┼────────────┘
                │
         PostgreSQL Cluster
         (Primary + Replicas)
```

#### 3.2 Rate Limiting Per Service
```javascript
// GPS Service: Allow up to 50,000 points/min
// Dashboard Service: Allow up to 5,000 queries/min
// Alert Service: Allow burst for real-time processing

const gpsLimiter = rateLimit({
  windowMs: 60000,
  max: 50000,
  keyGenerator: (req) => req.params.vehicleId
});

app.post('/gps-data', gpsLimiter, (req, res) => {...});
```

#### 3.3 Time-Series Database (Optional)
For vehicles with 500+ GPS points per day:
```
MongoDB (Time-series)
  └─ Stores: 500 vehicles × 500 points/day = 250K points/day
  └─ Auto-deletes after 30 days
  └─ Fast aggregation queries

PostgreSQL (Operational)
  └─ Stores: Alerts, Routes, Fuel Records, Sessions
  └─ Permanent storage
```

---

## Performance Benchmarks

### Before Optimization
```
Vehicles:     10
GPS Points:   500 points/min
Backend:      Single Node process
Database:     Single PostgreSQL
Latency:      P95 = 500ms for list-all-alerts
Concurrent:   100 connections max
```

### After Phase 1 (Single Backend, 500 vehicles)
```
Vehicles:     500
GPS Points:   50,000 points/min (but batched to 5,000 requests)
Backend:      Single Node process (optimized)
Database:     PostgreSQL with partitioning + Redis cache
Latency:      P95 = 150ms for list-all-alerts (from cache)
Concurrent:   500+ connections
```

### After Phase 2 (Distributed, 1000+ vehicles)
```
Vehicles:     1,000
GPS Points:   100,000 points/min
Backend:      4 Node processes
Database:     PostgreSQL Primary + 3 Read Replicas
Latency:      P95 = 100ms
Concurrent:   3,000+ connections
Throughput:   10,000 requests/sec
```

### After Phase 3 (Microservices, 2000+ vehicles)
```
Vehicles:     2,000
GPS Points:   200,000 points/min
Backend:      6-8 Service instances
Database:     PostgreSQL Cluster + MongoDB for TS data
Latency:      P95 = 50ms
Concurrent:   10,000+ connections
Throughput:   50,000 requests/sec
```

---

## Cost Scaling

### Current Setup (3 vehicles)
```
Railway Backend:     $5/month
PostgreSQL:          $15/month (shared)
Vercel Frontend:     $0/month (free)
Mapbox:              $0/month (< 50k loads)
Total:               $20/month
Per vehicle:         $6.67
```

### Phase 1: 500 vehicles (optimized single backend)
```
Railway Backend:     $25/month (upgraded instance)
PostgreSQL:          $50/month (larger instance)
Redis Cache:         $15/month
Vercel Frontend:     $0/month
Mapbox:              $50/month (500k+ loads)
Total:               $140/month
Per vehicle:         $0.28
```

### Phase 2: 1000 vehicles (distributed)
```
nginx Load Balancer: $30/month
Backend 1-4:         $100/month (4 instances)
PostgreSQL Primary:  $100/month
PostgreSQL Replicas: $150/month (3 × $50)
Redis:               $30/month
Mapbox:              $100/month
Total:               $510/month
Per vehicle:         $0.51
```

### Phase 3: 2000+ vehicles (microservices)
```
API Gateway (Kong):  $50/month
GPS Service (2 inst): $50/month
Alert Service (2):   $50/month
Vehicle Service (2): $50/month
Dashboard Service:   $25/month
PostgreSQL Cluster:  $400/month
MongoDB:             $50/month
Redis Cluster:       $100/month
Mapbox:              $200/month
Monitoring (Datadog)$100/month
Total:               $1,075/month
Per vehicle:         $0.54
```

---

## Migration Path

### Step 1: Optimize Current Setup (1 week)
- [ ] Implement database partitioning
- [ ] Add Redis caching
- [ ] Increase connection pool
- [ ] **Cost:** $0 (existing services)
- **Capacity gain:** 3x → 500 vehicles

### Step 2: Add MQTT + 2nd Backend (2 weeks)
- [ ] Deploy HiveMQ message broker
- [ ] Update Pi to publish to MQTT instead of HTTP
- [ ] Deploy 2nd backend behind load balancer
- [ ] Set up WebSocket bridging via Redis
- **Cost:** +$30/month
- **Capacity gain:** 500 → 1,000 vehicles

### Step 3: Database Replication (1 week)
- [ ] Create read replicas
- [ ] Update backend to route reads to replicas
- [ ] Monitor replication lag
- **Cost:** +$150/month
- **Capacity gain:** Better performance for 1,000 vehicles

### Step 4: Microservices (4 weeks, future)
- [ ] Separate concerns into services
- [ ] Implement service discovery
- [ ] Add API gateway (Kong/Nginx)
- [ ] Deploy time-series DB if needed
- **Cost:** +$500+/month
- **Capacity gain:** 1,000 → 2,000+ vehicles

---

## Key Metrics to Monitor

### Database Performance
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0  -- Unused indexes
ORDER BY pg_relation_size(relname) DESC;
```

### Backend Performance
```bash
# Monitor request latency
# In Winston logs: log EVERY request + response time
logger.info(`${req.method} ${req.path}`, {
  duration_ms: Date.now() - startTime,
  status: res.statusCode
});

# Dashboard: P50, P95, P99 latencies
# Target: P95 < 200ms
```

### Resource Usage
```bash
# CPU usage per backend
# Memory usage per backend
# Disk I/O
# Network bandwidth

# Tools: Prometheus + Grafana, Datadog, New Relic
```

---

## Checklist for Scale-Ready System

### Code
- [x] Implement batching in Pi (done)
- [x] Index database queries (done in schema)
- [x] Use connection pooling (done)
- [ ] Add caching layer (Redis)
- [ ] Implement distributed tracing
- [ ] Add circuit breakers for external APIs

### Infrastructure
- [ ] Load balancer in front of backends
- [ ] Database replication set up
- [ ] Message queue (MQTT/Kafka) for decoupling
- [ ] Redis for caching
- [ ] CDN for static assets

### Operations
- [ ] Monitoring and alerting (CPU, memory, disk)
- [ ] Automated backups (daily)
- [ ] Disaster recovery plan
- [ ] Capacity planning (6-month forecast)
- [ ] Load testing (spike to 2x expected traffic)

### Documentation
- [x] API documentation (done)
- [x] Architecture diagram (done)
- [ ] Runbook for common issues
- [ ] Rollback procedures
- [ ] Incident response plan

