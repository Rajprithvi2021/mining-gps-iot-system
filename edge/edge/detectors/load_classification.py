"""
Load Classification
===================
Detect truck load state (empty/half/full) without mining company input.

Method: K-Means Clustering on acceleration/fuel consumption patterns
Training: Requires 100+ trips to establish baseline

Physics:
- Heavy truck responds differently to throttle (lower acceleration)
- Heavy truck consumes more fuel per km
- Empty truck can accelerate quickly (low inertia)
"""

from typing import Optional, List, Tuple
import math
from collections import deque
from dataclasses import dataclass


@dataclass
class TripSignature:
    """Characteristics of a single trip."""
    avg_acceleration: float
    max_acceleration: float
    avg_fuel_consumption: float  # L/km
    avg_speed: float


class LoadClassificationClusterer:
    """K-Means clustering for load state classification."""
    
    # Number of clusters (empty, half, full)
    NUM_CLUSTERS = 3
    
    # Cluster labels in order of load
    CLUSTER_NAMES = ['EMPTY', 'HALF_LOADED', 'FULL']
    
    # Minimum training trips
    MIN_TRAINING_TRIPS = 50
    
    def __init__(self):
        self.training_trips: List[TripSignature] = []
        self.centroids: List[List[float]] = None
        self.is_trained = False
        self.cluster_assignments = {}  # trip_id -> cluster
    
    def _distance(self, point: List[float], centroid: List[float]) -> float:
        """Euclidean distance between point and centroid."""
        return math.sqrt(sum((p - c)**2 for p, c in zip(point, centroid)))
    
    def _assign_clusters(self, points: List[List[float]]) -> List[int]:
        """Assign each point to nearest centroid."""
        assignments = []
        for point in points:
            distances = [self._distance(point, c) for c in self.centroids]
            assignments.append(distances.index(min(distances)))
        return assignments
    
    def _update_centroids(self, points: List[List[float]], 
                         assignments: List[int]) -> List[List[float]]:
        """Calculate new centroid positions."""
        new_centroids = []
        for cluster_id in range(self.NUM_CLUSTERS):
            cluster_points = [
                p for i, p in enumerate(points) 
                if assignments[i] == cluster_id
            ]
            if cluster_points:
                num_features = len(points[0])
                centroid = [
                    sum(p[f] for p in cluster_points) / len(cluster_points)
                    for f in range(num_features)
                ]
                new_centroids.append(centroid)
            else:
                # Keep old centroid if empty
                new_centroids.append(self.centroids[cluster_id])
        return new_centroids
    
    def train(self, trips: List[TripSignature], max_iterations: int = 100):
        """
        Train K-means clustering on trip data.
        
        Args:
            trips: List of TripSignature objects from historical trips
            max_iterations: Maximum K-means iterations
        """
        if len(trips) < self.MIN_TRAINING_TRIPS:
            print(f"⚠️ Only {len(trips)} trips; need {self.MIN_TRAINING_TRIPS} min")
            return
        
        self.training_trips = trips
        
        # Normalize features (0-1 scale)
        max_accel = max(t.max_acceleration for t in trips) or 1
        max_fuel = max(t.avg_fuel_consumption for t in trips) or 1
        max_speed = max(t.avg_speed for t in trips) or 1
        
        points = [
            [
                t.avg_acceleration / max_accel,
                t.max_acceleration / max_accel,
                t.avg_fuel_consumption / max_fuel,
                t.avg_speed / max_speed,
            ]
            for t in trips
        ]
        
        # Initialize centroids randomly (evenly spaced)
        self.centroids = [
            [i / self.NUM_CLUSTERS for i in range(len(points[0]))]
            for _ in range(self.NUM_CLUSTERS)
        ]
        
        # K-means iteration
        for iteration in range(max_iterations):
            # Assignment step
            assignments = self._assign_clusters(points)
            
            # Update step
            new_centroids = self._update_centroids(points, assignments)
            
            # Check convergence
            if self._centroids_converged(self.centroids, new_centroids):
                break
            
            self.centroids = new_centroids
        
        self.is_trained = True
        
        # Store assignments for analysis
        for trip_idx, cluster in enumerate(assignments):
            self.cluster_assignments[trip_idx] = cluster
        
        print(f"✅ Model trained on {len(trips)} trips ({iteration + 1} iterations)")
    
    def _centroids_converged(self, old: List[List[float]], 
                            new: List[List[float]], 
                            threshold: float = 0.001) -> bool:
        """Check if centroids have converged."""
        for o, n in zip(old, new):
            if self._distance(o, n) > threshold:
                return False
        return True
    
    def predict(self, trip: TripSignature) -> Tuple[str, float]:
        """
        Predict load state for a trip.
        
        Args:
            trip: Current TripSignature to classify
            
        Returns:
            Tuple of (load_state, confidence)
        """
        if not self.is_trained:
            return 'UNKNOWN', 0.0
        
        # Normalize to training scale
        max_accel = max(t.max_acceleration for t in self.training_trips) or 1
        max_fuel = max(t.avg_fuel_consumption for t in self.training_trips) or 1
        max_speed = max(t.avg_speed for t in self.training_trips) or 1
        
        point = [
            trip.avg_acceleration / max_accel,
            trip.max_acceleration / max_accel,
            trip.avg_fuel_consumption / max_fuel,
            trip.avg_speed / max_speed,
        ]
        
        # Find nearest centroid
        distances = [self._distance(point, c) for c in self.centroids]
        cluster_id = distances.index(min(distances))
        
        # Calculate confidence (inverse of distance)
        # Closer point = higher confidence
        max_distance = max(distances) if distances else 1
        confidence = 1.0 - (distances[cluster_id] / max_distance) if max_distance > 0 else 0.5
        confidence = max(0.0, min(1.0, confidence))
        
        load_state = self.CLUSTER_NAMES[cluster_id]
        
        return load_state, round(confidence, 2)
    
    def explain_classification(self, trip: TripSignature) -> dict:
        """
        Explain why a trip was classified a certain way.
        
        Returns:
            Dict with classification reasoning
        """
        load_state, confidence = self.predict(trip)
        
        if not self.is_trained:
            return {
                'status': 'not_trained',
                'message': 'Model needs more training data'
            }
        
        return {
            'load_state': load_state,
            'confidence': confidence,
            'reasoning': {
                'avg_acceleration': f"{trip.avg_acceleration:.2f} m/s²",
                'max_acceleration': f"{trip.max_acceleration:.2f} m/s²",
                'fuel_consumption': f"{trip.avg_fuel_consumption:.2f} L/km",
                'avg_speed': f"{trip.avg_speed:.1f} km/h",
            },
            'interpretation': {
                'EMPTY': 'Low fuel use, high acceleration = light truck',
                'HALF_LOADED': 'Medium fuel use, medium acceleration = partial load',
                'FULL': 'High fuel use, low acceleration = heavy load',
            }[load_state]
        }
