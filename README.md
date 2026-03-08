# Mining GPS IoT Fleet Management System

Real-time GPS tracking and monitoring system for mining vehicle fleets with edge device intelligence for anomaly detection.

## Architecture

```
┌─────────────────┐
│   Edge Device   │  (Python: GPS data collection + 6 detection algorithms)
│   (MQTT Client) │
└────────┬────────┘
         │ MQTT
         ▼
    ┌─────────┐
    │ Mosquitto│ (Message Broker)
    └────┬────┘
         │
         ▼
┌─────────────────────┐         ┌──────────────────┐
│  Backend (Node.js)  │◄───────►│  PostgreSQL DB   │
│   Express API       │         │  (Vehicle Data)  │
│   (Port 5000)       │         └──────────────────┘
└────────┬────────────┘
         │ REST API
         ▼
┌──────────────────────┐
│ Frontend (React)     │
│ Dashboard (Port 3001)│
│ - Live Vehicle Map  │
│ - Performance KPIs  │
│ - Alerts & History  │
└──────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 16+
- Python 3.8+
- PostgreSQL 12+
- Mosquitto (MQTT Broker)

### Installation & Running

#### 1. Clone Repository
```bash
git clone https://github.com/Rajprithvi2021/mining-gps-iot-system.git
cd mining-gps-iot-system
```

#### 2. Backend Setup
```bash
cd backend
npm install
# Update .env with PostgreSQL credentials
npm start
```
Backend runs on: `http://localhost:5000`

#### 3. Frontend Setup
```bash
cd frontend
npm install
# Update .env with Mapbox token
npm start
```
Dashboard runs on: `http://localhost:3001`

#### 4. Edge Device Setup (Optional)
```bash
cd edge
pip install -r requirements.txt
python gps_processor.py
```

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/vehicles` | Get all vehicles with current status |
| `GET /api/v1/vehicles/:id` | Get specific vehicle details |
| `GET /api/v1/alerts` | Get recent alerts |
| `GET /api/v1/dashboard` | Get dashboard summary (KPIs) |
| `GET /api/v1/analytics` | Get analytics data |

## Features

- **Real-Time Tracking**: Live vehicle locations on interactive Mapbox
- **Performance Monitoring**: Speed, fuel consumption, temperature tracking
- **Anomaly Detection**: 6 algorithms for identifying issues:
  - Fuel anomaly detection
  - Harsh driving detection
  - Idle time detection
  - Route deviation detection
  - Grade detection
  - Load classification
- **Alert System**: Real-time notifications for critical events
- **Dashboard**: KPIs and metrics visualization

## Environment Variables

### Frontend (.env)
```
REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_MAPBOX_TOKEN=your_mapbox_token_here
```

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/mining_fleet
MQTT_BROKER=localhost
JWT_SECRET=your_secret_key
```

## Database

PostgreSQL database includes:
- Vehicles (fleet information)
- GPS Logs (vehicle locations)
- Alerts (anomalies and notifications)
- Performance Metrics (KPIs)

## Technology Stack

- **Frontend**: React 18, Mapbox GL, Tailwind CSS, Recharts
- **Backend**: Node.js, Express, PostgreSQL
- **Edge**: Python, MQTT
- **DevOps**: Docker, GitHub Actions

## License

MIT
