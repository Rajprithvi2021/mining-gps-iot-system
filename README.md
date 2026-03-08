# Skylark Drones GPS IoT Mining System

🚀 Production-grade IoT solution for mining vehicle tracking and anomaly detection.

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.9+
- Docker & Docker Compose
- Git

### Local Development (5 minutes)

```bash
# 1. Start databases + MQTT broker
docker-compose up -d

# 2. Setup Edge Device (Raspberry Pi)
cd edge
pip install -r requirements.txt
python3 gps_parser.py  # Should see GPS data

# 3. Setup Backend
cd ../backend
npm install
npm run migrate
npm start

# 4. Setup Frontend
cd ../frontend
npm install
npm run dev

# Open http://localhost:5173
```

## Project Structure

```
project/
├── edge/                 # Raspberry Pi edge device code
│   ├── gps_parser.py    # Multi-GPS NMEA reader
│   ├── kalman_filter.py # GPS smoothing
│   ├── detectors/       # Anomaly detection engines
│   └── config/          # Configuration files
│
├── backend/             # Node.js microservices
│   ├── src/
│   │   ├── services/    # Business logic
│   │   ├── routes/      # API endpoints
│   │   └── middleware/  # Express middleware
│   └── scripts/         # Database migrations
│
├── frontend/            # React dashboard
│   └── src/
│       ├── components/  # Reusable components
│       ├── pages/       # Page components
│       └── services/    # API client
│
├── docs/               # Documentation
└── .github/workflows/  # CI/CD pipelines
```

## Features

✅ **Dual GPS modules** with Kalman filtering  
✅ **5 anomaly detectors** (route, idle, fuel, harsh driving, grade)  
✅ **Offline operation** (48-hour SQLite buffer)  
✅ **Real-time dashboard** (Mapbox + WebSocket)  
✅ **Scalable architecture** (1000+ vehicles)  
✅ **Production monitoring** (Prometheus + Grafana)  

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design
- [API Reference](docs/API.md) - GraphQL schema
- [Deployment](docs/DEPLOYMENT.md) - Production setup
- [Hardware Setup](docs/HARDWARE.md) - GPS wiring

## Technology Stack

- **Edge:** Python 3.9, MQTT, SQLite
- **Backend:** Node.js, Express, PostgreSQL, Redis
- **Frontend:** React 18, Mapbox GL JS, TypeScript
- **Infrastructure:** Railway, GitHub Actions

## Timeline

- Days 1-2: Edge device + anomaly detection
- Days 3-4: Backend microservices + database
- Days 5-6: Frontend dashboard + deployment
- Days 7-8: Hindi video demo
- Days 9-10: Testing + final polish

## Support

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common issues.

## License

MIT
