# Railway.app Deployment Configuration

This project is configured for deployment to Railway.app using individual `railway.json` files for each service.

## Backend Service
- Location: `/backend/railway.json`
- Deployment: Node.js Express server
- Database: PostgreSQL 16
- Cache: Redis 7
- Broker: Mosquitto MQTT

## Frontend Service  
- Location: `/frontend/railway.json`
- Deployment: React 18 with Mapbox GL
- Build: Multi-stage optimization
- Hosting: Static HTTP server

## Environment Variables

**Backend (.env)**
```
DATABASE_URL=postgresql://user:pass@host:5432/skylark_iot
REDIS_URL=redis://host:6379
MQTT_BROKER_URL=mqtt://broker:1883
JWT_SECRET=your_secret_key
CORS_ORIGIN=https://frontend.railway.app
NODE_ENV=production
```

**Frontend (.env.local)**
```
REACT_APP_API_URL=https://backend.railway.app/api
REACT_APP_MAPBOX_TOKEN=pk_...your_token...
CI=true
```

## Deployment Steps

1. Push code to GitHub
2. Connect repository to Railway.app
3. Create 3 services (Backend, Frontend, Database)
4. Configure environment variables for each
5. Deploy using Railway CLI or Web Dashboard

```bash
# Deploy using Railway CLI
railway up

# View logs
railway logs

# Check status
railway status
```

## Public URLs After Deployment

- **Backend API**: `https://mining-gps-backend.railway.app/api`
- **Frontend Dashboard**: `https://mining-gps-frontend.railway.app`
- **Health Check**: `https://mining-gps-backend.railway.app/health`

---

For detailed deployment instructions, see [DEPLOYMENT.md](../docs/DEPLOYMENT.md)
