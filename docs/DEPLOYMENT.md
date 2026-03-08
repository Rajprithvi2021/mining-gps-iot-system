# Mining GPS IoT System - Deployment Guide

## Prerequisites

### Required Accounts
- **Railway.app** (Backend + Database)
- **Vercel** (Frontend)
- **GitHub** (Source code)
- **Mapbox** (Map tiles)

### Local Setup
- Node.js 14+ installed
- Python 3.8+ installed (for Pi layer)
- PostgreSQL client (psql)
- Git installed
- Raspberry Pi 3B+/4 (if not using simulator)

---

## Step 1: GitHub Setup

### 1.1 Create Repository
```bash
# Clone your workspace as git repo
cd /path/to/mining-gps-iot-system
git init
git add .
git commit -m "Initial commit: Mining GPS IoT System"
git remote add origin https://github.com/yourusername/mining-gps-iot.git
git push -u origin main
```

### 1.2 Update .gitignore
```
node_modules/
__pycache__/
.env
.env.local
.env.*.local
dist/
build/
logs/
*.log
.DS_Store
# PostgreSQL backups
*.sql.gz
# Mapbox keys
.mapbox
```

---

## Step 2: Backend Deployment (Railway.app)

### 2.1 Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Create new project

### 2.2 Connect GitHub Repository
1. In Railway Dashboard: **New Project → GitHub Repo**
2. Select `mining-gps-iot` repository
3. Select **backend** directory as the service root

### 2.3 Configure PostgreSQL
1. **Add Plugin → PostgreSQL**
2. Railway auto-provisions PostgreSQL instance
3. Note the connection URL from environment variables

### 2.4 Set Environment Variables
In Railway Dashboard → Environment:
```
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production
PORT=3000
MAPBOX_PUBLIC_KEY=pk_your_mapbox_key
CORS_ORIGIN=https://your-frontend.vercel.app
LOG_LEVEL=info
```

### 2.5 Deploy Backend
```bash
# Push to GitHub (Railway auto-deploys on push)
git push origin main

# Or manually deploy via Railway CLI
railway up
```

### 2.6 Create PostgreSQL Schema
```bash
# Copy schema file locally
psql $DATABASE_URL < backend/database/schema.sql

# Or run migrations in Railway
railway shell
psql < database/schema.sql
```

### 2.7 Verify Backend
```bash
# Test health endpoint
curl https://your-backend-on-railway.app/health

# Should return:
{
  "status": "healthy",
  "timestamp": "2024-03-15T10:30:00Z",
  "uptime": 3600
}
```

---

## Step 3: Frontend Deployment (Vercel)

### 3.1 Create Vercel Account
1. Go to https://vercel.com
2. Sign up with GitHub
3. Import project

### 3.2 Import GitHub Repository
1. Click **Import Project**
2. Select `mining-gps-iot` repository
3. Select **frontend** as root directory

### 3.3 Configure Environment Variables
In Vercel Project Settings → Environment Variables:
```
REACT_APP_BACKEND_URL=https://your-backend-on-railway.app
REACT_APP_MAPBOX_PUBLIC_KEY=pk_your_mapbox_key
```

### 3.4 Deploy Frontend
```bash
# Vercel auto-deploys on push
git push origin main

# Or manually deploy
vercel --prod
```

### 3.5 Verify Frontend
```bash
# Visit your frontend URL
https://your-frontend.vercel.app

# Should load Mapbox dashboard
```

---

## Step 4: Raspberry Pi Setup (Optional for Real Hardware)

### 4.1 Flash Raspberry Pi OS
```bash
# Using Raspberry Pi Imager:
# 1. Select OS: Raspberry Pi OS Lite (64-bit)
# 2. Select Storage: your microSD card
# 3. Write and wait
```

### 4.2 Initial Configuration
```bash
# SSH into Pi
ssh pi@raspberrypi.local

# Enable SSH, SPI, I2C
sudo raspi-config
# → Interface Options → SSH (Enable)
# → Interface Options → SPI (Enable for USB)

# Update packages
sudo apt-get update && sudo apt-get upgrade
```

### 4.3 Install Python Dependencies
```bash
# Install Python 3.8+
sudo apt-get install python3-pip python3-venv

# Create virtual environment
python3 -m venv ~/mining-gps-env
source ~/mining-gps-env/bin/activate

# Install dependencies
pip install -r raspberry-pi/requirements.txt
```

### 4.4 Connect GPS Modules
```bash
# Connect 2x u-blox NEO-6M modules to USB ports
# Check connection
lsusb
# Should show: Device 001 Device 002 near the top

# Check serial ports
ls /dev/ttyUSB*
# Should show: /dev/ttyUSB0 /dev/ttyUSB1
```

### 4.5 Update configuration
```bash
# Edit config.yaml with your backend URL
nano raspberry-pi/config.yaml

# Set backend URL to your Railway backend
backend:
  base_url: https://your-backend-on-railway.app
  api_endpoint: /api/v1/gps-data
```

### 4.6 Run Pi Application
```bash
# Activate venv
source ~/mining-gps-env/bin/activate

# Run GPS reader
python3 raspberry-pi/src/gps_reader.py

# Run as daemon (using systemd)
sudo nano /etc/systemd/system/mining-gps.service
```

### 4.7 Systemd Service Configuration
```ini
[Unit]
Description=Mining GPS IoT System
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/mining-gps-iot-system
ExecStart=/home/pi/mining-gps-env/bin/python3 raspberry-pi/src/gps_reader.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable mining-gps
sudo systemctl start mining-gps

# Check status
sudo systemctl status mining-gps

# View logs
journalctl -u mining-gps -f
```

---

## Step 5: Simulator Setup (For Testing Without Pi)

### 5.1 Install Simulator Dependencies
```bash
cd simulator
npm install
```

### 5.2 Update Backend URL
```bash
# Set environment variable
export BACKEND_URL=https://your-backend-on-railway.app
# or on Windows:
set BACKEND_URL=https://your-backend-on-railway.app
```

### 5.3 Run Simulator
```bash
# Start simulator (sends mock GPS data every 5 seconds)
npm start

# Expected output:
# 🚜 Mining GPS Simulator Started
# 📍 Target Backend: https://your-backend-on-railway.app
# 🔄 Send Interval: 5000ms
# ✓ Sent 10 GPS points from Truck-A
```

---

## Step 6: Test Full System

### 6.1 Test Backend APIs
```bash
# Get all vehicles
curl https://your-backend-on-railway.app/api/v1/vehicles

# Send test GPS data
curl -X POST https://your-backend-on-railway.app/api/v1/gps-data \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "vehicle-001",
    "gps_points": [
      {
        "latitude": 28.5355,
        "longitude": 77.2031,
        "speed_kmh": 40,
        "timestamp": "2024-03-15T10:30:00Z"
      }
    ]
  }'

# Get dashboard summary
curl https://your-backend-on-railway.app/api/v1/dashboard/summary
```

### 6.2 Test Frontend
1. Open https://your-frontend.vercel.app
2. Verify Mapbox loads
3. Check vehicle list shows vehicles
4. Verify real-time updates (if using simulator)

### 6.3 Test WebSocket
Open browser console and run:
```javascript
const socket = io('https://your-backend-on-railway.app');
socket.on('connect', () => {
  console.log('✓ Connected to server');
  socket.emit('subscribe_vehicle', 'vehicle-001');
});
socket.on('vehicle_update', (data) => {
  console.log('✓ Received vehicle update:', data);
});
```

---

## Step 7: Production Checklist

### Security
- [x] PostgreSQL password changed (Railway auto-generates secure password)
- [x] Environment variables not committed to Git
- [x] CORS restricted to frontend domain
- [x] Rate limiting enabled (1000 req/min)
- [x] Helmet.js enabled for security headers
- [x] HTTPS/TLS enforced (Railway + Vercel auto-enable)

### Monitoring
- [x] Backend error logging enabled (Winston)
- [x] Database query logging enabled
- [x] Frontend error tracking (optional: Sentry)
- [x] Backend uptime monitoring (optional: Better Stack)

### Performance
- [x] Database indexes created on common queries
- [x] Connection pooling configured (min 2, max 10)
- [x] API rate limiting enabled
- [x] Frontend deployed on Vercel CDN (auto-cached)
- [x] Mapbox token restricted to your domain

### Data
- [x] Database backups enabled (Railway auto-backs up daily)
- [x] GPS points partitioned by month (auto-cleanup old data optional)
- [x] Alert retention policy set (7-30 days)

---

## Step 8: Custom Domain (Optional)

### Connect Custom Domain to Vercel
1. Vercel Dashboard → Project Settings → Domains
2. Add your domain
3. Copy CNAME record to DNS provider
4. Wait for DNS propagation (up to 48 hours)

### Connect Custom Domain to Railway
1. Railway Dashboard → Settings → Domains
2. Add your domain
3. Update DNS CNAME
4. Verify connection

---

## Troubleshooting

### Backend Not Responding
```bash
# Check Railway logs
railway logs

# Check database connection
psql $DATABASE_URL -c "SELECT NOW();"

# Restart service
railway up
```

### Frontend Not Loading
```bash
# Check Vercel logs
vercel logs --follow

# Clear cache
rm -rf .vercel/
vercel --prod --force
```

### Pi Not Sending Data
```bash
# SSH into Pi
ssh pi@raspberrypi.local

# Check GPS connection
ls /dev/ttyUSB*

# Test GPS module
cat /dev/ttyUSB0 | head -10

# Check network
ping 8.8.8.8

# View Pi logs
journalctl -u mining-gps -f
```

### No Data in Database
```bash
# Check if data was inserted
psql $DATABASE_URL -c "SELECT COUNT(*) FROM gps_points;"

# Check recent GPS points
psql $DATABASE_URL -c "SELECT * FROM gps_points ORDER BY created_at DESC LIMIT 5;"
```

### WebSocket Not Working
```bash
# Enable debug logging
# In backend/src/index.js:
const io = socketIo(server, {
  debug: true,
  ...
});

# Check browser console for connection errors
# Verify CORS_ORIGIN environment variable matches frontend URL
```

---

## Scaling to 500+ Vehicles

For large-scale deployments:

### 1. Add Message Queue (MQTT)
```bash
# Use HiveMQ or Mosquitto
# Raspberry Pis publish to MQTT instead of HTTP
# Backend subscribes and processes
```

### 2. Horizontal Scaling
```
# Railway: Upgrade to higher tier + replicas
# Database: Add read replicas + connection pooling

# Nginx load balancer (optional)
upstream backend {
  server backend-1:3000;
  server backend-2:3000;
  server backend-3:3000;
}
```

### 3. Database Optimization
```bash
# Partition by vehicle_id + date
# Add indexes for common queries:
CREATE INDEX idx_gps_vehicle_time ON gps_points(vehicle_id, timestamp DESC);
CREATE INDEX idx_alerts_vehicle_unresolved ON alerts(vehicle_id) 
  WHERE resolved = FALSE;
```

---

## Monitoring & Analytics

### Key Metrics to Track
- API response time (target: <500ms)
- GPS data ingestion rate (points/min)
- Database query performance
- WebSocket connection count
- Alert generation rate
- Fuel consumption trends

### Optional: Set Up Monitoring

```bash
# Using New Relic (optional)
npm install newrelic

# Using Sentry (optional, for error tracking)
npm install @sentry/node
```

---

## Cost Estimation

### Baseline Setup (3 vehicles)
- **Railway Backend + PostgreSQL**: $5-10/month
- **Vercel Frontend**: Free tier sufficient
- **Mapbox**: Free tier (50k map loads/month)
- **GPS Modules + Pi**: One-time ₹15,000 (~$180)
- **Monthly**: ~$5-10

### At Scale (500 vehicles)
- **Railway (scaled)**: $50-100/month
- **PostgreSQL (larger)**: $20-50/month
- **Mapbox (usage-based)**: $50+ depending on usage
- **Monthly**: ~$120-150

---

## Emergency Procedures

### If Backend Goes Down
1. Raspberry Pi buffers GPS data locally in SQLite
2. Simulator can continue collecting data
3. Once backend is up, Pi auto-syncs buffered data
4. No data loss (30-day buffer)

### If Database Gets Corrupted
```bash
# Railway provides automated backups every 24h
# Restore from backup:
# 1. Delete damaged database
# 2. Create new from backup
# 3. No more than 24h of data loss
```

### If Frontend Deployment Fails
```bash
# Revert to previous version
vercel rollback

# Or redeploy manually
vercel --prod
```

