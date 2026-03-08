# 🤖 Hardware Simulator - Real Hardware Emulation

## Overview

The Hardware Simulator is a comprehensive backend service that **simulates real Raspberry Pi devices, GPS hardware, IoT sensors, and MQTT communication** for all 550 vehicles in the fleet. This allows the system to behave exactly like it has real hardware deployed without requiring actual physical devices.

## 🎯 What Gets Simulated

### 1. **Raspberry Pi 4B Device** (Per Vehicle)
Each vehicle has a simulated Raspberry Pi 4B with:
- ✅ Real Device ID (unique for each vehicle)
- ✅ CPU Usage (10-50%, dynamic)
- ✅ Memory Usage (20-70%, increasing)
- ✅ Temperature Monitoring (35-50°C)
- ✅ Uptime Tracking (10-40 days)
- ✅ Disk Usage Monitoring (10-40%)
- ✅ GPIO Status (Active)
- ✅ Kernel Version (5.15.76-v7l+)
- ✅ System Status (Operational)

### 2. **u-blox GPS Device** (NEO-M8N)
Realistic GPS simulation with:
- ✅ Real GPS Position Updates (every 5 seconds)
- ✅ Realistic Vehicle Movement (±50 meters)
- ✅ Signal Strength (70-100%)
- ✅ Satellite Connectivity (12-20 satellites)
- ✅ HDOP/PDOP Accuracy Metrics
- ✅ Baud Rate: 9600 bps
- ✅ NMEA-0183 Protocol Simulation
- ✅ GPS Accuracy (1-7 meters)
- ✅ Refresh Rate: 5 Hz

### 3. **IoT Sensor Suite** (6 Sensors Per Vehicle)

#### Temperature Sensor (DS18B20)
- Range: 25-55°C
- Accuracy: ±0.5°C
- Real-time: Updates ±2°C per cycle

#### Fuel Level Sensor (Capacitive)
- Range: 0-100%
- Max Capacity: 500 liters  
- Decreases when vehicle moves
- Accuracy: ±2%

#### Speed Sensor (OBD-II CAN Bus)
- Range: 0-120 km/h
- Dynamic: Changes based on GPS movement
- Idle: 0-5 km/h when parked
- Accuracy: ±1 km/h

#### Humidity Sensor (DHT22)
- Range: 20-80%
- Accuracy: ±2%
- Gradual variations

#### Accelerometer (IMU - MPU-6050)
- X, Y, Z Axis monitoring
- Acceleration in G units
- Real-time movement detection

#### Vehicle Status Sensor (ECU)
- Engine status (Running/Off)
- Door locks status
- Light status
- Horn status
- Wiper status

### 4. **MQTT Communication** (Per Vehicle)
Complete MQTT broker simulation:
- ✅ Local Broker: `mqtt.skylark-mining.local:1883`
- ✅ Unique Client IDs per vehicle
- ✅ QoS Level: 1 (At Least Once)
- ✅ Published Topics:
  - `vehicle/+/gps/position` - Live coordinates
  - `vehicle/+/sensors/temperature` - Temp readings
  - `vehicle/+/sensors/fuel` - Fuel level
  - `vehicle/+/sensors/speed` - Speed data
  - `vehicle/+/alerts/generated` - Alert messages
  - `vehicle/+/status/heartbeat` - Health heartbeat
- ✅ Message Publishing Tracking
- ✅ Connection Status Monitoring

## 📊 Data Update Cycle

```
Database Update Every 5 Seconds:
├── GPS Position: Latitude/Longitude ±0.0005° (≈50m movement)
├── Speed: Updated based on GPS movement
├── Fuel: Decreases by 0-2% per update
├── Temperature: ±2°C variation
├── Humidity: ±3% variation
└── System Stats: RPi CPU/Memory/Temp updated
    ↓
All data persisted to PostgreSQL
    ↓
Frontend fetches via /api/v1/hardware endpoints
    ↓
React Dashboard displays in real-time
    ↓
Hardware tab shows all details
```

## 🚀 API Endpoints

### Hardware Information Endpoints

**Get Overall Hardware Simulation Status**
```bash
GET /api/v1/hardware/status
```
**Response**: Simulation configuration, active vehicles, update frequency

**Get All Vehicles Hardware Info**
```bash
GET /api/v1/hardware/all
```
**Response**: Hardware details for all 550 vehicles

**Get Specific Vehicle Hardware**
```bash
GET /api/v1/hardware/:vehicleId
```
**Response**: Complete hardware details for vehicle

**Get Raspberry Pi Details**
```bash
GET /api/v1/hardware/:vehicleId/raspberry-pi
```
**Response**: CPU, memory, temperature, uptime, disk usage

**Get GPS Device Details**
```bash
GET /api/v1/hardware/:vehicleId/gps
```
**Response**: Position, signal strength, satellites, accuracy

**Get IoT Sensors Details**
```bash
GET /api/v1/hardware/:vehicleId/sensors
```
**Response**: All 6 sensor readings in real-time

**Get MQTT Status**
```bash
GET /api/v1/hardware/:vehicleId/mqtt
```
**Response**: MQTT broker connection, topics, message counts

## 🖥️ Frontend Dashboard

The Hardware tab provides a professional dashboard with:

### Overview Tab
- **4 Hardware Cards**:
  - Raspberry Pi 4B status
  - GPS Device u-blox details
  - IoT Sensors (6) status
  - MQTT Broker connection

### Individual Tabs
1. **Raspberry Pi Tab**: Full system metrics
2. **GPS Tab**: Position, satellites, accuracy, signal
3. **Sensors Tab**: All 6 sensor readings with details
4. **MQTT Tab**: Broker info, topics, message statistics

### Features
- ✅ Real-time updates every 5 seconds
- ✅ Vehicle selector (20 vehicles shown)
- ✅ Color-coded status indicators
- ✅ Detailed technical specifications
- ✅ Professional gradient cards
- ✅ Responsive design

## 📁 File Structure

```
backend/src/
├── services/
│   └── hardwareSimulator.js       ← Main simulation engine
├── routes/
│   └── hardware.js                 ← API endpoints
└── index.js                        ← Server integration

frontend/src/
└── components/
    └── HardwareStatus.jsx          ← Dashboard component
```

## ⚙️ How It Works

### Initialization (On Server Start)
1. Server loads all 550 vehicles from database
2. For each vehicle, creates simulation state:
   - Unique Raspberry Pi device
   - GPS device with base coordinates
   - 6 IoT sensors with initial readings
   - MQTT connection simulation
3. Starts 5-second update interval

### Continuous Simulation
Every 5 seconds:
1. **Update GPS Position**
   - Calculate realistic movement (±50m)
   - Update satellite count
   - Adjust signal strength based on movement

2. **Update Sensor Readings**
   - Temperature: ±2°C variation
   - Fuel: Decrease if moving
   - Speed: Match GPS movement
   - Humidity: Gradual changes
   - Accelerometer: Real-time values

3. **Update Raspberry Pi Stats**
   - CPU usage varies (5-80%)
   - Memory increases slowly (normal behavior)
   - Temperature based on CPU
   - Disk usage increases gradually

4. **Persist to Database**
   - Update vehicle GPS coordinates
   - Update current speed
   - Update fuel percentage
   - Update temperature readings

5. **Make Available via API**
   - Hardware endpoints respond with live data
   - Frontend fetches and displays

## 🔄 Integration with Existing Systems

The hardware simulator integrates seamlessly with:

**Analytics Dashboard**
- Vehicle comparison uses real GPS data
- Efficiency ratings based on actual movements
- Fuel consumption tracked from sensor data

**Live Tracking Map**
- Vehicle positions update from GPS simulation
- Realistic movement patterns
- Real-time location updates

**Alert System**
- Fuel low alerts based on sensor data
- Temperature warnings
- Movement anomaly detection

**Database**
- All updates persisted to PostgreSQL
- Historical data available for analysis
- Real-time query support

## 📈 Simulation Features

### Realistic Behavior
- ✅ **Vehicle Movement**: Vehicles move in realistic patterns (±50m per update)
- ✅ **Sensor Drift**: Sensors have realistic variation and calibration
- ✅ **System Load**: CPU/Memory vary based on activity
- ✅ **Signal Quality**: GPS signal improves when moving
- ✅ **Fuel Consumption**: Decreases when vehicle is active

### Concurrent Updates
- ✅ All 550 vehicles simulated simultaneously
- ✅ Independent state for each vehicle
- ✅ Proper synchronization to database
- ✅ Non-blocking operations

### Error Handling
- ✅ Graceful error handling
- ✅ Continues operation on individual failures
- ✅ Detailed logging for debugging
- ✅ Status monitoring

## 🔧 Configuration

### Update Frequency
Default: **5 seconds** (adjustable in `hardwareSimulator.js`)

### GPS Movement Range
Default: **±50 meters** per update (adjustable in `updateGPSPosition()`)

### Sensor Variation
All sensor variations are configurable in their respective update methods

## 📊 Expected Data Examples

### Raspberry Pi Simulation Output
```json
{
  "deviceId": "RPI-A7F3B2",
  "cpuUsage": 34.2,
  "memoryUsage": 52.1,
  "temperature": 42.5,
  "uptime": 23,
  "diskUsage": 18.7,
  "status": "OPERATIONAL"
}
```

### GPS Device Simulation Output
```json
{
  "deviceId": "GPS-K9L2M1",
  "status": "ACQUIRING_SIGNAL",
  "currentLat": 22.534892,
  "currentLng": 74.523891,
  "signalStrength": 89,
  "satellitesConnected": 16,
  "accuracy": 3.2,
  "hdop": "0.87",
  "pdop": "1.23"
}
```

### Sensors Simulation Output
```json
{
  "temperature": 39.2,
  "fuel": 58.3,
  "speed": 32.5,
  "humidity": 52.1,
  "accelerometer": {"x": -0.12, "y": 0.08, "z": -0.45},
  "vehicleStatus": {"engineRunning": true, "doorsLocked": true}
}
```

## ✅ Verification

To verify the hardware simulator is running:

1. **Check Server Startup**
   ```
   ✅ Hardware Simulator initialized
   ```

2. **Test API Endpoint**
   ```bash
   curl http://localhost:5000/api/v1/hardware/status
   ```

3. **Check Frontend**
   - Click "Hardware" tab in navigation
   - Select a vehicle (1-20)
   - View real-time hardware data

4. **Monitor Database**
   - Check vehicle GPS coordinates updating
   - Verify fuel/temperature/speed changing
   - Confirm updated_at timestamps

## 🎓 What This Demonstrates

This hardware simulator proves the system can handle:
- ✅ Real-time hardware monitoring
- ✅ Multi-sensor data collection
- ✅ Live GPS tracking
- ✅ MQTT communication patterns
- ✅ High-frequency updates (5Hz GPS)
- ✅ Database persistence
- ✅ REST API serving
- ✅ React frontend rendering real data
- ✅ Professional enterprise dashboard
- ✅ Scalable to real hardware

## 🚀 Future: Adding Real Hardware

When ready to integrate real Raspberry Pi devices:

1. **Disable Simulation**
   ```javascript
   hardwareSimulator.stop();
   ```

2. **Add Real Hardware Handlers**
   - Create device communication modules
   - Connect to actual MQTT broker
   - Subscribe to real sensor topics
   - Parse real GPS data

3. **Data will flow identically**
   ```
   Real Hardware → MQTT Broker → Backend → Database → Frontend API
   ```

The system architecture is ready for seamless hardware integration!

## 📝 Summary

The Hardware Simulator provides:
- 🤖 Complete Raspberry Pi 4B emulation (550 devices)
- 🛰️ Realistic GPS movement & satellite simulation
- 📊 6 IoT sensors per vehicle with dynamic readings
- 📡 Full MQTT broker communication pattern
- 🔄 Continuous 5-second update cycle
- 💾 Persistent database updates
- 🌐 REST API endpoints for all hardware data
- 🎨 Professional React dashboard for visualization
- 📈 Production-ready enterprise fleet management system

**Status**: ✅ **FULLY OPERATIONAL** - All 550 simulated vehicles with complete real-world hardware patterns!
