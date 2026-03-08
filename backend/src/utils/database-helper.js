// Advanced features integration - Database connection helper
const monitor = require('pg-monitor');
const pgFormat = require('pg-format');
const db = require('./database');
const logger = require('./logger');

/**
 * Database optimization utilities for advanced queries
 */
class DatabaseHelper {
  /**
   * Execute query with automatic monitoring and logging
   */
  static async queryWithMonitoring(query, params = []) {
    try {
      const start = Date.now();
      const result = await db.query(query, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        logger.warn(`Slow query detected (${duration}ms): ${query.substring(0, 50)}...`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Query error: ${query}`, error);
      throw error;
    }
  }

  /**
   * Execute batch insert with conflict handling
   */
  static async batchInsert(table, records, onConflict = 'DO NOTHING') {
    try {
      const columns = Object.keys(records[0]);
      const values = records.map(r => columns.map(c => r[c]));
      
      const query = pgFormat(
        `INSERT INTO %I (${columns.map((_, i) => `%I`).join(',')}) VALUES %L ON CONFLICT ${onConflict}`,
        table,
        ...columns,
        values
      );
      
      const result = await db.query(query);
      logger.info(`Inserted ${result.rowCount} records into ${table}`);
      return result;
    } catch (error) {
      logger.error(`Batch insert error: ${table}`, error);
      throw error;
    }
  }

  /**
   * Create materialized view for complex aggregations
   */
  static async createMaterializedViews() {
    try {
      const views = [
        {
          name: 'vehicle_fuel_efficiency',
          query: `
            CREATE MATERIALIZED VIEW IF NOT EXISTS vehicle_fuel_efficiency AS
            SELECT 
              v.id,
              v.vehicle_id,
              v.vehicle_name,
              ROUND(AVG(fcr.fuel_consumed / NULLIF(fcr.distance_km, 0)), 4) as avg_l_per_km,
              ROUND(AVG(fcr.fuel_consumed), 2) as avg_fuel_per_trip,
              MAX(fcr.fuel_consumed) as max_consumption,
              COUNT(*) as trip_count,
              MAX(fcr.created_at) as last_trip,
              SUM(fcr.distance_km) as total_distance
            FROM vehicles v
            LEFT JOIN fuel_consumption_records fcr ON v.id = fcr.vehicle_id
            WHERE fcr.created_at >= NOW() - INTERVAL '30 days'
            GROUP BY v.id, v.vehicle_id, v.vehicle_name
          `
        },
        {
          name: 'driver_leaderboard',
          query: `
            CREATE MATERIALIZED VIEW IF NOT EXISTS driver_leaderboard AS
            SELECT 
              d.driver_id,
              d.driver_name,
              COUNT(DISTINCT fcr.id) as trips,
              ROUND(AVG(fcr.fuel_consumed / NULLIF(fcr.distance_km, 0)), 4) as fuel_efficiency,
              COUNT(CASE WHEN a.severity = 'critical' THEN 1 END) as critical_alerts,
              COUNT(DISTINCT a.id) as total_alerts,
              ROUND(100 - (COUNT(DISTINCT a.id) * 5), 2) as safety_score
            FROM drivers d
            LEFT JOIN fuel_consumption_records fcr ON d.id = fcr.vehicle_id
            LEFT JOIN alerts a ON d.id = a.vehicle_id AND a.created_at >= NOW() - INTERVAL '7 days'
            GROUP BY d.driver_id, d.driver_name
          `
        },
        {
          name: 'hourly_alert_summary',
          query: `
            CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_alert_summary AS
            SELECT 
              v.vehicle_id,
              v.vehicle_name,
              DATE_TRUNC('hour', a.created_at) as hour,
              a.alert_type,
              a.severity,
              COUNT(*) as count
            FROM alerts a
            JOIN vehicles v ON a.vehicle_id = v.id
            WHERE a.created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY v.vehicle_id, v.vehicle_name, DATE_TRUNC('hour', a.created_at), a.alert_type, a.severity
          `
        }
      ];

      for (const view of views) {
        await db.query(view.query);
        logger.info(`Created materialized view: ${view.name}`);
        
        // Create index for faster queries
        await db.query(
          `CREATE INDEX IF NOT EXISTS idx_${view.name} ON ${view.name} (vehicle_id)`
        );
      }
    } catch (error) {
      logger.error('Error creating materialized views:', error);
    }
  }

  /**
   * Refresh materialized views (run periodically)
   */
  static async refreshMaterializedViews() {
    try {
      const views = ['vehicle_fuel_efficiency', 'driver_leaderboard', 'hourly_alert_summary'];
      
      for (const view of views) {
        await db.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
        logger.debug(`Refreshed materialized view: ${view}`);
      }
    } catch (error) {
      logger.error('Error refreshing materialized views:', error);
    }
  }

  /**
   * Query materialized view with caching
   */
  static async queryView(viewName, filters = {}) {
    try {
      let query = `SELECT * FROM ${viewName} WHERE 1=1`;
      const params = [];
      
      if (filters.vehicle_id) {
        query += ` AND vehicle_id = $${params.length + 1}`;
        params.push(filters.vehicle_id);
      }
      
      if (filters.limit) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(filters.limit);
      }
      
      return await this.queryWithMonitoring(query, params);
    } catch (error) {
      logger.error(`Error querying view ${viewName}:`, error);
      throw error;
    }
  }

  /**
   * Auto-partition tables by date
   */
  static async createDatePartitions(tableName) {
    try {
      // For fuel_consumption_records - partition by month
      if (tableName === 'fuel_consumption_records') {
        const query = `
          CREATE TABLE IF NOT EXISTS ${tableName}_${new Date().getFullYear()}_${String(new Date().getMonth() + 1).padStart(2, '0')} PARTITION OF ${tableName}
          FOR VALUES FROM ('${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01'::timestamp)
          TO ('${new Date().getFullYear()}-${String(new Date().getMonth() + 2).padStart(2, '0')}-01'::timestamp)
        `;
        
        await db.query(query);
        logger.info(`Created partition for ${tableName}`);
      }
    } catch (error) {
      logger.warn(`Partition creation warning: ${error.message}`);
    }
  }

  /**
   * Generate performance statistics
   */
  static async getTableStats(tableName) {
    try {
      const query = `
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          n_live_tup as row_count,
          n_mod_since_analyze as changes_since_analyze
        FROM pg_stat_user_tables
        WHERE tablename = $1
      `;
      
      return await this.queryWithMonitoring(query, [tableName]);
    } catch (error) {
      logger.error(`Error getting table stats for ${tableName}:`, error);
      throw error;
    }
  }
}

module.exports = DatabaseHelper;
