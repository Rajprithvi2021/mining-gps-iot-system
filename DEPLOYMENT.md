# Skylark Drones GPS IoT System - Deployment Guide

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Railway Deployment](#railway-deployment)
3. [Monitoring & Logging](#monitoring--logging)
4. [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)
- Redis (or use Docker)
- Mosquitto MQTT broker (or use Docker)
- Mapbox API token

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/skylark-drones.git
cd skylark-drones

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your configuration
nano .env.local
```

### 2. Environment Configuration

Update `.env.local` with your actual values:

```bash
# Database (if using local PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/skylark_drones

# MQTT
MQTT_URL=mqtt://localhost:1883

# JWT
JWT_SECRET=your_secret_key_change_in_production

# Third-party APIs
MAPBOX_TOKEN=pk.your_mapbox_token
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

### 3. Start with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f api
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### 4. Initialize Database

```bash
# The database will auto-initialize from the SQL script
# To manually run migrations:
docker-compose exec postgres psql -U skylark -d skylark_drones < backend/scripts/000_init_schema.sql
```

### 5. Access the Application

- **Frontend**: http://localhost:3001
- **API Health**: http://localhost:3000/health
- **GraphQL Playground**: http://localhost:3000/graphql
- **Mosquitto MQTT**: mqtt://localhost:1883

### 6. Test the System

```bash
# Terminal 1: Watch logs
docker-compose logs -f

# Terminal 2: Run the test suite
cd backend
npm test

# Terminal 3: Send test GPS data
npm run simulate-gps
```

---

## Railway Deployment

### Prerequisites

- Railway.app account (https://railway.app)
- GitHub repository
- Production environment variables

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Create new project
railway init
```

### 2. Configure Services

```bash
# Create PostgreSQL service
railway add

# Create Redis service
railway add

# Create Mosquitto MQTT (use Docker image)
railway add
```

### 3. Set Environment Variables

In Railway dashboard, set these variables:

```
NODE_ENV=production
DATABASE_URL=postgresql://...  # Railway PostgreSQL URL
REDIS_URL=redis://...         # Railway Redis URL
JWT_SECRET=your_prod_secret
MAPBOX_TOKEN=your_mapbox_token
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

### 4. Deploy Backend

```bash
# Set working directory
railway service add backend

# Configure as Node.js service
# Set build command: npm ci && npm run build
# Set start command: npm start

# Deploy
railway up
```

### 5. Deploy Frontend

```bash
# Add frontend service
railway service add frontend

# Configure as Node.js service
# Set build command: npm ci && npm run build
# No start command needed (uses Dockerfile)

# Deploy
railway up
```

### 6. Verify Deployment

```bash
# Get service URLs
railway domains

# Test health endpoints
curl https://your-api.railway.app/health
curl https://your-frontend.railway.app/

# Check logs
railway logs api
railway logs frontend
```

---

## Production Checklist

Before deploying to production:

- [ ] Set strong JWT_SECRET (minimum 32 characters)
- [ ] Enable SSL/TLS for all connections
- [ ] Configure CORS properly (not *)
- [ ] Set up automated backups for PostgreSQL
- [ ] Configure monitoring and alerting
- [ ] Set up error tracking (Sentry)
- [ ] Configure rate limiting
- [ ] Set up log aggregation
- [ ] Test disaster recovery procedures
- [ ] Security audit completed

---

## Monitoring & Logging

### Health Checks

All services expose health endpoints:

```bash
# Backend health
GET /health
GET /ready     # Checks database and MQTT

# Frontend health
GET /           # React app root
```

### Kubernetes/Container Health

Health check configuration (already in Dockerfiles):

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health
```

### Metrics Endpoint

```bash
# Get system metrics
GET /metrics

# Response includes:
{
  "anomalies_1h": 42,
  "anomalies_24h": 512,
  "total_vehicles": 150,
  "total_users": 45,
  "gps_points_1h": 125000
}
```

### Log Aggregation

Logs are written to:

- **Console**: For Docker/Kubernetes
- **File**: `logs/combined.log` , `logs/error.log`
- **External**: Configure Sentry/DataDog/CloudWatch via `.env`

Configure log levels:

```bash
# In .env
LOG_LEVEL=info    # debug, info, warn, error
```

---

## Scaling Configuration

### For 500+ Vehicles

**Database**:
```sql
-- Create indexes for common queries
CREATE INDEX idx_vehicle_org ON vehicles(org_id);
CREATE INDEX idx_anomaly_vehicle ON anomalies(vehicle_id, created_at DESC);
CREATE INDEX idx_gps_vehicle_time ON gps_data(vehicle_id, time DESC);

-- Enable table compression (TimescaleDB)
ALTER TABLE gps_data SET (
  timescaledb.compress = true,
  timescaledb.compress_orderby = 'time DESC'
);
```

**API Server**:
- Use Connection pooling (default: max 20, min 5)
- Run multiple instances behind load balancer
- Each instance can handle ~50 vehicles

**MQTT Broker**:
- Run with max connections: 1000+
- Enable persistence for offline vehicles

---

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Verify connection string
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL -c "SELECT 1"

# Check logs
docker-compose logs postgres
```

### MQTT Connection Failed

```bash
# Check Mosquitto is running
docker-compose ps mosquitto

# Test MQTT connection
mosquitto_sub -h localhost -t test

# Check firewall isn't blocking port 1883
netstat -an | grep 1883
```

### API/Frontend Not Responding

```bash
# Check service status
docker-compose ps

# Restart specific service
docker-compose restart api

# Full restart
docker-compose down
docker-compose up -d

# Check resource usage
docker stats
```

### GraphQL Errors

```bash
# Check GraphQL endpoint
curl http://localhost:3000/graphql

# Verify JWT token in headers
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/graphql

# Check server logs
docker-compose logs api | grep -i graphql
```

### High Latency or Memory Usage

```bash
# Monitor resource usage
docker stats

# Check database connections
docker-compose exec postgres psql -U skylark -d skylark_drones \
  -c "SELECT count(*) FROM pg_stat_activity"

# Check Redis memory
docker-compose exec redis redis-cli info memory

# Scale horizontally:
# 1. Run multiple API instances
# 2. Use load balancer (nginx, HAProxy)
# 3. Increase database connection pool
```

---

## Backup & Recovery

### Automated Backups (Railway)

Railway automatically backs up PostgreSQL. To recover:

1. Go to Railway dashboard
2. Select PostgreSQL service
3. Click "Deployments" tab
4. Restore from backup point

### Manual Database Backup

```bash
# Backup database
docker-compose exec postgres pg_dump -U skylark skylark_drones > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U skylark skylark_drones < backup.sql

# Backup volume data
docker run --rm -v skylark_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_data.tar.gz /data
```

### Recovery Procedure

1. Stop all services: `docker-compose down`
2. Delete existing volume: `docker volume rm skylark_postgres_data`
3. Restore backup file
4. Restart services: `docker-compose up -d`

---

## Security Best Practices

1. **Secrets Management**
   - Never commit `.env` files
   - Use Railway/Heroku secrets management
   - Rotate secrets quarterly

2. **Database Security**
   - Use strong passwords (32+ characters)
   - Enable SSL for connections
   - Restrict network access

3. **API Security**
   - Enable CORS restrictions
   - Implement rate limiting
   - Use HTTPS in production
   - Validate all inputs

4. **MQTT Security**
   - Enable TLS/SSL (port 8883)
   - Use strong broker username/password
   - Implement ACL rules

---

## Support & Documentation

- API Documentation: `/docs`
- GraphQL Schema: `http://localhost:3000/graphql` (introspection)
- Issues: https://github.com/yourusername/skylark-drones/issues
- Contact: support@skylarkdrones.com
