"""
Route Deviation Detector
========================
Detects when vehicle deviates from approved mining routes.

Algorithm: Point-to-line distance (Haversine) for geodetic accuracy
Threshold: 100 meters deviation triggers alert
"""

import math
from typing import List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class GeoPoint:
    """Geographic coordinate."""
    latitude: float
    longitude: float


class RouteDeviationDetector:
    """Detect when vehicle goes off approved route."""
    
    # Earth radius in kilometers
    EARTH_RADIUS_KM = 6371.0
    
    # Maximum deviation before alert (meters)
    MAX_DEVIATION_M = 100.0
    
    def __init__(self, approved_route: List[Tuple[float, float]]):
        """
        Initialize with approved route coordinates.
        
        Args:
            approved_route: List of (latitude, longitude) tuples
                           representing approved mining route
        """
        self.route_points = [GeoPoint(lat, lon) for lat, lon in approved_route]
        self.last_alert_time = None
    
    def _haversine_distance(self, p1: GeoPoint, p2: GeoPoint) -> float:
        """
        Calculate great-circle distance between two points.
        
        Formula: d = 2R * arcsin(sqrt(sin²(Δφ/2) + cos(φ1)*cos(φ2)*sin²(Δλ/2)))
        
        Args:
            p1, p2: GeoPoint objects
            
        Returns:
            Distance in meters
        """
        lat1, lon1 = math.radians(p1.latitude), math.radians(p1.longitude)
        lat2, lon2 = math.radians(p2.latitude), math.radians(p2.longitude)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return self.EARTH_RADIUS_KM * c * 1000  # Convert to meters
    
    def _point_to_segment_distance(self, point: GeoPoint, 
                                   seg_start: GeoPoint, 
                                   seg_end: GeoPoint) -> float:
        """
        Calculate perpendicular distance from point to line segment.
        
        Uses vector projection: closest point on segment to given point.
        """
        # Treat as flat for short distances (mining site area ~5km²)
        px = point.latitude
        py = point.longitude
        
        x1 = seg_start.latitude
        y1 = seg_start.longitude
        x2 = seg_end.latitude
        y2 = seg_end.longitude
        
        # Vector from segment start to point
        dx = x2 - x1
        dy = y2 - y1
        
        if dx == 0 and dy == 0:
            # Degenerate segment, return distance to start
            return self._haversine_distance(point, seg_start)
        
        # Parameter t for projection
        t = max(0, min(1, ((px - x1)*dx + (py - y1)*dy) / (dx*dx + dy*dy)))
        
        # Closest point on segment
        closest = GeoPoint(x1 + t*dx, y1 + t*dy)
        
        return self._haversine_distance(point, closest)
    
    def check(self, current_position: Tuple[float, float]) -> Optional[dict]:
        """
        Check if vehicle is on approved route.
        
        Args:
            current_position: (latitude, longitude) tuple
            
        Returns:
            Alert dict if deviation detected, None otherwise
        """
        point = GeoPoint(current_position[0], current_position[1])
        
        if not self.route_points or len(self.route_points) < 2:
            return None
        
        # Find minimum distance to route
        min_distance = float('inf')
        
        for i in range(len(self.route_points) - 1):
            segment_distance = self._point_to_segment_distance(
                point, 
                self.route_points[i], 
                self.route_points[i + 1]
            )
            min_distance = min(min_distance, segment_distance)
        
        # Check if deviation exceeds threshold
        if min_distance > self.MAX_DEVIATION_M:
            return {
                'type': 'ROUTE_DEVIATION',
                'severity': 'HIGH' if min_distance > 200 else 'MEDIUM',
                'deviation_m': min_distance,
                'latitude': point.latitude,
                'longitude': point.longitude,
                'message': f'❌ Deviation: {min_distance:.0f}m off route'
            }
        
        return None
