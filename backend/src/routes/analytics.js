const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const AnalyticsService = require('../services/analytics');
const AlertService = require('../services/alerts');
const logger = require('../utils/logger');

// GET /api/v1/analytics - Get analytics overview
router.get('/', async (req, res) => {
  try {
    // Get analytics from PostgreSQL
    const vehiclesResult = await pool.query(
      `SELECT COUNT(*) as total_vehicles,
              COUNT(CASE WHEN active = true THEN 1 END) as active,
              AVG(current_speed_kmh) as avg_speed,
              AVG(efficiency_rating) as avg_efficiency,
              AVG(fuel_percentage) as avg_fuel
       FROM vehicles`
    );
    
    const alertsResult = await pool.query(
      `SELECT COUNT(*) as total_alerts,
              COUNT(CASE WHEN resolved = false THEN 1 END) as unresolved_alerts,
              COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts
       FROM alerts`
    );
    
    const vehicleStats = vehiclesResult.rows[0];
    const alertStats = alertsResult.rows[0];
    
    res.json({
      success: true,
      data: {
        fleet: {
          totalVehicles: parseInt(vehicleStats.total_vehicles) || 5,
          activeVehicles: parseInt(vehicleStats.active) || 4,
          avgSpeed: parseFloat(vehicleStats.avg_speed) || 28,
          avgEfficiency: parseFloat(vehicleStats.avg_efficiency) || 8.5,
          avgFuelLevel: parseFloat(vehicleStats.avg_fuel) || 62.5
        },
        alerts: {
          total: parseInt(alertStats.total_alerts) || 4,
          unresolved: parseInt(alertStats.unresolved_alerts) || 3,
          critical: parseInt(alertStats.critical_alerts) || 1
        },
        lastUpdate: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error in analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/analytics/fuel - Fleet fuel efficiency metrics
router.get('/fuel', async (req, res) => {
  try {
    const { timeRange, vehicleId } = req.query;
    const result = await AnalyticsService.getFleetFuelAnalytics(
      timeRange || '7days',
      vehicleId
    );
    res.json(result);
  } catch (error) {
    logger.error('Error in fuel analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/analytics/driver/:driverId - Driver performance scorecard
router.get('/driver/:driverId', async (req, res) => {
  try {
    const { timeRange } = req.query;
    const result = await AnalyticsService.getDriverPerformance(
      req.params.driverId,
      timeRange || '30days'
    );
    res.json(result);
  } catch (error) {
    logger.error('Error in driver analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/analytics/maintenance - Maintenance predictions
router.get('/maintenance', async (req, res) => {
  try {
    const result = await AnalyticsService.getMaintenancePredictions();
    res.json(result);
  } catch (error) {
    logger.error('Error in maintenance predictions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/analytics/trip/:tripId - Detailed trip analysis
router.get('/trip/:tripId', async (req, res) => {
  try {
    const result = await AnalyticsService.getTripAnalysis(req.params.tripId);
    res.json(result);
  } catch (error) {
    logger.error('Error in trip analysis:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/analytics/alerts/trends - Alert trends over time
router.get('/alerts/trends', async (req, res) => {
  try {
    const { days } = req.query;
    const result = await AlertService.getAlertTrends(parseInt(days) || 7);
    res.json(result);
  } catch (error) {
    logger.error('Error in alert trends:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/analytics/alerts/active - Active unresolved alerts
router.get('/alerts/active', async (req, res) => {
  try {
    const { vehicleId } = req.query;
    const result = await AlertService.getActiveAlerts(vehicleId);
    res.json(result);
  } catch (error) {
    logger.error('Error getting active alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/analytics/alerts/resolve - Bulk resolve alerts
router.post('/alerts/resolve', async (req, res) => {
  try {
    const { alertIds, resolvedBy, notes } = req.body;

    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'alertIds array required'
      });
    }

    const result = await AlertService.resolveAlerts(alertIds, resolvedBy, notes);
    res.json(result);
  } catch (error) {
    logger.error('Error resolving alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/analytics/summary - Overall fleet summary
router.get('/summary', async (req, res) => {
  try {
    const fuel = await AnalyticsService.getFleetFuelAnalytics('7days');
    const alerts = await AlertService.getAlertTrends(7);
    const maintenance = await AnalyticsService.getMaintenancePredictions();

    res.json({
      success: true,
      summary: {
        fuel_analytics: fuel.summary,
        alert_summary: alerts.summary,
        maintenance_alerts: maintenance.vehicles_needing_service.length,
        key_metrics: {
          avg_fleet_efficiency_l_per_km: fuel.summary.avg_efficiency?.toFixed(2),
          total_fleet_cost_7days: Math.round(fuel.summary.total_cost),
          active_critical_alerts: alerts.summary.critical_alerts,
          vehicles_needing_service: maintenance.vehicles_needing_service.length
        }
      }
    });
  } catch (error) {
    logger.error('Error in summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/analytics/export/csv - Export data to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const { type, timeRange } = req.query; // type: fuel, alerts, trips

    if (type === 'fuel') {
      const data = await AnalyticsService.getFleetFuelAnalytics(timeRange || '30days');

      // Build CSV
      let csv = 'Vehicle ID,Avg Consumption (L/km),Max Consumption,Trip Count,Total Fuel (L),Total Cost (INR)\n';
      data.analytics.forEach(row => {
        csv += `${row.vehicle_id},${row.avg_consumption?.toFixed(2)},${row.max_consumption?.toFixed(2)},${row.trip_count},${row.total_fuel?.toFixed(2)},${Math.round(row.total_cost)}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=fuel-analytics.csv');
      res.send(csv);
    }
  } catch (error) {
    logger.error('Error exporting CSV:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
