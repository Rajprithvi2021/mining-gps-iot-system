"""
Harsh Driving Detection
=======================
Detects harsh acceleration/braking that indicate unsafe driving or mechanical wear.

Physics Background:
- Normal acceleration: 0.5-1.5 m/s² (gentle)
- Harsh acceleration: >3 m/s² (aggressive)
- Normal braking: -1 to -2 m/s² (moderate)
- Harsh braking: <-3 m/s² (emergency-level)

Consequences:
- Tire wear increases exponentially with harsh acceleration
- Transmission stress (especially under load)
- Increased fuel consumption
- Safety risk
"""

from typing import Optional, List
from collections import deque
from datetime import datetime, timedelta


class HarshDrivingDetector:
    """Detect harsh acceleration and braking events."""
    
    # Acceleration thresholds (m/s²)
    HARSH_ACCEL_THRESHOLD = 3.0    # >3 m/s² = harsh acceleration
    HARSH_DECEL_THRESHOLD = -3.0   # <-3 m/s² = harsh braking
    
    # Rolling window for smoothing (number of readings)
    WINDOW_SIZE = 5
    
    # Time interval between GPS readings (for unit conversion)
    GPS_INTERVAL_SEC = 1.0
    
    def __init__(self):
        # Keep rolling history of speeds for smoothing
        self.speed_history: deque = deque(maxlen=self.WINDOW_SIZE)
        self.time_history: deque = deque(maxlen=self.WINDOW_SIZE)
        self.last_alert_time: Optional[datetime] = None
    
    def _calculate_acceleration(self, speed1_kmh: float, 
                                speed2_kmh: float,
                                time_diff_sec: float) -> float:
        """
        Calculate acceleration from speed change.
        
        Physics: a = Δv / Δt
        Converts from km/h to m/s: v(m/s) = v(km/h) / 3.6
        
        Args:
            speed1_kmh: Previous speed (km/h)
            speed2_kmh: Current speed (km/h)
            time_diff_sec: Time between measurements (seconds)
            
        Returns:
            Acceleration in m/s²
        """
        if time_diff_sec <= 0:
            return 0
        
        # Convert speeds to m/s
        speed1_ms = speed1_kmh / 3.6
        speed2_ms = speed2_kmh / 3.6
        
        # Calculate acceleration
        acceleration = (speed2_ms - speed1_ms) / time_diff_sec
        
        return acceleration
    
    def check(self, current_speed_kmh: float, 
              current_time: Optional[datetime] = None) -> Optional[dict]:
        """
        Check for harsh acceleration or braking.
        
        Args:
            current_speed_kmh: Current vehicle speed (km/h)
            current_time: Timestamp of reading (default: now)
            
        Returns:
            Alert dict if harsh driving detected, None otherwise
        """
        if current_time is None:
            current_time = datetime.now()
        
        self.speed_history.append(current_speed_kmh)
        self.time_history.append(current_time)
        
        # Need at least 2 points to calculate acceleration
        if len(self.speed_history) < 2:
            return None
        
        # Use smoothed acceleration (over last few seconds)
        prev_speed = self.speed_history[-2]
        prev_time = self.time_history[-2]
        
        time_diff = (current_time - prev_time).total_seconds()
        if time_diff <= 0:
            return None
        
        acceleration = self._calculate_acceleration(
            prev_speed, current_speed_kmh, time_diff
        )
        
        # Determine if harsh
        if acceleration > self.HARSH_ACCEL_THRESHOLD:
            severity = 'HIGH' if acceleration > 5 else 'MEDIUM'
            event_type = 'HARSH_ACCELERATION'
            
        elif acceleration < self.HARSH_DECEL_THRESHOLD:
            severity = 'HIGH' if acceleration < -5 else 'MEDIUM'
            event_type = 'HARSH_BRAKING'
            
        else:
            return None
        
        # Prevent alert spam (once per 30 seconds per type)
        now = datetime.now()
        if self.last_alert_time and \
           (now - self.last_alert_time).total_seconds() < 30:
            return None
        
        self.last_alert_time = now
        
        return {
            'type': event_type,
            'severity': severity,
            'acceleration_ms2': round(acceleration, 2),
            'speed_kmh': round(current_speed_kmh, 1),
            'message': f'⚠️ {event_type}: {abs(acceleration):.1f}m/s² '
                      f'at {current_speed_kmh:.0f} km/h'
        }
