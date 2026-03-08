"""
Fuel Consumption Anomaly Detector
==================================
Detects unusual fuel consumption patterns that indicate:
- Mechanical problems (bad injectors, transmission slipping)
- Fuel theft (siphoning)
- Driving behavior changes (aggressive acceleration)

Statistical Method: Z-Score Analysis
Z = (value - mean) / standard_deviation

Interpretation:
- Z = 0: Normal (at mean)
- Z = 1: 1 std dev above mean (84th percentile)
- Z = 2: 2 std dev above mean (97th percentile)
- Z = 2.5+: Anomaly (very unusual, top 1%)
"""

from typing import Optional, List
from statistics import mean, stdev
from collections import deque


class FuelAnomalyDetector:
    """
    Detect unusual fuel consumption using statistical analysis.
    
    Maintains rolling history of fuel consumption rates
    and flags readings that deviate significantly from baseline.
    """
    
    # Number of previous readings to track (30-day history)
    HISTORY_SIZE = 7 * 24  # 168 readings (1 per hour)
    
    # Z-score threshold for anomaly
    ANOMALY_THRESHOLD = 2.5  # 99th percentile
    
    # Minimum data points needed before anomaly detection
    MIN_HISTORY = 10
    
    def __init__(self):
        # Track consumption rate (L/km) over time
        self.consumption_history: deque = deque(
            maxlen=self.HISTORY_SIZE
        )
        self.last_alert_time: Optional[float] = None
        self.last_known_odometer = 0
        self.last_known_fuel = 0
    
    def _calculate_zscore(self, value: float, 
                         values: List[float]) -> Optional[float]:
        """
        Calculate z-score for value relative to list.
        
        Z = (x - mean) / std_dev
        
        Args:
            value: Current reading
            values: Historical values for comparison
            
        Returns:
            Z-score, or None if insufficient data
        """
        if len(values) < 2:
            return None
        
        try:
            avg = mean(values)
            std = stdev(values)
            
            if std == 0:
                return 0  # No variation in history
            
            return (value - avg) / std
        except:
            return None
    
    def update(self, odometer_km: float, fuel_consumed_liters: float):
        """
        Update with new odometer and fuel consumption reading.
        
        Args:
            odometer_km: Cumulative kilometers driven
            fuel_consumed_liters: Fuel consumed since last reading
        """
        if fuel_consumed_liters <= 0 or self.last_known_odometer == odometer_km:
            return
        
        # Calculate consumption rate (L/km)
        distance_km = odometer_km - self.last_known_odometer
        if distance_km > 0:
            consumption_rate = fuel_consumed_liters / distance_km
            self.consumption_history.append(consumption_rate)
        
        self.last_known_odometer = odometer_km
        self.last_known_fuel = fuel_consumed_liters
    
    def check(self, current_consumption_rate: float) -> Optional[dict]:
        """
        Check if current fuel consumption is anomalous.
        
        Args:
            current_consumption_rate: Current L/km consumption
            
        Returns:
            Alert dict if anomaly detected, None otherwise
        """
        # Need sufficient history
        if len(self.consumption_history) < self.MIN_HISTORY:
            return None
        
        # Calculate z-score
        history_list = list(self.consumption_history)
        zscore = self._calculate_zscore(current_consumption_rate, history_list)
        
        if zscore is None or abs(zscore) < self.ANOMALY_THRESHOLD:
            return None
        
        # Calculate statistics
        avg_consumption = mean(history_list)
        max_consumption = max(history_list)
        
        # Determine severity based on deviation
        if abs(zscore) > 4:
            severity = 'CRITICAL'
        elif abs(zscore) > 3:
            severity = 'HIGH'
        else:
            severity = 'MEDIUM'
        
        # Prevent alert spam (once per trip)
        import time
        now = time.time()
        if self.last_alert_time and (now - self.last_alert_time) < 3600:
            return None
        self.last_alert_time = now
        
        # Determine likely cause
        if current_consumption_rate > avg_consumption * 1.5:
            cause = "High fuel consumption (mechanical issue or aggressive driving)"
        else:
            cause = "Unusually low consumption (sensor malfunction?)"
        
        return {
            'type': 'FUEL_ANOMALY',
            'severity': severity,
            'zscore': round(zscore, 2),
            'consumption_lkm': round(current_consumption_rate, 2),
            'average_consumption_lkm': round(avg_consumption, 2),
            'max_consumption_lkm': round(max_consumption, 2),
            'cause': cause,
            'message': f'🚨 FUEL ANOMALY: {abs(zscore):.1f}σ from normal '
                      f'({current_consumption_rate:.2f} L/km vs '
                      f'{avg_consumption:.2f} avg)'
        }
