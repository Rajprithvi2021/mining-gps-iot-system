"""
Anomaly Detection Engine
Implements edge-level detection for:
- Route deviation
- Idle behavior
- Fuel consumption anomalies

All detections run on Raspberry Pi for real-time response (<500ms)
"""

from typing import Optional, Dict, List
from datetime import datetime, timedelta
import math


class DetectionEngine:
    """Real-time anomaly detection for vehicle operations"""
    
    def __init__(self, vehicle_id: str, config: Dict):
        self.vehicle_id = vehicle_id
        self.config = config
        self.last_alert = {}  # Prevent duplicate alerts
    
    def detect_route_deviation(self, data_points: List[Dict]) -> Optional[Dict]:
        """
        Detect if vehicle deviates from expected route
        
        Algorithm:
        1. Get expected route polygon from geofence
        2. Calculate minimum distance from current position to route
        3. If distance > threshold, trigger alert
        
        Args:
            data_points: List of GPS measurements (last N seconds)
        
        Returns:
            Alert dict if deviation detected, None otherwise
        """
        
        if len(data_points) < 5:
            return None
        
        # Get current position (latest point)
        current = data_points[-1]
        current_lat = current.get('latitude')
        current_lon = current.get('longitude')
        
        # Expected geofence (hardcoded for mine A - would come from DB in production)
        geofence = self.config.get('geofence', {
            'center_lat': 48.8566,
            'center_lon': 2.3522,
            'radius_km': 2.0,
            'type': 'circle'
        })
        
        # Calculate distance from current position to geofence center
        distance_to_center = self._haversine(
            current_lat, current_lon,
            geofence['center_lat'], geofence['center_lon']
        )
        
        # Check if outside geofence
        deviation_threshold = self.config.get('deviation_threshold_m', 50)
        geofence_radius_m = geofence['radius_km'] * 1000
        
        if distance_to_center * 1000 > geofence_radius_m:
            # Calculate excess deviation
            deviation_distance = (distance_to_center * 1000) - geofence_radius_m
            
            # Prevent duplicate alerts (same alert within 5 minutes)
            alert_key = 'route_deviation'
            if not self._should_trigger_alert(alert_key, 300):
                return None
            
            return {
                'type': 'ROUTE_DEVIATION',
                'severity': 'HIGH' if deviation_distance > 200 else 'MEDIUM',
                'description': f'Vehicle deviated {deviation_distance:.1f}m from expected route',
                'latitude': current_lat,
                'longitude': current_lon,
                'deviation_meters': deviation_distance,
                'timestamp': current.get('timestamp'),
                'vehicle_id': self.vehicle_id
            }
        
        return None
    
    def detect_idle_behavior(self, data_points: List[Dict]) -> Optional[Dict]:
        """
        Detect stationary vehicle with engine likely running
        
        Algorithm:
        1. Calculate average speed over last 5 minutes
        2. If avg speed < 1 km/h AND GPS accuracy is good (engine on):
           - Trigger IDLE alert
        3. If idle > 30 minutes, escalate to CRITICAL
        
        Args:
            data_points: List of GPS measurements (last 5 minutes)
        
        Returns:
            Alert dict if idle behavior detected, None otherwise
        """
        
        if len(data_points) < 10:
            return None
        
        # Calculate average speed
        speeds = [p.get('speed', 0) for p in data_points if p.get('speed') is not None]
        if not speeds:
            return None
        
        avg_speed = sum(speeds) / len(speeds)
        max_speed = max(speeds)
        
        # If moving, not idle
        if avg_speed > 1.0:
            return None
        
        # Check GPS accuracy (indicates if device is powered on)
        accuracy_values = [p.get('accuracy', 100) for p in data_points]
        avg_accuracy = sum(accuracy_values) / len(accuracy_values)
        
        # If accuracy is poor (GPS weak), device might be off
        if avg_accuracy > 50:  # >50m accuracy suggests GPS module off
            return None
        
        # Calculate idle duration
        first_point = data_points[0]
        last_point = data_points[-1]
        
        try:
            start_time = datetime.fromisoformat(first_point.get('timestamp', ''))
            end_time = datetime.fromisoformat(last_point.get('timestamp', ''))
            idle_duration = (end_time - start_time).total_seconds() / 60
        except (ValueError, TypeError):
            idle_duration = len(data_points) / 60  # Estimate: 1 point/sec
        
        # Prevent duplicate alerts
        alert_key = f"idle_{int(idle_duration // 10) * 10}"  # Group by 10-min intervals
        if not self._should_trigger_alert(alert_key, 600):  # Allow 1 alert per 10 min
            return None
        
        # Determine severity
        if idle_duration > 30:
            severity = 'CRITICAL'
        elif idle_duration > 15:
            severity = 'HIGH'
        else:
            severity = 'MEDIUM'
        
        return {
            'type': 'IDLE_BEHAVIOR',
            'severity': severity,
            'description': f'Vehicle idle for {idle_duration:.1f} minutes at current location',
            'latitude': last_point.get('latitude'),
            'longitude': last_point.get('longitude'),
            'idle_minutes': idle_duration,
            'avg_speed_kmh': round(avg_speed, 2),
            'timestamp': last_point.get('timestamp'),
            'vehicle_id': self.vehicle_id
        }
    
    def detect_fuel_anomaly(self, data_points: List[Dict]) -> Optional[Dict]:
        """
        Detect abnormal fuel consumption patterns
        
        Algorithm:
        1. Calculate Fuel Consumption Index (FCI):
           FCI = Base_Consumption * Speed_Factor * Acceleration_Factor
           
        2. Speed_Factor = (actual_speed / optimal_speed) ^ 2
           - Higher speeds quadratically increase fuel consumption
           
        3. Acceleration_Factor = 1 + (peak_accel / max_safe_accel)
           - Harsh acceleration increases fuel consumption
           
        4. If FCI > Baseline * 1.2 (20% above baseline):
           - Trigger FUEL_ANOMALY alert
        
        Args:
            data_points: List of GPS measurements (last 5 minutes)
        
        Returns:
            Alert dict if anomaly detected, None otherwise
        """
        
        if len(data_points) < 15:  # Need at least ~15 seconds of data
            return None
        
        # Extract speed data
        speeds = [p.get('speed', 0) for p in data_points if p.get('speed') is not None]
        if len(speeds) < 5:
            return None
        
        # Baseline fuel consumption (L/100km) for typical mining vehicle
        baseline_consumption = self.config.get('baseline_fuel_consumption', 12.0)
        optimal_speed = self.config.get('optimal_speed_kmh', 60)
        max_safe_acceleration = self.config.get('max_safe_acceleration_mps2', 4.0)
        
        # Calculate average speed
        avg_speed = sum(speeds) / len(speeds)
        max_speed = max(speeds)
        
        # Skip if vehicle is idle (speed < 5 km/h)
        if avg_speed < 5:
            return None
        
        # Calculate acceleration variations
        accelerations = []
        for i in range(1, len(speeds)):
            # Estimate time difference (typically 1 second)
            delta_v = speeds[i] - speeds[i-1]
            acceleration = delta_v / 3.6  # Convert km/h/s to m/s²
            accelerations.append(abs(acceleration))
        
        if accelerations:
            max_acceleration = max(accelerations)
        else:
            max_acceleration = 0
        
        # Calculate Fuel Consumption Index (FCI)
        speed_factor = (avg_speed / optimal_speed) ** 2
        accel_factor = 1 + (max_acceleration / max_safe_acceleration)
        
        fci = baseline_consumption * speed_factor * accel_factor
        
        # Calculate excess consumption
        excess_percent = ((fci - baseline_consumption) / baseline_consumption) * 100
        
        # Trigger alert if consumption is 20%+ above baseline
        if excess_percent > 20:
            # Prevent duplicate alerts
            alert_key = 'fuel_anomaly'
            if not self._should_trigger_alert(alert_key, 300):
                return None
            
            # Determine cause
            causes = []
            if avg_speed > optimal_speed * 1.3:
                causes.append('excessive_speed')
            if max_acceleration > max_safe_acceleration * 1.2:
                causes.append('harsh_acceleration')
            if speed_factor > 1.5:
                causes.append('aggressive_driving')
            
            severity = 'HIGH' if excess_percent > 40 else 'MEDIUM'
            
            return {
                'type': 'FUEL_ANOMALY',
                'severity': severity,
                'description': f'Fuel consumption {excess_percent:.1f}% above baseline',
                'latitude': data_points[-1].get('latitude'),
                'longitude': data_points[-1].get('longitude'),
                'excess_percent': round(excess_percent, 1),
                'estimated_consumption': round(fci, 2),
                'baseline_consumption': baseline_consumption,
                'avg_speed_kmh': round(avg_speed, 2),
                'max_acceleration_mps2': round(max_acceleration, 2),
                'causes': causes,
                'timestamp': data_points[-1].get('timestamp'),
                'vehicle_id': self.vehicle_id
            }
        
        return None
    
    def _should_trigger_alert(self, alert_key: str, cooldown_seconds: int) -> bool:
        """
        Prevent alert fatigue by enforcing cooldown period
        
        Args:
            alert_key: Unique identifier for alert type
            cooldown_seconds: Minimum seconds between identical alerts
        
        Returns:
            True if alert should be triggered, False if in cooldown
        """
        
        now = datetime.utcnow()
        
        if alert_key not in self.last_alert:
            self.last_alert[alert_key] = now
            return True
        
        last_time = self.last_alert[alert_key]
        elapsed = (now - last_time).total_seconds()
        
        if elapsed < cooldown_seconds:
            return False
        
        self.last_alert[alert_key] = now
        return True
    
    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate great-circle distance between two points on Earth
        
        Args:
            lat1, lon1: First point (degrees)
            lat2, lon2: Second point (degrees)
        
        Returns:
            Distance in kilometers
        """
        
        R = 6371  # Earth radius in kilometers
        
        # Convert to radians
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        # Haversine formula
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c


# Test functions
def test_detection_algorithms():
    """Test detection algorithms with sample data"""
    
    config = {
        'baseline_fuel_consumption': 12.0,
        'optimal_speed_kmh': 60,
        'max_safe_acceleration_mps2': 4.0,
        'deviation_threshold_m': 50,
        'geofence': {
            'center_lat': 48.8566,
            'center_lon': 2.3522,
            'radius_km': 2.0,
            'type': 'circle'
        }
    }
    
    engine = DetectionEngine(vehicle_id='VEHICLE-001', config=config)
    
    # Test data: Normal driving
    normal_data = [
        {'latitude': 48.8566, 'longitude': 2.3522, 'speed': 60, 'timestamp': '2024-03-06T10:00:00'},
        {'latitude': 48.8567, 'longitude': 2.3523, 'speed': 62, 'timestamp': '2024-03-06T10:00:01'},
        {'latitude': 48.8568, 'longitude': 2.3524, 'speed': 61, 'timestamp': '2024-03-06T10:00:02'},
    ]
    
    print("Testing normal driving...")
    alert = engine.detect_route_deviation(normal_data)
    print(f"Route deviation alert: {alert}")
    
    # Test data: Idle behavior
    idle_data = [
        {'latitude': 48.8566, 'longitude': 2.3522, 'speed': 0, 'accuracy': 5, 'timestamp': '2024-03-06T10:00:00'},
    ] * 20  # 20 seconds of zero speed
    
    print("\nTesting idle behavior...")
    alert = engine.detect_idle_behavior(idle_data)
    print(f"Idle alert: {alert}")
    
    # Test data: Aggressive driving
    aggressive_data = [
        {'latitude': 48.8566, 'longitude': 2.3522, 'speed': 50, 'timestamp': '2024-03-06T10:00:00'},
        {'latitude': 48.8567, 'longitude': 2.3523, 'speed': 80, 'timestamp': '2024-03-06T10:00:01'},  # 30 km/h jump
        {'latitude': 48.8568, 'longitude': 2.3524, 'speed': 75, 'timestamp': '2024-03-06T10:00:02'},
    ] * 5
    
    print("\nTesting aggressive driving...")
    alert = engine.detect_fuel_anomaly(aggressive_data)
    print(f"Fuel anomaly alert: {alert}")


if __name__ == '__main__':
    test_detection_algorithms()
