const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const AnalyticsService = require('../services/analytics');
const AlertService = require('../services/alerts');
const logger = require('../utils/logger');

// GET /api/v1/analytics - Get detailed vehicle analytics with comparison
router.get('/', async (req, res) => {
  try {
    // Get detailed vehicle analytics from PostgreSQL - Using CORRECT column names from vehicles table
    const vehiclesResult = await pool.query(
      `SELECT 
        v.id,
        v.name as vehicle_name,
        v.type,
        v.current_latitude,
        v.current_longitude,
        v.current_speed_kmh as speed_kmh,
        v.fuel_percentage,
        v.temperature,
        v.efficiency_rating,
        v.active,
        v.status,
        COUNT(CASE WHEN a.severity = 'critical' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN a.severity = 'high' THEN 1 END) as high_alerts,
        COUNT(a.id) as total_alerts
       FROM vehicles v
       LEFT JOIN alerts a ON v.id = a.vehicle_id AND a.resolved = false
       GROUP BY v.id, v.name, v.type, v.current_latitude, v.current_longitude, 
                v.current_speed_kmh, v.fuel_percentage, v.temperature, v.efficiency_rating,
                v.active, v.status
       ORDER BY v.id`
    );
    
    const alertsResult = await pool.query(
      `SELECT COUNT(*) as total_alerts,
              COUNT(CASE WHEN resolved = false THEN 1 END) as unresolved_alerts,
              COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts
       FROM alerts`
    );
    
    // Calculate fleet summary from database
    const vehicles = vehiclesResult.rows;
    const totalVehicles = vehicles.length;
    const activeVehicles = vehicles.filter(v => v.active).length;
    const avgSpeed = vehicles.length > 0 
      ? (vehicles.reduce((sum, v) => sum + (parseFloat(v.speed_kmh) || 0), 0) / vehicles.length).toFixed(2)
      : 0;
    const avgEfficiency = vehicles.length > 0
      ? (vehicles.reduce((sum, v) => sum + (parseFloat(v.efficiency_rating) || 0), 0) / vehicles.length).toFixed(2)
      : 0;
    const avgFuelLevel = vehicles.length > 0
      ? (vehicles.reduce((sum, v) => sum + (parseInt(v.fuel_percentage) || 0), 0) / vehicles.length).toFixed(2)
      : 0;
    const avgTemp = vehicles.length > 0
      ? (vehicles.reduce((sum, v) => sum + (parseFloat(v.temperature) || 0), 0) / vehicles.length).toFixed(1)
      : 0;
    
    const alertStats = alertsResult.rows[0];
    
    res.json({
      success: true,
      data: {
        fleet_summary: {
          totalVehicles,
          activeVehicles,
          avgSpeed: parseFloat(avgSpeed),
          avgEfficiency: parseFloat(avgEfficiency),
          avgFuelLevel: parseFloat(avgFuelLevel),
          avgTemperature: parseFloat(avgTemp),
          lastUpdate: new Date().toISOString()
        },
        alerts: {
          total: parseInt(alertStats.total_alerts) || 0,
          unresolved: parseInt(alertStats.unresolved_alerts) || 0,
          critical: parseInt(alertStats.critical_alerts) || 0
        },
        vehicle_comparison: vehicles.map(v => ({
          id: v.id,
          name: v.vehicle_name,
          type: v.type,
          status: v.active ? 'moving' : 'idle',
          active: v.active,
          location: {
            latitude: parseFloat(v.current_latitude || 0),
            longitude: parseFloat(v.current_longitude || 0)
          },
          performance: {
            speed_kmh: parseFloat(v.speed_kmh || 0),
            fuel_percentage: parseInt(v.fuel_percentage || 0),
            temperature_celsius: parseFloat(v.temperature || 0),
            efficiency_rating: parseFloat(v.efficiency_rating || 0)
          },
          alerts: {
            critical: parseInt(v.critical_alerts || 0),
            high: parseInt(v.high_alerts || 0),
            total: parseInt(v.total_alerts || 0)
          },
          health_score: calculateHealthScore(v)
        }))
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

// Helper function to calculate vehicle health score
function calculateHealthScore(vehicle) {
  let score = 100;
  
  // Fuel level (target: 40-80%)
  const fuel = parseInt(vehicle.fuel_percentage) || 0;
  if (fuel < 20) score -= 30;
  else if (fuel < 40) score -= 15;
  else if (fuel > 95) score -= 5;
  
  // Efficiency (target: 7-10 km/L)
  const efficiency = parseFloat(vehicle.efficiency_rating) || 0;
  if (efficiency < 6) score -= 25;
  else if (efficiency < 7) score -= 15;
  else if (efficiency > 12) score -= 5;
  
  // Speed (target: under 80 km/h)
  const speed = parseFloat(vehicle.speed_kmh) || 0;
  if (speed > 100) score -= 20;
  else if (speed > 90) score -= 10;
  
  // Temperature (optimal: 60-90°C)
  const temp = parseFloat(vehicle.temperature) || 0;
  if (temp > 100) score -= 25;
  else if (temp > 95) score -= 15;
  else if (temp < 50) score -= 10;
  
  // Alerts
  score -= (vehicle.critical_alerts || 0) * 20;
  score -= (vehicle.high_alerts || 0) * 10;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = router;
