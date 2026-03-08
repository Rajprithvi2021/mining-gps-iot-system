# Quick Start Guide - Skylark Drones GPS IoT System

## 🚀 Get Started in 5 Minutes

### 1. Prerequisites
```bash
# Install required tools
# - Docker Desktop (https://docker.com)
# - Git (https://git-scm.com)
# - Node.js 18+ (https://nodejs.org)

# Verify installations
docker --version
git --version
node --version
```

### 2. Clone & Setup
```bash
# Clone repository
git clone https://github.com/skylark-drones/system.git
cd system

# Copy environment file
cp .env.example .env.local

# Edit with your Mapbox token
# nano .env.local
```

### 3. Start All Services
```bash
# Start complete system with Docker Compose
docker-compose up -d

# Verify all services are running
docker-compose ps

# Check that services are healthy
docker-compose ps | grep healthy
```

### 4. Access the Application
```
Frontend:     http://localhost:3001  (React Dashboard)
API Health:   http://localhost:3000/health
GraphQL:      http://localhost:3000/graphql
API Docs:     http://localhost:3000/api/docs
```

### 5. Test the System
```bash
# Terminal 1: Watch logs
docker-compose logs -f api

# Terminal 2: Run tests
cd backend
npm test

# Terminal 3: Simulate GPS data
npm run simulate-gps
```

---

## 📊 System Architecture

```
┌─ Edge Devices (Raspberry Pi)
│  └─ GPS Parser + Kalman Filter
│  └─ 5 Anomaly Detectors (local)
│  └─ MQTT Publisher → Backend
│
├─ Backend Services
│  ├─ GPS Ingestion (MQTT consumer)
│  ├─ Anomaly Detection Engine
│  ├─ Alert Manager (dedup + escalation)
│  ├─ Fleet Analytics (KPIs)
│  └─ GraphQL API
│
├─ Data Storage
│  ├─ PostgreSQL + PostGIS + TimescaleDB
│  ├─ Redis (caching)
│  └─ Mosquitto MQTT Broker
│
└─ Frontend
   └─ React Dashboard
   └─ Mapbox GL (real-time tracking)
   └─ WebSocket (live updates)
```

---

## 🔧 Common Commands

### Development
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f api

# Run backend tests
cd backend && npm test

# Stop all services
docker-compose down

# Clean up everything (remove volumes)
docker-compose down -v
```

### Database
```bash
# Access PostgreSQL
docker-compose exec postgres psql -U skylark -d skylark_drones

# View schema
\dt

# Example query
SELECT COUNT(*) FROM vehicles;

# Exit
\q
```

### MQTT Testing
```bash
# Subscribe to vehicle GPS
mosquitto_sub -h localhost -t vehicle/+/gps

# Subscribe to all topics
mosquitto_sub -h localhost -t '#'

# Publish test message
mosquitto_pub -h localhost -t vehicle/1/gps -m '{"lat":28.6139,"lon":77.2090}'
```

---

## 🚢 Deployment (Production)

### Deploy to Railway

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Link project
cd system
railway link

# 4. Set production variables
railway variable set NODE_ENV production
railway variable set JWT_SECRET your_secret
railway variable set DATABASE_URL postgresql://...

# 5. Deploy
railway up api
railway up frontend
```

### Docker Deployment

```bash
# Build custom images
docker build -t skylark-api ./backend
docker build -t skylark-frontend ./frontend

# Push to registry
docker tag skylark-api your-registry/skylark-api:1.0
docker push your-registry/skylark-api:1.0

# Deploy with docker-compose in production
docker-compose -f docker-compose.yml up -d
```

---

## 📈 Monitoring

### Health Checks
```bash
# API health
curl http://localhost:3000/health

# Readiness check (database + MQTT)
curl http://localhost:3000/ready

# System metrics
curl http://localhost:3000/metrics
```

### Logs
```bash
# Combined logs
tail -f logs/combined.log

# Error logs only
tail -f logs/error.log

# Real-time Docker logs
docker-compose logs -f --tail=100 api
```

---

## 🐛 Troubleshooting

### Services won't start
```bash
# Check resource availability
docker system prune -f

# Increase Docker memory to 4GB

# Try rebuilding containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database connection error
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Recreate database
docker-compose down -v postgres
docker-compose up -d postgres
```

### MQTT connection error
```bash
# Verify Mosquitto is running
docker-compose ps mosquitto

# Check port 1883 is accessible
nc -zv localhost 1883

# View Mosquitto logs
docker-compose logs mosquitto
```

### GraphQL errors
```bash
# Check API is running
curl http://localhost:3000/health

# View API logs
docker-compose logs api | grep -i graphql

# Verify token in request
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/protected
```

---

## 📚 Documentation

- **Full Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Architecture Design**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **API Reference**: [docs/API.md](./docs/API.md)
- **Database Schema**: [backend/scripts/000_init_schema.sql](./backend/scripts/000_init_schema.sql)

---

## 🔐 Security Checklist

Before production deployment:

- [ ] Change default passwords in `.env`
- [ ] Generate strong JWT_SECRET (32+ chars)
- [ ] Enable HTTPS/SSL certificates
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Enable database encryption
- [ ] Configure CORS restrictions
- [ ] Set up monitoring & alerting
- [ ] Run security audit
- [ ] Test disaster recovery

---

## 💡 Tips & Tricks

### Simulate GPS Data
```bash
cd edge
python3 gps_parser_enhanced.py --simulate \
  --vehicles 10 \
  --rate 1 \
  --duration 3600
```

### Run Load Test
```bash
# Run k6 load testing
k6 run load-test.js

# Custom test (100 users, 5 minutes)
k6 run --vus 100 --duration 5m load-test.js
```

### Database Backup
```bash
# Backup to file
docker-compose exec postgres pg_dump -U skylark skylark_drones > backup.sql

# Restore from file
docker-compose exec -T postgres psql -U skylark skylark_drones < backup.sql
```

---

## 🆘 Support

Issues? Questions? Check these resources:

1. **Logs**: `docker-compose logs -f`
2. **Health Check**: `curl http://localhost:3000/health`
3. **GitHub Issues**: [Report a bug](https://github.com/skylark-drones/system/issues)
4. **Documentation**: [Full Docs](./DEPLOYMENT.md)

---

## 📝 License

MIT License - See LICENSE.md

---

## 🎉 You're All Set!

Your Skylark Drones GPS IoT system is now running. Next steps:

1. Access frontend at http://localhost:3001
2. Login with test credentials
3. Start tracking vehicles in real-time
4. View anomalies and alerts
5. Explore the GraphQL API at http://localhost:3000/graphql

Happy tracking! 🚀
