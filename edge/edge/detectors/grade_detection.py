"""
Grade/Slope Detection
=====================
Detects steep grades and monitors for safety issues when combined with:
- Heavy loads (truck fully loaded)
- Harsh driving (which is dangerous on slopes)
- Excessive acceleration on inclines

Mining Safety: Truck brakes can overheat on long downhill grades
"""

from typing import Optional
from datetime import datetime


class GradeDetector:
    """Detect steep grades and assess risk factors."""
    
    # Grade thresholds (percentage)
    MODERATE_GRADE = 3.0      # 3% slope
    STEEP_GRADE = 5.0         # 5% slope
    VERY_STEEP_GRADE = 8.0    # 8% slope
    
    # Risk combinations
    HARSH_ACCEL_ON_GRADE_LIMIT = 3.0     # Limit for harsh accel % on slope
    HEAVY_LOAD_THRESHOLD = 85.0           # Load % of capacity
    
    def __init__(self):
        self.last_elevation = None
        self.last_alert_time: Optional[datetime] = None
        self.distance_on_grade = 0
    
    def _calculate_grade(self, elevation_change_m: float, 
                        horizontal_distance_m: float) -> float:
        """
        Calculate grade percentage.
        
        Grade = (elevation / distance) × 100
        
        Example:
        - 100m elevation over 2000m distance = 5% grade
        
        Args:
            elevation_change_m: Height change (meters)
            horizontal_distance_m: Horizontal distance (meters)
            
        Returns:
            Grade as percentage (positive = uphill, negative = downhill)
        """
        if horizontal_distance_m == 0:
            return 0
        
        grade = (elevation_change_m / horizontal_distance_m) * 100
        return grade
    
    def check(self, current_elevation_m: float,
              distance_traveled_m: float,
              is_heavy_load: bool = False,
              harsh_events_count: int = 0,
              current_speed_kmh: float = 0) -> Optional[dict]:
        """
        Check for grade-related safety concerns.
        
        Args:
            current_elevation_m: Current altitude (meters)
            distance_traveled_m: Distance along route (meters)
            is_heavy_load: Whether truck is heavily loaded
            harsh_events_count: Number of harsh acceleration events recently
            current_speed_kmh: Current speed (for impact assessment)
            
        Returns:
            Alert dict if safety concern detected, None otherwise
        """
        if self.last_elevation is None:
            self.last_elevation = current_elevation_m
            return None
        
        # Calculate current grade
        elevation_change = current_elevation_m - self.last_elevation
        grade = self._calculate_grade(elevation_change, distance_traveled_m)
        
        self.last_elevation = current_elevation_m
        
        # Check for steep grades combined with risk factors
        if abs(grade) > self.STEEP_GRADE:
            severity = 'MEDIUM'
            warnings = []
            
            # Downhill risks (overheating brakes)
            if elevation_change < -5:
                warnings.append("Downhill - brake overheating risk")
                severity = 'HIGH'
                
                # Check for excessive speed on downhill
                if current_speed_kmh > 60:
                    warnings.append("Excessive speed on steep downhill")
                    severity = 'CRITICAL'
            
            # Uphill risks (transmission stress)
            elif elevation_change > 5:
                if is_heavy_load:
                    warnings.append("Heavy load on uphill - transmission stress")
                    severity = 'HIGH' if severity == 'MEDIUM' else severity
                
                # Harsh acceleration on uphill
                if harsh_events_count > 2:
                    warnings.append("Harsh acceleration on incline")
                    severity = 'CRITICAL'
            
            # Very steep grades always merit alert
            if abs(grade) > self.VERY_STEEP_GRADE:
                severity = 'HIGH' if severity == 'MEDIUM' else 'CRITICAL'
            
            # Prevent alert spam (once per 5 minutes)
            now = datetime.now()
            if self.last_alert_time and \
               (now - self.last_alert_time).total_seconds() < 300:
                return None
            
            self.last_alert_time = now
            
            return {
                'type': 'GRADE_ALERT',
                'severity': severity,
                'grade_percent': round(grade, 1),
                'elevation_m': round(current_elevation_m, 1),
                'is_heavy_load': is_heavy_load,
                'warnings': warnings,
                'message': f'⚠️ GRADE: {abs(grade):.1f}% '
                          f'{"↑ uphill" if grade > 0 else "↓ downhill"} '
                          f'| {", ".join(warnings) if warnings else "Monitor brakes"}'
            }
        
        return None
