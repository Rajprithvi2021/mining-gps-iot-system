// Alert Service - Alert generation, escalation, and management
const pool = require('../utils/database');
const logger = require('../utils/logger');

class AlertService {
  /**
   * Create alert with severity and escalation logic
   */
  static async createAlert(vehicleId, alertType, severity, description, metadata) {
    try {
      const query = `
        INSERT INTO alerts (
          vehicle_id, alert_type, severity, timestamp, 
          latitude, longitude, description, metadata, resolved
        ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, false)
        RETURNING *
      `;
      
      // Get current vehicle location
      const vehicleQuery = 'SELECT current_latitude, current_longitude FROM vehicles WHERE id = $1';
      const vehicleResult = await pool.query(vehicleQuery, [vehicleId]);
      
      const location = vehicleResult.rows[0] || { current_latitude: null, current_longitude: null };
      
      const result = await pool.query(query, [
        vehicleId,
        alertType,
        severity,
        location.current_latitude,
        location.current_longitude,
        description,
        JSON.stringify(metadata || {})
      ]);
      
      // Check for escalation
      await this.checkAlertEscalation(vehicleId, alertType);
      
      logger.info(`Alert created: ${alertType} for vehicle ${vehicleId}`);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating alert:', error);
      throw error;
    }
  }

  /**
   * Escalate alert if multiple incidents occur within timeframe
   */
  static async checkAlertEscalation(vehicleId, alertType) {
    try {
      const escalationRules = {
        'route_deviation': { count: 3, timeframe: '1 hour', escalate_to: 'critical' },
        'high_idle_duration': { count: 5, timeframe: '24 hours', escalate_to: 'high' },
        'high_fuel_consumption': { count: 4, timeframe: '3 days', escalate_to: 'high' },
        'potential_fuel_theft': { count: 1, timeframe: '1 hour', escalate_to: 'critical' }
      };
      
      const rule = escalationRules[alertType];
      if (!rule) return;
      
      const countQuery = `
        SELECT COUNT(*) as count 
        FROM alerts 
        WHERE vehicle_id = $1 
        AND alert_type = $2
        AND created_at > NOW() - INTERVAL '${rule.timeframe}'
      `;
      
      const countResult = await pool.query(countQuery, [vehicleId, alertType]);
      
      if (countResult.rows[0].count >= rule.count) {
        const escalationAlert = await this.createAlert(
          vehicleId,
          `${alertType}_escalated`,
          rule.escalate_to,
          `Multiple ${alertType} incidents detected - escalating alert`,
          {
            original_alert_type: alertType,
            incident_count: countResult.rows[0].count,
            recommendation: 'Immediate driver/vehicle inspection required'
          }
        );
        
        logger.warn(`Alert escalated for vehicle ${vehicleId}: ${alertType}`);
      }
    } catch (error) {
      logger.error('Error in alert escalation:', error);
    }
  }

  /**
   * Get active unresolved alerts with priority
   */
  static async getActiveAlerts(vehicleId = null, limit = 100) {
    try {
      let query = `
        SELECT 
          a.*,
          v.name as vehicle_name,
          CASE 
            WHEN a.severity = 'critical' THEN 1
            WHEN a.severity = 'high' THEN 2
            WHEN a.severity = 'medium' THEN 3
            ELSE 4
          END as severity_rank
        FROM alerts a
        LEFT JOIN vehicles v ON a.vehicle_id = v.id
        WHERE a.resolved = false
        AND a.created_at > NOW() - INTERVAL '24 hours'
      `;
      
      const params = [];
      
      if (vehicleId) {
        query += ` AND a.vehicle_id = $${params.length + 1}`;
        params.push(vehicleId);
      }
      
      query += ` ORDER BY a.severity_rank ASC, a.created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      
      const result = await pool.query(query, params);
      
      return {
        success: true,
        alerts: result.rows,
        critical_count: result.rows.filter(a => a.severity === 'critical').length,
        high_count: result.rows.filter(a => a.severity === 'high').length
      };
    } catch (error) {
      logger.error('Error getting active alerts:', error);
      throw error;
    }
  }

  /**
   * Get alert resolution recommendations
   */
  static async getResolutionRecommendations(alertType) {
    const recommendations = {
      'route_deviation': [
        'Verify route plan with driver',
        'Check for road construction/closures',
        'Review GPS accuracy'
      ],
      'high_idle_duration': [
        'Reduce stoppage time at loading zones',
        'Optimize loading/unloading process',
        'Check for traffic delays'
      ],
      'high_fuel_consumption': [
        'Service engine - may be maintenance issue',
        'Check tire pressure',
        'Review driver acceleration patterns'
      ],
      'potential_fuel_theft': [
        'URGENT: Inspect fuel tank',
        'Review fueling logs',
        'Install fuel monitoring sensor',
        'Investigate crew access to fuel tank'
      ],
      'overspeed_violation': [
        'Driver training - enforce speed limits',
        'Check for safety issues on route'
      ]
    };
    
    return recommendations[alertType] || ['Review alert details manually'];
  }

  /**
   * Batch resolve alerts
   */
  static async resolveAlerts(alertIds, resolvedBy, notes) {
    try {
      const query = `
        UPDATE alerts 
        SET resolved = true, resolved_at = NOW(), resolved_by = $1, resolution_notes = $2
        WHERE id = ANY($3)
        RETURNING *
      `;
      
      const result = await pool.query(query, [resolvedBy, notes, alertIds]);
      
      logger.info(`Resolved ${result.rows.length} alerts`);
      
      return {
        success: true,
        resolved_count: result.rows.length
      };
    } catch (error) {
      logger.error('Error resolving alerts:', error);
      throw error;
    }
  }

  /**
   * Get alert trends
   */
  static async getAlertTrends(days = 7) {
    try {
      const query = `
        SELECT 
          alert_type,
          severity,
          DATE(created_at) as date,
          COUNT(*) as count
        FROM alerts
        WHERE created_at > NOW() - INTERVAL '${days} days'
        GROUP BY alert_type, severity, DATE(created_at)
        ORDER BY DATE(created_at) DESC, count DESC
      `;
      
      const result = await pool.query(query);
      
      return {
        success: true,
        trends: result.rows,
        summary: {
          total_alerts: result.rows.reduce((sum, row) => sum + row.count, 0),
          unique_types: [...new Set(result.rows.map(r => r.alert_type))].length,
          critical_alerts: result.rows
            .filter(r => r.severity === 'critical')
            .reduce((sum, row) => sum + row.count, 0)
        }
      };
    } catch (error) {
      logger.error('Error getting alert trends:', error);
      throw error;
    }
  }
}

module.exports = AlertService;
