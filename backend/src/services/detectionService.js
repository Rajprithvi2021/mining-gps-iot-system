// src/services/detectionService.js
// Backend detection and alert processing service
// Receives GPS data from edge devices and performs Server-side validations

const logger = require('../utils/logger');

class DetectionService {
  /**
   * Analyze GPS data and generate alerts
   */
  static async analyzeGPSData(gpsData, vehicleGeofence) {
    const alerts = [];

    // Route deviation check
    const deviationAlert = this.checkRouteDeviation(gpsData, vehicleGeofence);
    if (deviationAlert) {
      alerts.push(deviationAlert);
    }

    // Idle behavior check
    const idleAlert = this.checkIdleBehavior(gpsData);
    if (idleAlert) {
      alerts.push(idleAlert);
    }

    // Fuel anomaly check
    const fuelAlert = this.checkFuelAnomaly(gpsData);
    if (fuelAlert) {
      alerts.push(fuelAlert);
    }

    return alerts;
  }

  /**
   * Check if vehicle deviates from expected route
   * Algorithm: Calculate distance to geofence center
   */
  static checkRouteDeviation(gpsData, geofence) {
    if (!geofence) return null;

    const distance = this.haversineDistance(
      gpsData.latitude,
      gpsData.longitude,
      geofence.center_lat,
      geofence.center_lon
    );

    const geofenceRadiusM = (geofence.radius_km || 2.0) * 1000;
    const deviationMeters = distance * 1000 - geofenceRadiusM;

    if (deviationMeters > 50) {
      // 50m threshold
      return {
        type: 'ROUTE_DEVIATION',
        severity: deviationMeters > 200 ? 'HIGH' : 'MEDIUM',
        description: `Vehicle deviated ${deviationMeters.toFixed(1)}m from expected route`,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        deviation_meters: deviationMeters,
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Check for idle vehicle behavior
   * Algorithm: Low speed + good GPS signal = engine running but stationary
   */
  static checkIdleBehavior(gpsData) {
    // This would normally check a buffer of recent points
    // For now, single point check for demonstration
    if (gpsData.speed > 1) return null; // Vehicle moving

    if (gpsData.accuracy > 50) return null; // GPS signal weak

    return {
      type: 'IDLE_BEHAVIOR',
      severity: 'MEDIUM',
      description: 'Vehicle idle at current location',
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      speed_kmh: gpsData.speed,
      timestamp: new Date(),
    };
  }

  /**
   * Check for fuel consumption anomaly
   * Algorithm: Excessive speed + harsh acceleration = high fuel consumption
   */
  static checkFuelAnomaly(gpsData) {
    const baselineFuel = 12.0; // L/100km
    const optimalSpeed = 60; // km/h

    if (gpsData.speed < optimalSpeed * 0.5) return null; // Low speed, normal consumption

    // Speed factor: (actual_speed / optimal_speed) ^ 2
    const speedFactor = Math.pow(gpsData.speed / optimalSpeed, 2);

    // Rough consumption estimate
    const estimatedConsumption = baselineFuel * speedFactor;

    if (estimatedConsumption > baselineFuel * 1.2) {
      const excessPercent = ((estimatedConsumption - baselineFuel) / baselineFuel) * 100;

      return {
        type: 'FUEL_ANOMALY',
        severity: excessPercent > 40 ? 'HIGH' : 'MEDIUM',
        description: `Estimated fuel consumption ${excessPercent.toFixed(1)}% above baseline`,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        speed_kmh: gpsData.speed,
        excess_percent: excessPercent,
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * Returns distance in kilometers
   */
  static haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km

    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  static toRad(degrees) {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Calculate analytics metrics from GPS data
   */
  static calculateAnalytics(gpsDataArray) {
    if (!gpsDataArray || gpsDataArray.length === 0) {
      return null;
    }

    const speeds = gpsDataArray
      .map((p) => p.speed || 0)
      .filter((s) => !isNaN(s));

    const totalDistance = this.calculateTotalDistance(gpsDataArray);

    return {
      total_distance_km: totalDistance.toFixed(2),
      avg_speed_kmh: (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(2),
      max_speed_kmh: Math.max(...speeds).toFixed(2),
      min_speed_kmh: Math.min(...speeds).toFixed(2),
      data_points: gpsDataArray.length,
      duration_minutes: (gpsDataArray.length / 60).toFixed(1),
    };
  }

  /**
   * Calculate total distance traveled from array of GPS points
   */
  static calculateTotalDistance(gpsDataArray) {
    let total = 0;

    for (let i = 1; i < gpsDataArray.length; i++) {
      const prev = gpsDataArray[i - 1];
      const curr = gpsDataArray[i];

      const distance = this.haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );

      total += distance;
    }

    return total;
  }

  /**
   * Estimate fuel consumption based on trip metrics
   */
  static estimateFuelConsumption(analytics) {
    const baselineConsumption = 12.0; // L/100km for mining vehicle
    const avgSpeed = parseFloat(analytics.avg_speed_kmh);

    // Consumption increases quadratically with speed
    const speedFactor = Math.pow(avgSpeed / 60, 2); // Assuming 60 km/h is optimal

    const estimatedFuel =
      (parseFloat(analytics.total_distance_km) / 100) *
      baselineConsumption *
      speedFactor;

    return {
      baseline_estimate_l: (parseFloat(analytics.total_distance_km) / 100 * baselineConsumption).toFixed(2),
      adjusted_estimate_l: estimatedFuel.toFixed(2),
      speed_efficiency_factor: speedFactor.toFixed(2),
      baseline_consumption_l_per_100km: baselineConsumption,
    };
  }
}

module.exports = DetectionService;
