# Mining GPS IoT System - API Documentation

## API Endpoints

### Base URL
- Development: `http://localhost:3000/api/v1`
- Production: `https://mining-gps-backend.railway.app/api/v1`

### Authentication
Currently using rate limiting. In production, add API key headers:
```
X-API-Key: your-secret-api-key
```

---

## Endpoints

### GPS Data

#### POST `/gps-data`
Receive GPS data from Raspberry Pi or Simulator

**Request:**
```json
{
  "vehicle_id": "vehicle-001",
  "gps_points": [
    {
      "latitude": 28.5355,
      "longitude": 77.2031,
      "speed_kmh": 40.5,
      "heading_degrees": 180,
      "accuracy_m": 5,
      "satellites": 12,
      "timestamp": "2024-03-15T10:30:00Z",
      "gps_source": "GPS_1"
    }
  ],
  "alerts": [
    {
      "type": "high_idle_duration",
      "severity": "medium",
      "description": "Vehicle idle for 25 minutes",
      "latitude": 28.5355,
      "longitude": 77.2031,
      "timestamp": "2024-03-15T10:30:00Z",
      "metadata": {
        "idle_duration_min": 25,
        "location_type": "weighbridge"
      }
    }
  ]
}
```

**Response:** 
```json
{
  "success": true,
  "received_count": 10,
  "alerts_count": 1
}
```

---

### Vehicles

#### GET `/vehicles`
List all vehicles

**Response:**
```json
{
  "success": true,
  "vehicles": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Truck-A",
      "type": "dump_truck",
      "active": true,
      "current_latitude": 28.5355,
      "current_longitude": 77.2031,
      "current_speed_kmh": 40.5,
      "last_gps_update": "2024-03-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

#### GET `/vehicles/{id}`
Get single vehicle details

#### GET `/vehicles/{id}/current`
Get real-time position

**Response:**
```json
{
  "success": true,
  "position": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "current_latitude": 28.5355,
    "current_longitude": 77.2031,
    "current_speed_kmh": 40.5,
    "last_gps_update": "2024-03-15T10:30:00Z"
  }
}
```

#### GET `/vehicles/{id}/history`
Get historical GPS data

**Query Parameters:**
- `start_time` - ISO timestamp
- `end_time` - ISO timestamp
- `limit` - Max 1000

**Response:**
```json
{
  "success": true,
  "points": [
    {
      "id": "gps-001",
      "vehicle_id": "vehicle-001",
      "latitude": 28.5355,
      "longitude": 77.2031,
      "speed_kmh": 40.5,
      "timestamp": "2024-03-15T10:30:00Z"
    }
  ],
  "count": 100
}
```

---

### Alerts

#### GET `/alerts`
Get all alerts with filtering

**Query Parameters:**
- `vehicle_id` - Filter by vehicle
- `type` - Alert type (route_deviation, high_idle_duration, high_fuel_consumption)
- `severity` - low, medium, high, critical
- `resolved` - true/false
- `limit` - Default 100

**Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "alert-001",
      "vehicle_id": "vehicle-001",
      "alert_type": "route_deviation",
      "severity": "high",
      "latitude": 28.5355,
      "longitude": 77.2031,
      "timestamp": "2024-03-15T10:30:00Z",
      "description": "Vehicle deviated 65m from route",
      "metadata": {
        "deviation_distance_m": 65,
        "route_name": "pit-to-dump"
      },
      "resolved": false
    }
  ],
  "total": 1
}
```

#### POST `/alerts/{id}/resolve`
Mark alert as resolved

**Request:**
```json
{
  "resolved_by": "operator-001",
  "notes": "False positive, route adjustment"
}
```

**Response:**
```json
{
  "success": true,
  "alert": {
    "id": "alert-001",
    "resolved": true,
    "resolved_at": "2024-03-15T10:35:00Z",
    "resolved_by": "operator-001",
    "resolution_notes": "False positive, route adjustment"
  }
}
```

---

### Dashboard

#### GET `/dashboard/summary`
Get real-time KPI summary

**Response:**
```json
{
  "success": true,
  "summary": {
    "vehicles_active": 3,
    "vehicles_idle": 1,
    "fuel_consumed_today_liters": 450.5,
    "cost_today_inr": 45050,
    "alerts_today": 5,
    "alerts_by_type": [
      {
        "type": "route_deviation",
        "count": 2
      },
      {
        "type": "high_idle_duration",
        "count": 3
      }
    ]
  }
}
```

---

### Routes

#### GET `/routes`
List all mining routes

**Response:**
```json
{
  "success": true,
  "routes": [
    {
      "id": "route-001",
      "name": "Pit to Dump",
      "description": "Primary haul route from excavation pit to dump site",
      "waypoints": [
        {
          "lat": 28.5355,
          "lng": 77.2031,
          "name": "Pit Entrance"
        }
      ],
      "deviation_threshold_m": 40,
      "expected_duration_min": 40,
      "expected_distance_km": 6.5
    }
  ]
}
```

#### POST `/routes`
Create new route

**Request:**
```json
{
  "name": "New Route",
  "description": "Route description",
  "waypoints": [
    { "lat": 28.5355, "lng": 77.2031, "name": "Start" }
  ],
  "deviation_threshold_m": 50,
  "expected_duration_min": 30,
  "expected_distance_km": 5.0
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error description"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad request (validation errors)
- `404` - Not found
- `429` - Too many requests (rate limited)
- `500` - Server error

### Validation Errors

```json
{
  "success": false,
  "errors": [
    {
      "param": "vehicle_id",
      "msg": "vehicle_id required"
    }
  ]
}
```

---

## WebSocket Events

Real-time updates via WebSocket at `/` endpoint.

### Client Events (Send)
```javascript
// Subscribe to vehicle updates
socket.emit('subscribe_vehicle', 'vehicle-001');
```

### Server Events (Receive)
```javascript
// Vehicle position update
socket.on('vehicle_update', {
  id: 'vehicle-001',
  latitude: 28.5355,
  longitude: 77.2031,
  speed_kmh: 40.5,
  timestamp: '2024-03-15T10:30:00Z'
});

// Alert triggered
socket.on('alert_triggered', {
  id: 'alert-001',
  vehicle_id: 'vehicle-001',
  alert_type: 'route_deviation',
  severity: 'high',
  timestamp: '2024-03-15T10:30:00Z'
});
```

---

## Rate Limiting

- Limit: 1000 requests per minute
- Header: `X-RateLimit-Remaining`

---

## Pagination

All list endpoints support pagination:
- `limit` - Number of results (default 100, max 1000)

---

## Example Usage

### JavaScript
```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'http://localhost:3000/api/v1'
});

// Get all vehicles
const vehicles = await client.get('/vehicles');

// Send GPS data
await client.post('/gps-data', {
  vehicle_id: 'vehicle-001',
  gps_points: [...],
  alerts: [...]
});
```

### Python
```python
import requests

BASE_URL = 'http://localhost:3000/api/v1'

# Get vehicles
response = requests.get(f'{BASE_URL}/vehicles')
vehicles = response.json()

# Send GPS data
requests.post(f'{BASE_URL}/gps-data', json={
  'vehicle_id': 'vehicle-001',
  'gps_points': [...],
  'alerts': [...]
})
```

### cURL
```bash
# Get vehicles
curl http://localhost:3000/api/v1/vehicles

# Send GPS data
curl -X POST http://localhost:3000/api/v1/gps-data \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "vehicle-001",
    "gps_points": [...],
    "alerts": [...]
  }'
```
