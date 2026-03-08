// Analytics Service - Comprehensive reporting and insights
const pool = require('../utils/database');
const logger = require('../utils/logger');

class AnalyticsService {
  /**
   * Get fuel efficiency report for vehicle fleet
   * Returns: Efficiency metrics, trends, and alerts
   */
  static async getFleetFuelAnalytics(timeRange = '7days', vehicleId = null) {
    try {
      let query = `
        SELECT 
          vehicle_id,
          AVG(avg_consumption_l_per_km) as avg_consumption,
          MAX(avg_consumption_l_per_km) as max_consumption,
          MIN(avg_consumption_l_per_km) as min_consumption,
          COUNT(*) as trip_count,
          SUM(total_fuel_liters) as total_fuel,
          SUM(cost_inr) as total_cost,
          AVG(cost_inr) as avg_trip_cost
        FROM fuel_consumption_records
        WHERE created_at > NOW() - INTERVAL '${timeRange}'
      `;
      
      const params = [];
      
      if (vehicleId) {
        query += ` AND vehicle_id = $${params.length + 1}`;
        params.push(vehicleId);
      }
      
      query += ` GROUP BY vehicle_id ORDER BY total_cost DESC`;
      
      const result = await pool.query(query, params);
      
      return {
        success: true,
        analytics: result.rows,
        summary: {
          total_vehicles: result.rows.length,
          total_fuel: result.rows.reduce((sum, row) => sum + parseFloat(row.total_fuel || 0), 0),
          total_cost: result.rows.reduce((sum, row) => sum + parseFloat(row.total_cost || 0), 0),
          avg_efficiency: result.rows.reduce((sum, row) => sum + parseFloat(row.avg_consumption || 0), 0) / result.rows.length
        }
      };
    } catch (error) {
      logger.error('Error getting fuel analytics:', error);
      throw error;
    }
  }

  /**
   * Get driver performance scorecard
   */
  static async getDriverPerformance(driverId, timeRange = '30days') {
    try {
      // Get fuel efficiency score (lower is better, baseline 8.5 L/km)
      const fuelQuery = `
        SELECT 
          AVG(avg_consumption_l_per_km) as avg_consumption,
          COUNT(*) as trips
        FROM fuel_consumption_records fcr
        JOIN vehicles v ON fcr.vehicle_id = v.id
        WHERE v.driver_id = $1
        AND fcr.created_at > NOW() - INTERVAL '${timeRange}'
      `;
      
      // Get idle efficiency score
      const idleQuery = `
        SELECT 
          COUNT(*) as idle_sessions,
          AVG(duration_minutes) as avg_idle_duration,
          SUM(fuel_wasted_liters) as total_idle_fuel
        FROM idle_sessions
        WHERE vehicle_id IN (
          SELECT id FROM vehicles WHERE driver_id = $1
        )
        AND created_at > NOW() - INTERVAL '${timeRange}'
      `;
      
      // Get deviation incidents
      const deviationQuery = `
        SELECT 
          COUNT(*) as deviation_count
        FROM alerts
        WHERE vehicle_id IN (
          SELECT id FROM vehicles WHERE driver_id = $1
        )
        AND alert_type = 'route_deviation'
        AND created_at > NOW() - INTERVAL '${timeRange}'
      `;
      
      const [fuelResult, idleResult, deviationResult] = await Promise.all([
        pool.query(fuelQuery, [driverId]),
        pool.query(idleQuery, [driverId]),
        pool.query(deviationQuery, [driverId])
      ]);
      
      // Calculate score (0-100, higher is better)
      const fuelScore = Math.max(0, 100 - (fuelResult.rows[0]?.avg_consumption || 0) * 5);
      const idleScore = Math.max(0, 100 - (idleResult.rows[0]?.total_idle_fuel || 0) / 10);
      const safetyScore = Math.max(0, 100 - (deviationResult.rows[0]?.deviation_count || 0) * 5);
      
      const overallScore = (fuelScore + idleScore + safetyScore) / 3;
      
      return {
        success: true,
        driver_id: driverId,
        scores: {
          fuel_efficiency_score: Math.round(fuelScore),
          idle_efficiency_score: Math.round(idleScore),
          safety_score: Math.round(safetyScore),
          overall_score: Math.round(overallScore)
        },
        metrics: {
          avg_consumption_l_per_km: fuelResult.rows[0]?.avg_consumption || 0,
          total_trips: fuelResult.rows[0]?.trips || 0,
          total_idle_fuel_wasted: idleResult.rows[0]?.total_idle_fuel || 0,
          deviation_incidents: deviationResult.rows[0]?.deviation_count || 0
        }
      };
    } catch (error) {
      logger.error('Error getting driver performance:', error);
      throw error;
    }
  }

  /**
   * Predictive alerts - vehicles needing maintenance
   */
  static async getMaintenancePredictions() {
    try {
      const query = `
        SELECT 
          vehicle_id,
          name,
          AVG(fuel_consumed_liters / NULLIF(distance_km, 0)) as avg_fuel_per_km,
          COUNT(*) as recent_trips,
          MAX(created_at) as last_trip
        FROM fuel_consumption_records fcr
        JOIN vehicles v ON fcr.vehicle_id = v.id
        WHERE fcr.created_at > NOW() - INTERVAL '14 days'
        GROUP BY vehicle_id, name
        HAVING AVG(fuel_consumed_liters / NULLIF(distance_km, 0)) > 10
        ORDER BY avg_fuel_per_km DESC
      `;
      
      const result = await pool.query(query);
      
      return {
        success: true,
        vehicles_needing_service: result.rows.map(row => ({
          vehicle_id: row.vehicle_id,
          name: row.name,
          fuel_efficiency_degradation: row.avg_fuel_per_km,
          recommendation: 'Schedule maintenance - fuel efficiency degraded',
          urgency: row.avg_fuel_per_km > 12 ? 'high' : 'medium'
        }))
      };
    } catch (error) {
      logger.error('Error getting maintenance predictions:', error);
      throw error;
    }
  }

  /**
   * Trip cost breakdown
   */
  static async getTripAnalysis(tripId) {
    try {
      const query = `
        SELECT 
          *,
          (total_fuel_liters * 100) as total_cost_inr,
          (base_consumption + acceleration_consumption + extra_distance_consumption + idle_consumption) as total_component_fuel
        FROM fuel_consumption_records
        WHERE id = $1
      `;
      
      const result = await pool.query(query, [tripId]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Trip not found' };
      }
      
      const trip = result.rows[0];
      
      return {
        success: true,
        trip_analysis: {
          trip_id: trip.id,
          vehicle: trip.vehicle_id,
          distance_km: trip.distance_km,
          total_fuel_liters: trip.total_fuel_liters,
          total_cost_inr: Math.round(trip.total_fuel_liters * 100),
          
          breakdown: {
            base_consumption: {
              liters: trip.base_consumption,
              percent: Math.round((trip.base_consumption / trip.total_fuel_liters) * 100),
              cost_inr: Math.round(trip.base_consumption * 100)
            },
            acceleration: {
              liters: trip.acceleration_consumption,
              percent: Math.round((trip.acceleration_consumption / trip.total_fuel_liters) * 100),
              cost_inr: Math.round(trip.acceleration_consumption * 100)
            },
            distance_penalty: {
              liters: trip.extra_distance_consumption,
              percent: Math.round((trip.extra_distance_consumption / trip.total_fuel_liters) * 100),
              cost_inr: Math.round(trip.extra_distance_consumption * 100)
            },
            idle: {
              liters: trip.idle_consumption,
              percent: Math.round((trip.idle_consumption / trip.total_fuel_liters) * 100),
              cost_inr: Math.round(trip.idle_consumption * 100)
            }
          },
          
          efficiency: {
            liters_per_km: (trip.total_fuel_liters / trip.distance_km).toFixed(2),
            cost_per_km: Math.round((trip.total_fuel_liters * 100) / trip.distance_km)
          }
        }
      };
    } catch (error) {
      logger.error('Error analyzing trip:', error);
      throw error;
    }
  }
}

module.exports = AnalyticsService;
