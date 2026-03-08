/**
 * Fleet Analytics Service
 * ======================
 * Calculates KPIs, driver profiles, and maintenance predictions
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';
import { DailyMetrics, Vehicle } from '../types';

export class FleetAnalyticsService extends EventEmitter {
  private db: Pool;

  constructor(db: Pool) {
    super();
    this.db = db;
  }

  /**
   * Calculate daily metrics for all vehicles
   */
  async calculateDailyMetrics(): Promise<void> {
    try {
      const result = await this.db.query(`
        INSERT INTO daily_vehicle_metrics (
          time, vehicle_id, org_id, distance_km, fuel_consumed_liters,
          fuel_efficiency_km_per_liter, idle_minutes, harsh_acceleration_count,
          harsh_braking_count, route_deviation_count, avg_speed_kmh, 
          max_speed_kmh, num_trips
        )
        SELECT
          date_trunc('day', t.start_time),
          t.vehicle_id,
          t.org_id,
          COALESCE(SUM(t.distance_km), 0),
          COALESCE(SUM(t.fuel_consumed_liters), 0),
          CASE 
            WHEN SUM(t.fuel_consumed_liters) > 0 
            THEN SUM(t.distance_km) / SUM(t.fuel_consumed_liters)
            ELSE 0
          END,
          COALESCE(SUM((a.data->'duration_sec')::int), 0) / 60,
          COUNT(CASE WHEN a.anomaly_type = 'HARSH_ACCELERATION' THEN 1 END),
          COUNT(CASE WHEN a.anomaly_type = 'HARSH_BRAKING' THEN 1 END),
          COUNT(CASE WHEN a.anomaly_type = 'ROUTE_DEVIATION' THEN 1 END),
          COALESCE(AVG(g.speed_kmh), 0),
          COALESCE(MAX(g.speed_kmh), 0),
          COUNT(DISTINCT t.id)
        FROM trips t
        LEFT JOIN anomalies a ON t.vehicle_id = a.vehicle_id 
          AND a.timestamp >= t.start_time 
          AND a.timestamp <= COALESCE(t.end_time, NOW())
        LEFT JOIN gps_data g ON t.vehicle_id = g.vehicle_id
          AND g.time >= t.start_time
          AND g.time <= COALESCE(t.end_time, NOW())
        WHERE date_trunc('day', t.start_time) = date_trunc('day', NOW() - INTERVAL '1 day')
        GROUP BY date_trunc('day', t.start_time), t.vehicle_id, t.org_id
        ON CONFLICT (time, vehicle_id) DO UPDATE SET
          distance_km = EXCLUDED.distance_km,
          fuel_consumed_liters = EXCLUDED.fuel_consumed_liters,
          fuel_efficiency_km_per_liter = EXCLUDED.fuel_efficiency_km_per_liter
      `);

      console.log('✅ Daily metrics calculated');
      this.emit('metrics-calculated', { rowCount: result.rowCount });
    } catch (err) {
      console.error('Error calculating daily metrics:', err);
    }
  }

  /**
   * Calculate driver risk profiles
   */
  async calculateDriverProfiles(): Promise<void> {
    try {
      // Get all drivers with their vehicles
      const driversResult = await this.db.query(`
        SELECT DISTINCT d.id, d.name, dv.driver_id
        FROM drivers d
        JOIN driver_vehicle_assignments dv ON d.id = dv.driver_id
        WHERE dv.is_active = true
      `);

      for (const driver of driversResult.rows) {
        const metricsResult = await this.db.query(
          `
          SELECT
            COALESCE(SUM(harsh_acceleration_count), 0) as total_harsh_accel,
            COALESCE(SUM(harsh_braking_count), 0) as total_harsh_brake,
            COALESCE(SUM(distance_km), 0) as total_distance,
            COALESCE(AVG(idle_minutes), 0) as avg_idle,
            COUNT(*) as num_days
          FROM daily_vehicle_metrics dvm
          JOIN driver_vehicle_assignments dva ON dvm.vehicle_id = dva.vehicle_id
          WHERE dva.driver_id = $1
          AND dvm.time > NOW() - INTERVAL '30 days'
          AND dva.is_active = true
          `,
          [driver.id]
        );

        if (metricsResult.rows.length > 0) {
          const data = metricsResult.rows[0];

          // Calculate rates per 100km
          const harshAccelRate =
            data.total_distance > 0
              ? (data.total_harsh_accel / data.total_distance) * 100
              : 0;
          const harshBrakeRate =
            data.total_distance > 0
              ? (data.total_harsh_brake / data.total_distance) * 100
              : 0;
          const idlePercentage =
            (data.avg_idle / (24 * 60)) * 100;

          // Calculate risk score (0-100)
          const riskScore = Math.min(
            100,
            harshAccelRate * 5 + harshBrakeRate * 5 + idlePercentage * 0.5
          );

          // Determine training needs
          const trainingNeeds: string[] = [];
          if (harshAccelRate > 2) trainingNeeds.push('Acceleration control');
          if (harshBrakeRate > 2) trainingNeeds.push('Braking technique');
          if (idlePercentage > 20) trainingNeeds.push('Idle reduction');

          this.emit('driver-profile-updated', {
            driverId: driver.id,
            driverName: driver.name,
            riskScore: Math.round(riskScore),
            trainingNeeded: trainingNeeds,
          });
        }
      }

      console.log('✅ Driver profiles calculated');
    } catch (err) {
      console.error('Error calculating driver profiles:', err);
    }
  }

  /**
   * Predict maintenance needs
   */
  async predictiveMaintenance(): Promise<void> {
    try {
      const vehicles = await this.db.query(`
        SELECT id, vehicle_id FROM vehicles WHERE status = 'active'
      `);

      for (const vehicle of vehicles.rows) {
        const metricsResult = await this.db.query(
          `
          SELECT
            SUM(distance_km) as total_distance,
            SUM(harsh_acceleration_count + harsh_braking_count) as total_harsh_events,
            SUM(idle_minutes) as total_idle_minutes,
            COUNT(DISTINCT DATE(time)) as days_of_operation
          FROM daily_vehicle_metrics
          WHERE vehicle_id = $1
          AND time > NOW() - INTERVAL '90 days'
          `,
          [vehicle.id]
        );

        if (metricsResult.rows.length > 0) {
          const data = metricsResult.rows[0];

          // Prediction logic
          let predictedIssue = null;
          let confidence = 0;
          let daysTillFailure = 30;
          let action = null;

          // Tire wear prediction (based on harsh events)
          if (data.total_harsh_events > 50) {
            predictedIssue = 'Tire wear';
            confidence = Math.min(0.95, data.total_harsh_events / 100);
            daysTillFailure = Math.max(7, 30 - (data.total_harsh_events / 10));
            action = 'Schedule tire rotation';
          }

          // Oil change prediction (based on distance)
          if (data.total_distance > 10000) {
            predictedIssue = 'Oil change required';
            confidence = 0.9;
            daysTillFailure = 5;
            action = 'Schedule oil service';
          }

          // Transmission stress (based on harsh events + idle)
          if (data.total_harsh_events > 30 && data.total_idle_minutes > 500) {
            predictedIssue = 'Transmission stress';
            confidence = 0.8;
            daysTillFailure = 14;
            action = 'Conduct transmission check';
          }

          if (predictedIssue) {
            this.emit('maintenance-prediction', {
              vehicleId: vehicle.id,
              vehicleName: vehicle.vehicle_id,
              predictedIssue,
              confidence: Math.round(confidence * 100),
              daysTillFailure,
              recommendedAction: action,
            });
          }
        }
      }

      console.log('✅ Maintenance predictions generated');
    } catch (err) {
      console.error('Error predicting maintenance:', err);
    }
  }

  /**
   * Get fleet statistics
   */
  async getFleetStatistics(orgId: number): Promise<any> {
    try {
      const result = await this.db.query(
        `
        SELECT
          COUNT(v.id) as total_vehicles,
          COUNT(CASE WHEN vsl.is_active = true THEN 1 END) as active_vehicles,
          COALESCE(SUM(dvm.distance_km), 0) as total_distance,
          COUNT(a.id) as total_anomalies,
          COALESCE(AVG(dvm.fuel_efficiency_km_per_liter), 0) as avg_fuel_efficiency
        FROM vehicles v
        LEFT JOIN vehicle_status_latest vsl ON v.id = vsl.id
        LEFT JOIN daily_vehicle_metrics dvm ON v.id = dvm.vehicle_id
        LEFT JOIN anomalies a ON v.id = a.vehicle_id
        WHERE v.org_id = $1
        AND dvm.time > NOW() - INTERVAL '7 days'
        `,
        [orgId]
      );

      return result.rows[0];
    } catch (err) {
      console.error('Error fetching fleet statistics:', err);
      return null;
    }
  }

  /**
   * Get vehicle efficiency report
   */
  async getEfficiencyReport(vehicleId: number, days: number = 30): Promise<any> {
    try {
      const result = await this.db.query(
        `
        SELECT
          DATE(time) as date,
          distance_km,
          fuel_consumed_liters,
          fuel_efficiency_km_per_liter,
          harsh_acceleration_count,
          harsh_braking_count,
          idle_minutes,
          num_trips
        FROM daily_vehicle_metrics
        WHERE vehicle_id = $1
        AND time > NOW() - INTERVAL '${days} days'
        ORDER BY time DESC
        `,
        [vehicleId]
      );

      return result.rows;
    } catch (err) {
      console.error('Error fetching efficiency report:', err);
      return [];
    }
  }

  /**
   * Run all analytics (called daily)
   */
  async runDailyAnalytics(): Promise<void> {
    try {
      console.log('📊 Running daily analytics...');
      await this.calculateDailyMetrics();
      await this.calculateDriverProfiles();
      await this.predictiveMaintenance();
      console.log('✅ Daily analytics complete');
    } catch (err) {
      console.error('Error running daily analytics:', err);
    }
  }
}
