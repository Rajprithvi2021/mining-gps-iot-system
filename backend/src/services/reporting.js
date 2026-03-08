const db = require('../utils/database');
const logger = require('../utils/logger');

class ReportingService {
  /**
   * Generate weekly fuel efficiency report
   */
  static async generateWeeklyFuelReport() {
    try {
      const query = `
        SELECT 
          v.vehicle_id,
          v.vehicle_name,
          ROUND(AVG(fcr.fuel_consumed / fcr.distance_km), 4) as avg_l_per_km,
          SUM(fcr.fuel_consumed) as total_fuel_L,
          SUM(fcr.distance_km) as total_distance_km,
          COUNT(*) as trip_count,
          ROUND(SUM(fcr.fuel_consumed) * 100, 2) as estimated_cost_INR,
          DATE_TRUNC('week', fcr.created_at) as week_start
        FROM fuel_consumption_records fcr
        JOIN vehicles v ON fcr.vehicle_id = v.id
        WHERE fcr.created_at >= NOW() - INTERVAL '7 days'
        GROUP BY v.vehicle_id, v.vehicle_name, DATE_TRUNC('week', fcr.created_at)
        ORDER BY avg_l_per_km DESC
      `;
      const result = await db.query(query);
      return {
        success: true,
        report_type: 'weekly_fuel_efficiency',
        generated_at: new Date().toISOString(),
        vehicles: result.rows,
        summary: {
          total_vehicles: result.rows.length,
          worst_performer: result.rows[0],
          best_performer: result.rows[result.rows.length - 1]
        }
      };
    } catch (error) {
      logger.error('Error generating weekly fuel report:', error);
      throw error;
    }
  }

  /**
   * Generate driver leaderboard (performance ranking)
   */
  static async generateDriverLeaderboard(limit = 20) {
    try {
      const query = `
        SELECT 
          d.driver_id,
          d.driver_name,
          COUNT(DISTINCT fcr.id) as trips,
          ROUND(AVG(fcr.fuel_consumed / fcr.distance_km), 4) as fuel_efficiency,
          (100 - (COUNT(CASE WHEN a.type = 'route_deviation' THEN 1 END) * 5)) as safety_score,
          COUNT(CASE WHEN is.duration_minutes > 5 THEN 1 END) as excessive_idle_count,
          ROUND(
            (100 - (COUNT(CASE WHEN a.type = 'route_deviation' THEN 1 END) * 5)) * 0.4 +
            (100 - (COUNT(CASE WHEN is.duration_minutes > 5 THEN 1 END) * 2)) * 0.3 +
            (100 - ((AVG(fcr.fuel_consumed / fcr.distance_km) - 0.08) / 0.08 * 100)) * 0.3,
            2
          ) as overall_score
        FROM drivers d
        LEFT JOIN fuel_consumption_records fcr ON d.driver_id = fcr.driver_id
        LEFT JOIN alerts a ON d.driver_id = a.driver_id AND a.created_at >= NOW() - INTERVAL '30 days'
        LEFT JOIN idle_sessions is ON d.driver_id = is.driver_id
        GROUP BY d.driver_id, d.driver_name
        ORDER BY overall_score DESC
        LIMIT $1
      `;
      const result = await db.query(query, [limit]);
      return {
        success: true,
        report_type: 'driver_leaderboard',
        generated_at: new Date().toISOString(),
        drivers: result.rows.map((row, idx) => ({
          ...row,
          rank: idx + 1
        }))
      };
    } catch (error) {
      logger.error('Error generating driver leaderboard:', error);
      throw error;
    }
  }

  /**
   * Generate maintenance schedule report
   */
  static async generateMaintenanceSchedule() {
    try {
      const query = `
        SELECT 
          v.vehicle_id,
          v.vehicle_name,
          v.fuel_tank_capacity_L,
          SUM(fcr.distance_km) as total_km,
          CASE 
            WHEN SUM(fcr.distance_km) >= 5000 THEN 'URGENT'
            WHEN SUM(fcr.distance_km) >= 4000 THEN 'SOON'
            ELSE 'SCHEDULED'
          END as maintenance_urgency,
          ROUND(AVG(fcr.fuel_consumed / fcr.distance_km), 4) as current_l_per_km,
          (SELECT ROUND(AVG(fuel_consumed / distance_km), 4) 
           FROM fuel_consumption_records 
           WHERE vehicle_id = v.id 
           LIMIT 10 OFFSET 0) as baseline_l_per_km,
          ROUND(
            ((SELECT ROUND(AVG(fuel_consumed / distance_km), 4) 
              FROM fuel_consumption_records 
              WHERE vehicle_id = v.id 
              LIMIT 10 OFFSET 0) - 
             ROUND(AVG(fcr.fuel_consumed / fcr.distance_km), 4)) / 
            (SELECT ROUND(AVG(fuel_consumed / distance_km), 4) 
             FROM fuel_consumption_records 
             WHERE vehicle_id = v.id 
             LIMIT 10 OFFSET 0) * 100,
            2
          ) as degradation_percent
        FROM vehicles v
        LEFT JOIN fuel_consumption_records fcr ON v.id = fcr.vehicle_id
        WHERE fcr.created_at >= NOW() - INTERVAL '90 days'
        GROUP BY v.id, v.vehicle_id, v.vehicle_name, v.fuel_tank_capacity_L
        HAVING SUM(fcr.distance_km) >= 1000
        ORDER BY total_km DESC
      `;
      const result = await db.query(query);
      return {
        success: true,
        report_type: 'maintenance_schedule',
        generated_at: new Date().toISOString(),
        vehicles: result.rows,
        urgent_count: result.rows.filter(r => r.maintenance_urgency === 'URGENT').length,
        soon_count: result.rows.filter(r => r.maintenance_urgency === 'SOON').length
      };
    } catch (error) {
      logger.error('Error generating maintenance schedule:', error);
      throw error;
    }
  }

  /**
   * Generate anomaly report (theft, aggressive driving, etc.)
   */
  static async generateAnomalyReport(timeRange = '7days') {
    try {
      const days = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 1;
      
      const query = `
        SELECT 
          a.vehicle_id,
          v.vehicle_name,
          a.type,
          a.severity,
          COUNT(*) as incident_count,
          MAX(a.created_at) as latest_incident,
          STRING_AGG(DISTINCT a.alert_data->>'details', '; ') as details_summary
        FROM alerts a
        JOIN vehicles v ON a.vehicle_id = v.id
        WHERE a.created_at >= NOW() - INTERVAL '${days} days'
          AND a.type IN ('fuel_anomaly', 'aggressive_driving', 'overspeed')
        GROUP BY a.vehicle_id, v.vehicle_name, a.type, a.severity
        ORDER BY incident_count DESC
      `;
      
      const result = await db.query(query);
      return {
        success: true,
        report_type: 'anomaly_report',
        time_range: timeRange,
        generated_at: new Date().toISOString(),
        anomalies: result.rows,
        summary: {
          total_anomalies: result.rows.reduce((sum, r) => sum + r.incident_count, 0),
          vehicles_affected: new Set(result.rows.map(r => r.vehicle_id)).size,
          critical_incidents: result.rows.filter(r => r.severity === 'critical').reduce((sum, r) => sum + r.incident_count, 0)
        }
      };
    } catch (error) {
      logger.error('Error generating anomaly report:', error);
      throw error;
    }
  }

  /**
   * Generate cost analysis report (breakdown by route, vehicle, component)
   */
  static async generateCostAnalysisReport() {
    try {
      const query = `
        SELECT 
          r.route_id,
          r.route_name,
          COUNT(DISTINCT fcr.id) as trips,
          SUM(fcr.fuel_consumed) as total_fuel,
          SUM(fcr.base_fuel) as base_fuel,
          SUM(fcr.acceleration_fuel) as accel_fuel,
          SUM(fcr.distance_fuel) as distance_fuel,
          SUM(fcr.idle_fuel) as idle_fuel,
          ROUND(SUM(fcr.base_fuel) * 100 / NULLIF(SUM(fcr.fuel_consumed), 0), 1) as base_percent,
          ROUND(SUM(fcr.acceleration_fuel) * 100 / NULLIF(SUM(fcr.fuel_consumed), 0), 1) as accel_percent,
          ROUND(SUM(fcr.distance_fuel) * 100 / NULLIF(SUM(fcr.fuel_consumed), 0), 1) as distance_percent,
          ROUND(SUM(fcr.idle_fuel) * 100 / NULLIF(SUM(fcr.fuel_consumed), 0), 1) as idle_percent,
          ROUND(SUM(fcr.fuel_consumed) * 100, 2) as total_cost_INR
        FROM fuel_consumption_records fcr
        JOIN vehicles v ON fcr.vehicle_id = v.id
        JOIN routes r ON fcr.route_id = r.id
        WHERE fcr.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY r.route_id, r.route_name
        ORDER BY total_cost_INR DESC
      `;
      
      const result = await db.query(query);
      return {
        success: true,
        report_type: 'cost_analysis',
        generated_at: new Date().toISOString(),
        routes: result.rows,
        total_fleet_cost: result.rows.reduce((sum, r) => sum + parseFloat(r.total_cost_INR), 0),
        optimization_opportunities: result.rows
          .filter(r => parseFloat(r.idle_percent) > 20)
          .map(r => ({
            route: r.route_name,
            issue: 'High idle consumption',
            potential_savings: `₹${Math.round(r.total_cost_INR * 0.2)}`
          }))
      };
    } catch (error) {
      logger.error('Error generating cost analysis:', error);
      throw error;
    }
  }
}

module.exports = ReportingService;
