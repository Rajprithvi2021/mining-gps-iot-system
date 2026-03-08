"""
Idle Detection
==============
Detects when vehicle engine is running but not moving (wasting fuel).

Alert Levels:
- >1 minute: WARNING (minor efficiency issue)
- >5 minutes: ALERT (significant fuel waste)
- >15 minutes: CRITICAL (potential mechanical issue)
"""

from datetime import datetime, timedelta
from typing import Optional


class IdleDetector:
    """Detect excessive engine idling."""
    
    # Idle thresholds
    WARN_THRESHOLD_SEC = 60      # 1 minute
    ALERT_THRESHOLD_SEC = 300    # 5 minutes
    CRITICAL_THRESHOLD_SEC = 900 # 15 minutes
    
    # Fuel consumption while idle
    IDLE_FUEL_LITERS_PER_HOUR = 0.2
    FUEL_PRICE_PER_LITER = 1.50
    
    # Consider vehicle idle if speed < threshold
    IDLE_SPEED_THRESHOLD_KPH = 0.5
    
    def __init__(self):
        self.idle_start_time: Optional[datetime] = None
        self.last_alert_time: Optional[datetime] = None
    
    def check(self, speed_kmh: float, is_engine_on: bool = True) -> Optional[dict]:
        """
        Check for excessive idling.
        
        Args:
            speed_kmh: Current speed in km/h
            is_engine_on: Whether engine is running
            
        Returns:
            Alert dict if idle threshold exceeded, None otherwise
        """
        now = datetime.now()
        is_idle = is_engine_on and speed_kmh < self.IDLE_SPEED_THRESHOLD_KPH
        
        if is_idle:
            if self.idle_start_time is None:
                # Start tracking idle
                self.idle_start_time = now
                return None
            
            # Calculate idle duration
            idle_duration = (now - self.idle_start_time).total_seconds()
            
            # Check thresholds
            if idle_duration >= self.CRITICAL_THRESHOLD_SEC:
                severity = 'CRITICAL'
            elif idle_duration >= self.ALERT_THRESHOLD_SEC:
                severity = 'HIGH'
            elif idle_duration >= self.WARN_THRESHOLD_SEC:
                severity = 'MEDIUM'
            else:
                return None
            
            # Don't spam alerts (only every 60 seconds)
            if self.last_alert_time and \
               (now - self.last_alert_time).total_seconds() < 60:
                return None
            
            self.last_alert_time = now
            
            # Calculate cost
            hours_idle = idle_duration / 3600.0
            fuel_cost = (self.IDLE_FUEL_LITERS_PER_HOUR * 
                        hours_idle * 
                        self.FUEL_PRICE_PER_LITER)
            
            return {
                'type': 'IDLE_DETECTION',
                'severity': severity,
                'duration_sec': int(idle_duration),
                'cost_usd': round(fuel_cost, 2),
                'message': f'⚠️ IDLE: {int(idle_duration/60)}m '
                          f'(Cost: ${fuel_cost:.2f})'
            }
        
        else:
            # Vehicle is moving or engine off, reset idle tracking
            if self.idle_start_time is not None:
                idle_duration = (now - self.idle_start_time).total_seconds()
                if idle_duration >= self.WARN_THRESHOLD_SEC:
                    # Log for analytics
                    pass
            
            self.idle_start_time = None
        
        return None
