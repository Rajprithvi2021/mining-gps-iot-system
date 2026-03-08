// src/services/gpsService.js
// GPS data management and storage service
// Handles real-time GPS data from edge devices

const logger = require('../utils/logger');

class GPSService {
  constructor(database) {
    this.db = database;
  }

  /**
   * Store GPS data point received from edge device
   */
  async storeGPSPoint(vehicleId, gpsData) {
    try {
      const query = `
        INSERT INTO gps_data (vehicle_id, latitude, longitude, speed_kmh, heading, accuracy_m, gps_timestamp)
        SELECT id, $2, $3, $4, $5, $6, $7
        FROM vehicles
        WHERE vehicle_id = $1
        RETURNING id, latitude, longitude, received_at
      `;

      const result = await this.db.query(query, [
        vehicleId,
        gpsData.latitude,
        gpsData.longitude,
        gpsData.speed || 0,
        gpsData.heading || 0,
        gpsData.accuracy || 0,
        new Date(gpsData.timestamp || Date.now()),
      ]);

      if (result.rows.length === 0) {
        throw new Error(`Vehicle ${vehicleId} not found`);
      }

      logger.debug(`GPS point stored for vehicle ${vehicleId}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error storing GPS point: ${error.message}`);
      throw error;
    }
  }

  /**
   * Batch upload GPS points (for offline sync from edge)
   */
  async batchStoreGPSPoints(vehicleId, gpsDataArray) {
    try {
      const query = `
        INSERT INTO gps_data (vehicle_id, latitude, longitude, speed_kmh, heading, accuracy_m, gps_timestamp)
        SELECT id, point->>'latitude'::numeric, point->>'longitude'::numeric, 
               (point->>'speed')::numeric, (point->>'heading')::numeric, 
               (point->>'accuracy')::numeric, (point->>'timestamp')::timestamp
        FROM vehicles, jsonb_array_elements($2) AS point
        WHERE vehicle_id = $1
        ON CONFLICT DO NOTHING
      `;

      const result = await this.db.query(query, [vehicleId, JSON.stringify(gpsDataArray)]);

      logger.info(`Batch stored ${result.rowCount} GPS points for vehicle ${vehicleId}`);
      return result.rowCount;
    } catch (error) {
      logger.error(`Error batch storing GPS points: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get latest GPS position for a vehicle
   */
  async getLatestPosition(vehicleId) {
    try {
      const query = `
        SELECT latitude, longitude, speed_kmh, heading, accuracy_m, received_at
        FROM gps_data
        WHERE vehicle_id = (SELECT id FROM vehicles WHERE vehicle_id = $1)
        ORDER BY received_at DESC
        LIMIT 1
      `;

      const result = await this.db.query(query, [vehicleId]);

      if (result.rows.length === 0) {
        return null;
      }

      return {
        latitude: parseFloat(result.rows[0].latitude),
        longitude: parseFloat(result.rows[0].longitude),
        speed_kmh: parseFloat(result.rows[0].speed_kmh),
        heading: parseFloat(result.rows[0].heading),
        accuracy_m: parseFloat(result.rows[0].accuracy_m),
        timestamp: result.rows[0].received_at,
      };
    } catch (error) {
      logger.error(`Error getting latest position: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get GPS trail for a vehicle (last N hours)
   */
  async getGPSTrail(vehicleId, hoursAgo = 24) {
    try {
      const query = `
        SELECT latitude, longitude, speed_kmh, heading, accuracy_m, received_at
        FROM gps_data
        WHERE vehicle_id = (SELECT id FROM vehicles WHERE vehicle_id = $1)
        AND received_at > NOW() - INTERVAL '${hoursAgo} hours'
        ORDER BY received_at ASC
        LIMIT 1440  -- Max 1440 points (1 per minute for 24 hours)
      `;

      const result = await this.db.query(query, [vehicleId]);

      return result.rows.map((row) => ({
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        speed_kmh: parseFloat(row.speed_kmh),
        heading: parseFloat(row.heading),
        accuracy_m: parseFloat(row.accuracy_m),
        timestamp: row.received_at,
      }));
    } catch (error) {
      logger.error(`Error getting GPS trail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get trip statistics for a vehicle
   */
  async getTripStatistics(vehicleId, startTime, endTime) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_points,
          AVG(speed_kmh) as avg_speed,
          MAX(speed_kmh) as max_speed,
          MIN(speed_kmh) as min_speed,
          COUNT(CASE WHEN speed_kmh < 1 THEN 1 END) as idle_points
        FROM gps_data
        WHERE vehicle_id = (SELECT id FROM vehicles WHERE vehicle_id = $1)
        AND received_at BETWEEN $2 AND $3
      `;

      const result = await this.db.query(query, [vehicleId, startTime, endTime]);

      if (result.rows.length === 0) {
        return null;
      }

      const stats = result.rows[0];

      return {
        total_points: parseInt(stats.total_points),
        avg_speed_kmh: parseFloat(stats.avg_speed || 0).toFixed(2),
        max_speed_kmh: parseFloat(stats.max_speed || 0).toFixed(2),
        min_speed_kmh: parseFloat(stats.min_speed || 0).toFixed(2),
        idle_percentage: ((parseInt(stats.idle_points) / parseInt(stats.total_points)) * 100).toFixed(2),
      };
    } catch (error) {
      logger.error(`Error getting trip statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all latest positions for fleet (for map display)
   */
  async getFleetLatestPositions() {
    try {
      const query = `
        SELECT 
          v.vehicle_id,
          v.name,
          v.type,
          v.status,
          gd.latitude,
          gd.longitude,
          gd.speed_kmh,
          gd.heading,
          gd.received_at,
          (SELECT COUNT(*) FROM alerts WHERE vehicle_id = v.id AND resolved_at IS NULL) as active_alerts
        FROM vehicles v
        LEFT JOIN LATERAL (
          SELECT latitude, longitude, speed_kmh, heading, received_at
          FROM gps_data
          WHERE vehicle_id = v.id
          ORDER BY received_at DESC
          LIMIT 1
        ) gd ON true
        WHERE v.status IN ('active', 'idle')
        ORDER BY v.vehicle_id
      `;

      const result = await this.db.query(query);

      return result.rows.map((row) => ({
        vehicle_id: row.vehicle_id,
        name: row.name,
        type: row.type,
        status: row.status,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        speed_kmh: row.speed_kmh ? parseFloat(row.speed_kmh) : 0,
        heading: row.heading ? parseFloat(row.heading) : 0,
        last_update: row.received_at,
        active_alerts: parseInt(row.active_alerts || 0),
      }));
    } catch (error) {
      logger.error(`Error getting fleet positions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate vehicle efficiency metrics
   */
  async calculateEfficiency(vehicleId, days = 7) {
    try {
      const query = `
        SELECT 
          AVG(speed_kmh) as avg_speed,
          COUNT(CASE WHEN speed_kmh < 1 THEN 1 END) as idle_count,
          COUNT(*) as total_count,
          COUNT(DISTINCT DATE(received_at)) as days_tracked
        FROM gps_data
        WHERE vehicle_id = (SELECT id FROM vehicles WHERE vehicle_id = $1)
        AND received_at > NOW() - INTERVAL '${days} days'
      `;

      const result = await this.db.query(query, [vehicleId]);

      if (result.rows.length === 0) {
        return null;
      }

      const stats = result.rows[0];
      const idlePercentage = (parseInt(stats.idle_count) / parseInt(stats.total_count)) * 100;
      const efficiencyScore = 100 - idlePercentage; // Simple efficiency metric

      return {
        vehicle_id: vehicleId,
        avg_speed_kmh: parseFloat(stats.avg_speed || 0).toFixed(2),
        idle_percentage: idlePercentage.toFixed(2),
        efficiency_score: efficiencyScore.toFixed(2),
        days_tracked: parseInt(stats.days_tracked),
      };
    } catch (error) {
      logger.error(`Error calculating efficiency: ${error.message}`);
      throw error;
    }
  }
}

module.exports = GPSService;
