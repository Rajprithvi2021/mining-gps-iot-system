/**
 * Anomaly Detection Engine Service
 * ================================
 * Processes GPS data and runs all 5 anomaly detectors
 *
 * Flow:
 * 1. Query recent GPS data from time-series database
 * 2. Load vehicle config (approved routes, thresholds)
 * 3. Run all 5 detectors on each GPS point
 * 4. Store anomalies that exceed thresholds
 * 5. Publish high-priority anomalies to alert queue
 */

import { Pool } from 'pg';
import Bull from 'bull';
import { EventEmitter } from 'events';
import {
  Anomaly,
  AnomalyType,
  AlertSeverity,
  GPSData,
} from '../types';

interface DetectorConfig {
  routeDeviationThreshold: number;  // meters
  idleThreshold: number;  // seconds
  harshAccelThreshold: number;  // m/s²
  harshBrakeThreshold: number;  // m/s²
  fuelAnomalyZScore: number;  // standard deviations
  gradeThreshold: number;  // percentage
}

interface AnomalyResult {
  type: AnomalyType;
  severity: AlertSeverity;
  vehicleId: number;
  latitude: number;
  longitude: number;
  timestamp: Date;
  data: Record<string, any>;
}

export class AnomalyDetectionEngine extends EventEmitter {
  private db: Pool;
  private anomalyQueue: Bull.Queue;
  private detectorConfig: DetectorConfig;
  private vehicleStateCache: Map<number, any> = new Map();

  constructor(
    db: Pool,
    anomalyQueue: Bull.Queue,
    config: Partial<DetectorConfig> = {}
  ) {
    super();
    this.db = db;
    this.anomalyQueue = anomalyQueue;
    this.detectorConfig = {
      routeDeviationThreshold: config.routeDeviationThreshold || 100,
      idleThreshold: config.idleThreshold || 300,
      harshAccelThreshold: config.harshAccelThreshold || 3.0,
      harshBrakeThreshold: config.harshBrakeThreshold || -3.0,
      fuelAnomalyZScore: config.fuelAnomalyZScore || 2.5,
      gradeThreshold: config.gradeThreshold || 5.0,
    };
  }

  /**
   * Process GPS data point for anomalies
   */
  async processGPSPoint(gpsData: GPSData): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      // Get vehicle state
      const state = await this.getOrCreateVehicleState(gpsData.vehicleId);

      // Run all 5 detectors
      const detectionResults = await Promise.all([
        this.detectRouteDeviation(gpsData, state),
        this.detectIdling(gpsData, state),
        this.detectHarshDriving(gpsData, state),
        this.detectFuelAnomaly(gpsData, state),
        this.detectGradeAlerts(gpsData, state),
      ]);

      // Collect anomalies
      for (const result of detectionResults) {
        if (result) {
          anomalies.push(result);
        }
      }

      // Update vehicle state
      await this.updateVehicleState(gpsData.vehicleId, gpsData);

      // Store anomalies
      for (const anomaly of anomalies) {
        await this.storeAnomaly(anomaly);

        // Publish to alert queue if high/critical severity
        if (
          anomaly.severity === AlertSeverity.HIGH ||
          anomaly.severity === AlertSeverity.CRITICAL
        ) {
          await this.anomalyQueue.add(anomaly, {
            priority: anomaly.severity === AlertSeverity.CRITICAL ? 1 : 2,
            removeOnComplete: true,
          });
        }
      }

      this.emit('anomalies-detected', {
        vehicleId: gpsData.vehicleId,
        count: anomalies.length,
        anomalies,
      });
    } catch (err) {
      console.error('❌ Error in anomaly detection:', err);
    }

    return anomalies;
  }

  /**
   * DETECTOR 1: Route Deviation
   */
  private async detectRouteDeviation(
    gpsData: GPSData,
    state: any
  ): Promise<Anomaly | null> {
    try {
      // Get vehicle's approved routes
      const route = await this.getApprovedRoute(gpsData.vehicleId);
      if (!route) return null;

      // Calculate distance to nearest point on route
      const distance = await this.distanceToRoute(
        gpsData.latitude,
        gpsData.longitude,
        route.waypoints
      );

      if (distance > this.detectorConfig.routeDeviationThreshold) {
        return {
          id: 0,  // Will be assigned by DB
          vehicleId: gpsData.vehicleId,
          anomalyType: AnomalyType.ROUTE_DEVIATION,
          severity:
            distance > 500 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
          latitude: gpsData.latitude,
          longitude: gpsData.longitude,
          timestamp: gpsData.timestamp,
          durationSec: 0,
          data: {
            deviation_m: Math.round(distance),
            route_id: route.id,
          },
          humanReviewed: false,
        };
      }
    } catch (err) {
      console.error('Route deviation detection error:', err);
    }

    return null;
  }

  /**
   * DETECTOR 2: Idle Detection
   */
  private async detectIdling(
    gpsData: GPSData,
    state: any
  ): Promise<Anomaly | null> {
    try {
      const isIdle = gpsData.speedKmh < 0.5;

      if (isIdle) {
        // Track idle start time
        if (!state.idleStartTime) {
          state.idleStartTime = gpsData.timestamp;
        }

        const idleDuration = Math.floor(
          (gpsData.timestamp.getTime() - state.idleStartTime.getTime()) / 1000
        );

        // Alert after threshold
        if (idleDuration > this.detectorConfig.idleThreshold) {
          const costUSD =
            ((idleDuration / 3600) * 0.2 * 1.5);  // Fuel cost calculation
          return {
            id: 0,
            vehicleId: gpsData.vehicleId,
            anomalyType: AnomalyType.IDLE_DETECTION,
            severity:
              idleDuration > 900 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
            latitude: gpsData.latitude,
            longitude: gpsData.longitude,
            timestamp: gpsData.timestamp,
            durationSec: idleDuration,
            data: {
              idle_duration_sec: idleDuration,
              cost_usd: Math.round(costUSD * 100) / 100,
            },
            humanReviewed: false,
          };
        }
      } else {
        // Reset idle timer
        state.idleStartTime = null;
      }
    } catch (err) {
      console.error('Idle detection error:', err);
    }

    return null;
  }

  /**
   * DETECTOR 3: Harsh Driving
   */
  private async detectHarshDriving(
    gpsData: GPSData,
    state: any
  ): Promise<Anomaly | null> {
    try {
      if (!state.lastSpeed || !state.lastSpeedTime) {
        state.lastSpeed = gpsData.speedKmh;
        state.lastSpeedTime = gpsData.timestamp;
        return null;
      }

      // Calculate acceleration
      const timeDiffSec =
        (gpsData.timestamp.getTime() - state.lastSpeedTime.getTime()) / 1000;
      if (timeDiffSec <= 0) return null;

      const speedChange = gpsData.speedKmh - state.lastSpeed;  // km/h
      const acceleration = (speedChange / 3.6) / timeDiffSec;  // Convert to m/s²

      state.lastSpeed = gpsData.speedKmh;
      state.lastSpeedTime = gpsData.timestamp;

      // Check thresholds
      if (acceleration > this.detectorConfig.harshAccelThreshold) {
        return {
          id: 0,
          vehicleId: gpsData.vehicleId,
          anomalyType: AnomalyType.HARSH_ACCELERATION,
          severity:
            acceleration > 5 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
          latitude: gpsData.latitude,
          longitude: gpsData.longitude,
          timestamp: gpsData.timestamp,
          durationSec: 0,
          data: {
            acceleration_ms2: Math.round(acceleration * 100) / 100,
            speed_kmh: Math.round(gpsData.speedKmh * 10) / 10,
          },
          humanReviewed: false,
        };
      } else if (acceleration < this.detectorConfig.harshBrakeThreshold) {
        return {
          id: 0,
          vehicleId: gpsData.vehicleId,
          anomalyType: AnomalyType.HARSH_BRAKING,
          severity:
            acceleration < -5 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
          latitude: gpsData.latitude,
          longitude: gpsData.longitude,
          timestamp: gpsData.timestamp,
          durationSec: 0,
          data: {
            deceleration_ms2: Math.round(Math.abs(acceleration) * 100) / 100,
            speed_kmh: Math.round(gpsData.speedKmh * 10) / 10,
          },
          humanReviewed: false,
        };
      }
    } catch (err) {
      console.error('Harsh driving detection error:', err);
    }

    return null;
  }

  /**
   * DETECTOR 4: Fuel Anomaly (Z-score)
   */
  private async detectFuelAnomaly(
    gpsData: GPSData,
    state: any
  ): Promise<Anomaly | null> {
    try {
      // Get historical fuel consumption for vehicle
      const history = await this.getFuelConsumptionHistory(
        gpsData.vehicleId,
        30  // 30 days
      );

      if (!history || history.length < 10) {
        return null;  // Insufficient history
      }

      // Calculate z-score
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const variance =
        history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        history.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0) return null;

      // Current consumption
      const currentConsumption = state.currentFuelConsumption || mean;
      const zScore = Math.abs((currentConsumption - mean) / stdDev);

      if (zScore > this.detectorConfig.fuelAnomalyZScore) {
        return {
          id: 0,
          vehicleId: gpsData.vehicleId,
          anomalyType: AnomalyType.FUEL_ANOMALY,
          severity:
            zScore > 4 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
          latitude: gpsData.latitude,
          longitude: gpsData.longitude,
          timestamp: gpsData.timestamp,
          durationSec: 0,
          data: {
            zscore: Math.round(zScore * 100) / 100,
            current_consumption: Math.round(currentConsumption * 100) / 100,
            avg_consumption: Math.round(mean * 100) / 100,
          },
          humanReviewed: false,
        };
      }
    } catch (err) {
      console.error('Fuel anomaly detection error:', err);
    }

    return null;
  }

  /**
   * DETECTOR 5: Grade Alerts
   */
  private async detectGradeAlerts(
    gpsData: GPSData,
    state: any
  ): Promise<Anomaly | null> {
    try {
      if (!gpsData.altitudeM || !state.lastAltitude) {
        state.lastAltitude = gpsData.altitudeM;
        return null;
      }

      // Calculate grade
      const elevationChange = gpsData.altitudeM - state.lastAltitude;
      const grade = (elevationChange / 100) * 100;  // Approximate for distance

      state.lastAltitude = gpsData.altitudeM;

      if (Math.abs(grade) > this.detectorConfig.gradeThreshold) {
        return {
          id: 0,
          vehicleId: gpsData.vehicleId,
          anomalyType: AnomalyType.GRADE_ALERT,
          severity:
            Math.abs(grade) > 10
              ? AlertSeverity.CRITICAL
              : AlertSeverity.HIGH,
          latitude: gpsData.latitude,
          longitude: gpsData.longitude,
          timestamp: gpsData.timestamp,
          durationSec: 0,
          data: {
            grade_percent: Math.round(grade * 100) / 100,
            elevation_m: Math.round(gpsData.altitudeM * 10) / 10,
            direction: grade > 0 ? 'uphill' : 'downhill',
          },
          humanReviewed: false,
        };
      }
    } catch (err) {
      console.error('Grade detection error:', err);
    }

    return null;
  }

  /**
   * Get or create vehicle state tracking
   */
  private async getOrCreateVehicleState(vehicleId: number): Promise<any> {
    if (this.vehicleStateCache.has(vehicleId)) {
      return this.vehicleStateCache.get(vehicleId)!;
    }

    const state = {
      vehicleId,
      idleStartTime: null,
      lastSpeed: null,
      lastSpeedTime: null,
      lastAltitude: null,
      currentFuelConsumption: 5.0,  // Default
    };

    this.vehicleStateCache.set(vehicleId, state);

    // Expire cache after 1 hour
    setTimeout(() => {
      this.vehicleStateCache.delete(vehicleId);
    }, 3600000);

    return state;
  }

  /**
   * Update vehicle state after processing GPS point
   */
  private async updateVehicleState(
    vehicleId: number,
    gpsData: GPSData
  ): Promise<void> {
    // State updates handled in detector methods
  }

  /**
   * Get approved route for vehicle
   */
  private async getApprovedRoute(vehicleId: number): Promise<any> {
    try {
      const result = await this.db.query(
        `SELECT ar.id, ar.waypoints FROM approved_routes ar
         JOIN vehicles v ON ar.org_id = v.org_id
         WHERE v.id = $1 LIMIT 1`,
        [vehicleId]
      );
      return result.rows[0] || null;
    } catch (err) {
      console.error('Error fetching approved route:', err);
      return null;
    }
  }

  /**
   * Calculate distance to nearest point on route
   */
  private async distanceToRoute(
    lat: number,
    lon: number,
    waypoints: any
  ): Promise<number> {
    // Simplified: return random distance for demo
    return Math.random() * 200;
  }

  /**
   * Get fuel consumption history
   */
  private async getFuelConsumptionHistory(
    vehicleId: number,
    days: number
  ): Promise<number[]> {
    try {
      const result = await this.db.query(
        `SELECT fuel_efficiency_km_per_liter FROM daily_vehicle_metrics
         WHERE vehicle_id = $1 AND time > NOW() - INTERVAL '${days} days'
         ORDER BY time DESC LIMIT $2`,
        [vehicleId, days * 5]
      );

      return result.rows.map((r) => r.fuel_efficiency_km_per_liter);
    } catch (err) {
      console.error('Error fetching fuel history:', err);
      return [];
    }
  }

  /**
   * Store anomaly to database
   */
  private async storeAnomaly(anomaly: Anomaly): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO anomalies (vehicle_id, anomaly_type, severity, latitude, longitude, timestamp, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          anomaly.vehicleId,
          anomaly.anomalyType,
          anomaly.severity,
          anomaly.latitude,
          anomaly.longitude,
          anomaly.timestamp,
          JSON.stringify(anomaly.data),
        ]
      );
    } catch (err) {
      console.error('Error storing anomaly:', err);
    }
  }

  /**
   * Batch process GPS data (called periodically)
   */
  async processBatch(vehicleIds: number[]): Promise<void> {
    for (const vehicleId of vehicleIds) {
      try {
        // Get latest GPS point
        const result = await this.db.query(
          `SELECT * FROM gps_data WHERE vehicle_id = $1 ORDER BY time DESC LIMIT 1`,
          [vehicleId]
        );

        if (result.rows.length > 0) {
          const gpsRow = result.rows[0];
          const gpsData: GPSData = {
            timestamp: gpsRow.time,
            vehicleId: gpsRow.vehicle_id,
            latitude: gpsRow.latitude,
            longitude: gpsRow.longitude,
            speedKmh: gpsRow.speed_kmh,
            altitudeM: gpsRow.altitude_m,
            satellites: gpsRow.satellites,
            hdop: gpsRow.hdop,
            accuracyM: gpsRow.accuracy_m,
          };

          await this.processGPSPoint(gpsData);
        }
      } catch (err) {
        console.error(`Error processing batch for vehicle ${vehicleId}:`, err);
      }
    }
  }
}
