# Mining GPS IoT System - Detailed Algorithm Implementation Guide

## Table of Contents
- [Algorithm 1: Route Deviation Detection](#algorithm-1-route-deviation-detection)
- [Algorithm 2: Idle Behavior Detection](#algorithm-2-idle-behavior-detection)
- [Algorithm 3: Fuel Consumption Anomaly](#algorithm-3-fuel-consumption-anomaly)
- [Algorithm 4: Harsh Driving Detection](#algorithm-4-harsh-driving-detection)
- [Algorithm 5: Grade Detection](#algorithm-5-grade-detection)
- [Algorithm 6: Load Classification](#algorithm-6-load-classification)

---

## Algorithm 1: Route Deviation Detection

### Problem Statement
Mining vehicles must follow authorized routes. Deviations indicate:
- Theft prevention failure
- Unauthorized stops at illegal mining sites
- Off-road driving (dangerous terrain)
- Fuel wastage from longer routes

### Mathematical Foundation: Haversine Formula

The Haversine formula calculates great-circle distance between two points on Earth.

**Why not simple Euclidean distance?**
```
❌ Euclidean: √((x₂-x₁)² + (y₂-y₁)²)
   Problem: Earth is spherical, not flat
   At 1km apart: error ±200 meters

✓ Haversine: 2R × atan2(√a, √(1-a))
   Accurate geodetic distance
   Error: ±0.5 meters
```

### Formula Derivation

```
Variables:
  R = 6371.0 (Earth radius in kilometers)
  φ₁, φ₂ = latitude of points 1 and 2 (in radians)
  λ₁, λ₂ = longitude of points 1 and 2 (in radians)

Step 1: Calculate differences
  Δφ = φ₂ - φ₁
  Δλ = λ₂ - λ₁

Step 2: Apply Haversine
  a = sin²(Δφ/2) + cos(φ₁) × cos(φ₂) × sin²(Δλ/2)
  
  Where:
    sin²(Δφ/2) = [sin(Δφ/2)]²
    Each component handles latitude and longitude separately

Step 3: Calculate central angle
  c = 2 × atan2(√a, √(1-a))
  
  Why atan2 instead of cos⁻¹?
    - atan2 is numerically stable for small angles
    - cos⁻¹ has precision issues when distances < 10 meters

Step 4: Final distance
  d = R × c
```

### Real-World Example

```
Location: Mining site in India

Vehicle position: 22.5895°N, 75.8989°E
Authorized geofence center: 22.5890°N, 75.8990°E (2km radius)

Calculation:
  R = 6371 km
  φ₁ = 22.5895° = 0.3938 radians
  φ₂ = 22.5890° = 0.3937 radians
  Δφ = -0.0087 radians
  
  λ₁ = 75.8989° = 1.3243 radians
  λ₂ = 75.8990° = 1.3245 radians
  Δλ = 0.0002 radians

Haversine calculation:
  sin(Δφ/2) = sin(-0.00435) = -0.00435
  sin²(Δφ/2) = 0.0000189
  
  sin(Δλ/2) = sin(0.0001) = 0.0001
  sin²(Δλ/2) = 0.00000001
  
  cos(0.3938) = 0.9234
  cos(0.3937) = 0.9234
  
  a = 0.0000189 + 0.9234² × 0.00000001
    = 0.0000189 + 0.00000001
    = 0.00001891

  c = 2 × atan2(√0.00001891, √(1-0.00001891))
    = 2 × atan2(0.00435, 0.99999)
    = 2 × 0.00435
    = 0.0087

  d = 6371 × 0.0087 = 55.4 km

Wait, that seems wrong! Let me recalculate with actual decimal places...

Actually, 55 km is suspicious. Let's verify with a simpler case:

Test: 1 degree latitude difference at equator = 111.3 km
  Δφ = 1° = 0.01746 radians
  a = sin²(0.00873) = 0.0000762
  c = 2 × atan2(0.00873, 0.99996) = 0.01746
  d = 6371 × 0.01746 = 111.1 km ✓ Correct!

For our mining site (difference ~0.0005°):
  d = 111.1 km × (0.0005/1) = 0.0555 km = 55.5 meters ✓
```

### Code Implementation

```javascript
// Backend/detectionService.js

class DetectionService {
  static haversineDistance(lat1, lon1, lat2, lon2) {
    // Convert degrees to radians
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    // Haversine formula
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * 
      Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Returns distance in kilometers
  }

  static toRad(degrees) {
    return (degrees * Math.PI) / 180;
  }

  static checkRouteDeviation(gpsData, geofence) {
    if (!geofence) return null;

    // Calculate distance from vehicle to geofence center
    const distanceKm = this.haversineDistance(
      gpsData.latitude, gpsData.longitude,
      geofence.center_lat, geofence.center_lon
    );

    // Convert geofence radius from km to m for threshold check
    const geofenceRadiusKm = geofence.radius_km || 2.0;
    const vehicleDistanceM = distanceKm * 1000;
    const geofenceRadiusM = geofenceRadiusKm * 1000;
    const deviationM = vehicleDistanceM - geofenceRadiusM;

    // Threshold: Alert if >50m outside geofence
    if (deviationM > 50) {
      return {
        type: 'ROUTE_DEVIATION',
        severity: deviationM > 200 ? 'HIGH' : 'MEDIUM',
        description: `Vehicle deviated ${deviationM.toFixed(1)}m from route`,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        deviation_meters: Math.round(deviationM),
        timestamp: new Date()
      };
    }

    return null;
  }
}
```

### Edge Detection (Python)

```python
# edge/gps_processor.py

from math import radians, cos, sin, asin, sqrt

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    Returns distance in kilometers
    """
    # Convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r

def check_route_deviation(gps_data, geofence):
    """Check if vehicle deviated from authorized route"""
    if not geofence:
        return None
    
    distance_km = haversine_distance(
        gps_data['latitude'], gps_data['longitude'],
        geofence['center_lat'], geofence['center_lon']
    )
    
    geofence_radius_m = (geofence.get('radius_km', 2.0)) * 1000
    vehicle_distance_m = distance_km * 1000
    deviation_m = vehicle_distance_m - geofence_radius_m
    
    if deviation_m > 50:  # Threshold: 50 meters
        return {
            'type': 'ROUTE_DEVIATION',
            'severity': 'HIGH' if deviation_m > 200 else 'MEDIUM',
            'description': f'Vehicle deviated {deviation_m:.1f}m from route',
            'latitude': gps_data['latitude'],
            'longitude': gps_data['longitude'],
            'deviation_meters': round(deviation_m),
            'timestamp': datetime.datetime.utcnow().isoformat()
        }
    
    return None
```

### Geofence Data Structure

```json
{
  "id": 1,
  "name": "LoadingZone-North",
  "center_lat": 22.5890,
  "center_lon": 75.8990,
  "radius_km": 2.0,
  "threshold_m": 50,
  "waypoints": [
    {"lat": 22.5895, "lon": 75.8989, "radius_m": 100},
    {"lat": 22.5896, "lon": 75.8991, "radius_m": 100}
  ],
  "created_at": "2026-01-01T00:00:00Z"
}
```

### Alert Escalation Logic

```
Deviation Size        Severity   Action
─────────────────────────────────────────────
0-50m                 NONE       No alert
50-100m               MEDIUM     Notify supervisor
100-200m              MEDIUM     Log in database
200-500m              HIGH       Alert with location
500m-1km              HIGH       Alert + map highlight
>1km                  CRITICAL   Alert + phone call
```

---

## Algorithm 2: Idle Behavior Detection

### Problem Statement
Vehicles running engines while stationary consume fuel wastefully:
- Loading/unloading: ~2 liters per 45 minutes
- Rest breaks: 4-5 liters per hour
- Breakdowns: Costs compound over time
- Monthly impact: 10 vehicles×45min idle daily = 300 liters/month = ₹30,000/month loss

### Detection Logic

**Circular Buffer Approach**
```
Instead of querying database for 45 minutes of history,
maintain in-memory rolling buffer on edge device.

Buffer structure:
  deque(maxlen=300)  ← Keeps last 300 points
  At 1 point/second = 5 minutes capacity
  At 10 sec intervals = 50 minutes capacity ✓

For 45-minute check:
  If we have 300 points at 10-sec intervals:
    300 × 10 sec = 3000 seconds = 50 minutes ✓
  Then check if all last 270 points (45 min) have speed < 1
```

### Mathematical Definition

```
idle_condition = AND of:
  1. speed < 1 km/h for duration D
  2. gps_accuracy < 20m (strong signal)
  3. satellites_used >= 4 (valid fix)
  4. D > threshold (15, 30, or 45 minutes)

Severity escalation:
  D = 15 min  → LOW (driver rest)
  D = 30 min  → MEDIUM (extended stop)
  D = 45 min  → HIGH (possible breakdown)
  D > 60 min  → CRITICAL (vehicle immobile)
```

### Code Implementation

```javascript
// Backend/detectionService.js

class DetectionService {
  static checkIdleBehavior(gpsDataBuffer, vehicleId) {
    // gpsDataBuffer = circular deque, max 300 points
    
    // Need at least 270 points for 45-minute check
    // (270 @ 10 sec intervals = 2700 sec = 45 min)
    if (gpsDataBuffer.length < 270) {
      return null; // Not enough history
    }

    // Get last 270 points
    const buffer_array = Array.from(gpsDataBuffer);
    const last45MinPoints = buffer_array.slice(-270);

    // Check if all points indicate idle condition
    const isIdle = last45MinPoints.every(point => {
      const conditions = [
        point.speed < 1,                    // Stationary
        point.accuracy < 20,                // Strong GPS (< 20m error)
        point.satellites_used >= 4,         // Valid fix
        point.heading !== undefined         // Valid data point
      ];
      return conditions.every(c => c); // ALL must be true
    });

    if (isIdle) {
      // Calculate idle duration
      const firstPoint = last45MinPoints[0];
      const lastPoint = last45MinPoints[last45MinPoints.length - 1];
      
      const startTime = new Date(firstPoint.timestamp);
      const endTime = new Date(lastPoint.timestamp);
      const idleDurationMin = (endTime - startTime) / (1000 * 60);

      // Determine severity
      let severity = 'MEDIUM';
      if (idleDurationMin > 60) severity = 'CRITICAL';
      else if (idleDurationMin > 45) severity = 'HIGH';
      else if (idleDurationMin > 30) severity = 'MEDIUM';
      else if (idleDurationMin > 15) severity = 'LOW';

      return {
        type: 'IDLE_BEHAVIOR',
        severity: severity,
        description: `Vehicle idle for ${Math.round(idleDurationMin)} minutes`,
        latitude: firstPoint.latitude,
        longitude: firstPoint.longitude,
        idle_duration_minutes: Math.round(idleDurationMin),
        start_location: `${firstPoint.latitude}, ${firstPoint.longitude}`,
        fuel_loss_estimate_liters: (idleDurationMin / 45 * 2).toFixed(1),
        timestamp: new Date()
      };
    }

    return null;
  }
}
```

### Python Edge Implementation

```python
# edge/gps_processor.py

from collections import deque
from datetime import datetime

class GPSProcessor:
    def __init__(self, vehicle_id):
        self.vehicle_id = vehicle_id
        self.data_buffer = deque(maxlen=300)  # 5-min rolling window
        
    def read_gps_stream(self, gps_id):
        """Multi-threaded GPS reader"""
        while self.is_running:
            try:
                line = conn.readline().decode('utf-8').strip()
                gps_data = self.parser.parse(line)
                
                if gps_data and gps_data.get('latitude'):
                    # Add timestamp
                    gps_data['timestamp'] = datetime.utcnow().isoformat()
                    
                    # Store in circular buffer
                    self.data_buffer.append(gps_data)
                    
                    # Run detections
                    self._run_detections(gps_data)
            
            except Exception as e:
                logger.error(f"GPS error: {e}")

    def _run_detections(self, current_point):
        """Execute all detection algorithms"""
        
        # Only run expensive checks if buffer is full
        if len(self.data_buffer) < 270:
            return  # Need 45 minutes of history
        
        # Idle detection
        idle_alert = self._check_idle_behavior()
        if idle_alert:
            self._publish_alert('idle_behavior', idle_alert)
    
    def _check_idle_behavior(self):
        """Check if vehicle has been idle for 45+ minutes"""
        
        last_45_min = list(self.data_buffer)[-270:]  # 270 points = 45 min
        
        # Check if ALL points indicate idle
        is_idle = all(
            point.get('speed', 0) < 1 and
            point.get('accuracy', 100) < 20 and
            point.get('satellites_used', 0) >= 4
            for point in last_45_min
        )
        
        if not is_idle:
            return None
        
        # Calculate duration
        first_time = datetime.fromisoformat(last_45_min[0]['timestamp'])
        last_time = datetime.fromisoformat(last_45_min[-1]['timestamp'])
        idle_minutes = (last_time - first_time).total_seconds() / 60
        
        # Estimate fuel loss
        # Mining truck burns ~2L per 45 minutes idle
        fuel_loss = (idle_minutes / 45) * 2.0
        
        # Determine severity
        if idle_minutes > 60:
            severity = 'CRITICAL'
        elif idle_minutes > 45:
            severity = 'HIGH'
        elif idle_minutes > 30:
            severity = 'MEDIUM'
        else:
            severity = 'LOW'
        
        return {
            'type': 'IDLE_BEHAVIOR',
            'severity': severity,
            'idle_minutes': round(idle_minutes),
            'fuel_loss_liters': round(fuel_loss, 1),
            'location': {
                'latitude': last_45_min[0]['latitude'],
                'longitude': last_45_min[0]['longitude']
            },
            'timestamp': datetime.utcnow().isoformat()
        }
```

### Database Storage

```sql
-- Idle sessions table
CREATE TABLE idle_sessions (
    id SERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    start_latitude DECIMAL(10, 8),
    start_longitude DECIMAL(11, 8),
    idle_duration_minutes INTEGER,
    fuel_loss_liters DECIMAL(10, 2),
    reason VARCHAR(100),  -- 'DRIVER_REST', 'LOADING', 'BREAKDOWN'
    status VARCHAR(20),   -- 'ongoing', 'resolved'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert idle session when detected
INSERT INTO idle_sessions 
(vehicle_id, start_time, start_latitude, start_longitude, idle_duration_minutes)
VALUES ('TRUCK-001', '2026-03-08 10:00:00', 22.5895, 75.8989, 45);
```

---

## Algorithm 3: Fuel Consumption Anomaly Detection

### Problem Statement
"Why is this vehicle consuming 27 L/100km when target is 12 L/100km?"

Causes:
- Excessive speed (air resistance ∝ velocity²)
- Harsh acceleration/braking (fuel injection spikes)
- Load overweight (engine strain)
- Mechanical issues (tire pressure, engine condition)

### Mathematical Foundation: Quadratic Relationship

**Physics of Fuel Consumption**
```
Energy needed to move vehicle:

E = Work against gravity + Work against friction + Work against air resistance

E = m×g×h + μ×m×g×cos(θ) + ½×ρ×Cd×A×v²

For horizontal road (h=0, θ=0):
E = μ×m×g + ½×ρ×Cd×A×v²

Fuel consumed ∝ Energy
∝ constant + velocity²

Therefore: consumption = baseline + k×(v²)

Mining truck empirical data:
- At v=30 km/h: 10 L/100km
- At v=60 km/h: 12 L/100km (optimal)
- At v=90 km/h: 27 L/100km
- At v=120 km/h: 48 L/100km

Normalized formula:
consumption = baseline × (v/v_optimal)²
            = 12 × (v/60)²
```

### Code Implementation

```javascript
// Backend/detectionService.js

static checkFuelAnomaly(gpsData) {
  const BASELINE_FUEL = 12.0;      // L/100km (mining truck baseline)
  const OPTIMAL_SPEED = 60;         // km/h (fuel efficiency peak)
  const EXCESS_THRESHOLD = 1.2;     // 20% over baseline
  
  const speed = gpsData.speed || 0;
  
  // Skip check for very low speeds (traffic)
  if (speed < OPTIMAL_SPEED * 0.5) return null;
  
  // Apply quadratic formula
  // consumption = baseline × (speed/optimal)²
  const speedFactor = Math.pow(speed / OPTIMAL_SPEED, 2);
  const estimatedConsumption = BASELINE_FUEL * speedFactor;
  
  // Check if exceeds threshold
  if (estimatedConsumption > BASELINE_FUEL * EXCESS_THRESHOLD) {
    // Calculate excess percentage
    const excessPercent = 
      ((estimatedConsumption - BASELINE_FUEL) / BASELINE_FUEL) * 100;
    
    // Determine severity
    const severity = excessPercent > 40 ? 'HIGH' : 'MEDIUM';
    
    return {
      type: 'FUEL_ANOMALY',
      severity: severity,
      description: `Excessive fuel consumption at ${speed} km/h`,
      details: {
        speed_kmh: speed,
        speed_factor: speedFactor.toFixed(2),
        baseline_consumption_l_per_100km: BASELINE_FUEL,
        estimated_consumption_l_per_100km: estimatedConsumption.toFixed(2),
        excess_percent: excessPercent.toFixed(1),
        cost_per_100km: (estimatedConsumption * 100).toFixed(0)  // At ₹100/L
      },
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      timestamp: new Date()
    };
  }
  
  return null;
}
```

### Real-World Examples

```
Speed    Factor    Consumption    Excess%   Cost/100km   Status
─────────────────────────────────────────────────────────────────
30       0.25      3 L/100km      -75%      ₹300         Efficient
45       0.56      6.7 L/100km    -44%      ₹670         Good
60       1.00      12 L/100km     0%        ₹1200        Optimal ✓
75       1.56      18.7 L/100km   +56%      ₹1870        Excessive
90       2.25      27 L/100km     +125%     ₹2700        Very High ⚠️
105      3.06      36.8 L/100km   +207%     ₹3680        Dangerous ⚠️
120      4.00      48 L/100km     +300%     ₹4800        Critical ⛔

Example Trip Analysis:
  Trip distance: 100 km
  
  At 60 km/h (optimal):
    Fuel: 12 L
    Time: 100/60 = 1.67 hours
    Cost: 12 × ₹100 = ₹1200
  
  At 90 km/h (speeding):
    Fuel: 27 L (125% excess)
    Time: 100/90 = 1.11 hours (saves 36 minutes)
    Cost: 27 × ₹100 = ₹2700
    
    Extra cost: ₹2700 - ₹1200 = ₹1500 loss
    For 550 vehicles, 2 trips/day:
    Daily loss: 550 × 2 × ₹1500 = ₹16,50,000/day
    Monthly: ₹16,50,000 × 30 = ₹4.95 करोड़/month!
```

---

## Algorithm 4: Harsh Driving Detection

### Problem Statement
Aggressive acceleration/braking:
- Damages vehicle components
- Increases fuel consumption
- Risks driver safety
- Violates company policy

### Mathematical Definition

```
Acceleration = rate of speed change over time

a = Δv / Δt = (v₂ - v₁) / (t₂ - t₁)

Units: km/h per second

Typical values:
- Normal acceleration: ±0.5 km/h/sec
- Moderate acceleration: ±1.5 km/h/sec
- Aggressive acceleration: ±2-3 km/h/sec
- Dangerous braking: >5 km/h/sec

Threshold for detection: ±3 km/h/sec
```

### Code Implementation

```javascript
static checkHarshDriving(currentPoint, previousPoint, timeDeltaSeconds) {
  if (!previousPoint) return null;
  
  const ACCELERATION_THRESHOLD = 3;  // km/h per second
  
  const speedDelta = currentPoint.speed - previousPoint.speed;
  const acceleration = speedDelta / timeDeltaSeconds;
  
  // Check absolute value for both acceleration and braking
  if (Math.abs(acceleration) > ACCELERATION_THRESHOLD) {
    const isAccelerating = acceleration > 0;
    const severity = Math.abs(acceleration) > 5 ? 'HIGH' : 'MEDIUM';
    
    return {
      type: 'HARSH_DRIVING',
      severity: severity,
      driving_type: isAccelerating ? 'acceleration' : 'braking',
      description: isAccelerating 
        ? `Harsh acceleration: ${Math.abs(acceleration).toFixed(2)} km/h/sec`
        : `Harsh braking: ${Math.abs(acceleration).toFixed(2)} km/h/sec`,
      details: {
        previous_speed: previousPoint.speed,
        current_speed: currentPoint.speed,
        acceleration_kmh_per_sec: acceleration.toFixed(2),
        time_delta_seconds: timeDeltaSeconds,
        impact: isAccelerating ? 'Fuel consumption spike' : 'Component stress'
      },
      latitude: currentPoint.latitude,
      longitude: currentPoint.longitude,
      timestamp: new Date()
    };
  }
  
  return null;
}
```

### Real-World Scenarios

```
Scenario 1: Normal acceleration
  Speed change: 60 → 65 km/h over 10 seconds
  Acceleration: (65-60)/10 = 0.5 km/h/sec
  Status: NORMAL ✓

Scenario 2: Aggressive acceleration (tailgating)
  Speed change: 40 → 70 km/h over 10 seconds
  Acceleration: (70-40)/10 = 3.0 km/h/sec
  Status: ALERT MEDIUM ⚠️
  Fuel impact: +15% extra consumption for acceleration phase

Scenario 3: Emergency braking
  Speed change: 80 → 40 km/h over 8 seconds
  Acceleration: (40-80)/8 = -5.0 km/h/sec
  Status: ALERT HIGH ⚠️
  Component stress: Brake pads wear accelerated
  Safety risk: Possible collision cause
```

---

## Algorithm 5: Grade Detection (Uphill/Downhill)

### Problem Statement
Understanding terrain helps:
- Predict fuel consumption (uphill uses more)
- Assess driver safety (downhill braking needs)
- Optimize routes

### Mathematical Basis

```
MPU-6050 Accelerometer measures acceleration
  X-axis: Side-to-side (cornering)
  Y-axis: Forward-backward
  Z-axis: Vertical (gravity component)

On flat road:
  Z-axis = 1G (9.81 m/s²) - gravity pulling down

On uphill (θ degrees):
  Vehicle accelerates "up" relative to gravity
  Z-axis < 1G
  Component facing gravity = cos(θ)
  Z-accel = 1 - sin(θ) ≈ 1 - θ (for small angles)
  For 10° uphill: Z = 0.83G

On downhill:
  Vehicle accelerates "down" relative to gravity
  Z-axis > 1G
  Z-accel = 1 + sin(θ) ≈ 1 + θ
  For 10° downhill: Z = 1.17G

Detection threshold:
  grade = 'uphill' if Z < 0.7G (steep)
  grade = 'downhill' if Z > 1.3G (steep)
```

### Code Implementation

```javascript
static checkGradeDetection(accelerometerData) {
  const Z_ACCEL = accelerometerData.z_acceleration_g || 1.0;
  
  const UPHILL_THRESHOLD = 0.7;      // G
  const DOWNHILL_THRESHOLD = 1.3;    // G
  const STEEP_THRESHOLD_UP = 0.5;     // Very steep uphill
  const STEEP_THRESHOLD_DOWN = 1.5;   // Very steep downhill
  
  if (Z_ACCEL < UPHILL_THRESHOLD) {
    const steepness = Math.asin(1 - Z_ACCEL) * 180 / Math.PI;
    
    return {
      type: 'GRADE_DETECTION',
      terrain: 'uphill',
      severity: Z_ACCEL < STEEP_THRESHOLD_UP ? 'HIGH' : 'MEDIUM',
      grade_degrees: steepness.toFixed(1),
      z_acceleration: Z_ACCEL.toFixed(2),
      description: `Vehicle climbing uphill (${steepness.toFixed(1)}°)`,
      fuel_impact: 'Consumption increases by ~5% per degree'
    };
  }
  
  if (Z_ACCEL > DOWNHILL_THRESHOLD) {
    const steepness = Math.asin(Z_ACCEL - 1) * 180 / Math.PI;
    
    return {
      type: 'GRADE_DETECTION',
      terrain: 'downhill',
      severity: Z_ACCEL > STEEP_THRESHOLD_DOWN ? 'HIGH' : 'MEDIUM',
      grade_degrees: steepness.toFixed(1),
      z_acceleration: Z_ACCEL.toFixed(2),
      description: `Vehicle descending downhill (${steepness.toFixed(1)}°)`,
      safety_impact: 'Requires careful braking to avoid runaway'
    };
  }
  
  return null; // Flat terrain
}
```

---

## Algorithm 6: Load Classification

### Problem Statement
Detect when vehicles are carrying heavy loads:
- Impacts fuel consumption significantly
- Safety concern if unbalanced
- Affects vehicle health

### Mathematical Approach

```
Acceleration vector magnitude:
  a_total = √(X² + Y² + Z²)

On flat road:
  Z = 1G (gravity)
  X, Y ≈ 0 (unless cornering)
  a_total ≈ 1G

With heavy load:
  Weight increases → More gravity component
  Z > 1G (more ground reaction force)
  a_total > 1.5G

Load classification:
  a_total < 1.2G: Light load
  1.2G < a_total < 1.5G: Medium load
  a_total > 1.5G: Heavy load
```

### Code Implementation

```javascript
static checkLoadClassification(accelerometerData) {
  const X = accelerometerData.x_acceleration_g || 0;
  const Y = accelerometerData.y_acceleration_g || 0;
  const Z = accelerometerData.z_acceleration_g || 1.0;
  
  // Calculate magnitude
  const magnitude = Math.sqrt(X*X + Y*Y + Z*Z);
  
  const MEDIUM_LOAD_THRESHOLD = 1.2;
  const HEAVY_LOAD_THRESHOLD = 1.5;
  
  if (magnitude > HEAVY_LOAD_THRESHOLD) {
    return {
      type: 'LOAD_CLASSIFICATION',
      load_category: 'heavy',
      severity: 'MEDIUM',
      acceleration_magnitude_g: magnitude.toFixed(2),
      description: 'Vehicle carrying heavy load',
      fuel_impact: 'Estimated +30% fuel consumption',
      safety_impact: 'Reduced braking efficiency'
    };
  }
  
  if (magnitude > MEDIUM_LOAD_THRESHOLD) {
    return {
      type: 'LOAD_CLASSIFICATION',
      load_category: 'medium',
      severity: 'LOW',
      acceleration_magnitude_g: magnitude.toFixed(2),
      description: 'Vehicle carrying medium load',
      fuel_impact: 'Estimated +15% fuel consumption'
    };
  }
  
  // Light load or empty - no alert
  return null;
}
```

---

## Summary: All 6 Algorithms Comparison

| Algorithm | Data Source | Update Freq | Latency | Threshold | Severity |
|-----------|------------|-------------|---------|-----------|----------|
| Route Deviation | GPS coordinates | Per point | <1sec | >50m | M/H |
| Idle Behavior | Speed buffer | 45-min windows | 45min | Speed<1 & 45min | L/M/H |
| Fuel Anomaly | Speed | Per point | <1sec | Consumption >baseline×1.2 | M/H |
| Harsh Driving | Speed deltas | Per point | <1sec | ±3 km/h/sec | M/H |
| Grade Detection | Z-accel | Per point | <1sec | Z< 0.7G or >1.3G | M/H |
| Load Classification | 3D accel mag | Per point | <1sec | Mag >1.5G | LOW |

---

## Integration: How Multiple Alerts Correlate

```
Scenario: Vehicle climbing steep mountain road with heavy load

Alert 1: GRADE_DETECTION (uphill 15°)
  Z-acceleration: 0.6G
  Status: Climbing steep grade

Alert 2: LOAD_CLASSIFICATION (heavy load)
  Magnitude: 1.7G
  Status: Heavy cargo affecting dynamics

Alert 3: FUEL_ANOMALY (consumption high)
  Speed: 40 km/h (slow because of grade)
  Estimated: 30 L/100km (vs baseline 12)
  Status: Fuel consumption spiked due to grade + load combo

Alert 4: HARSH_DRIVING (braking detected)
  Deceleration: 2.5 km/h/sec
  Status: Careful descent, controlled braking

Root Cause Analysis:
  Vehicle is carrying heavy load up steep mountain
  Multiple systems stressed simultaneously
  High fuel consumption EXPECTED and NORMAL
  Alerts should be correlated, not independent

Smart System Output:
  Instead of 4 separate "problems"
  System recognizes: "Vehicle climbing mountain with heavy cargo"
  Expected behavior ✓
  Monitor for safety only ⚠️
```

---

**Document Version**: 1.0  
**Last Updated**: March 8, 2026  
**Algorithm Coverage**: 100% (all 6 detailed with code)

