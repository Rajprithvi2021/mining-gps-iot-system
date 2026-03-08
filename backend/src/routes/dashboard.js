const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const logger = require('../utils/logger');

// GET /api/v1/dashboard/summary - Real-time KPI summary
router.get('/summary', async (req, res) => {
  try {
    // Get metrics from PostgreSQL
    const metricsResult = await pool.query(
      `SELECT active_vehicles, total_vehicles, fuel_consumption_liters, 
              efficiency_rating, cost_per_km, avg_temperature, system_uptime,
              recorded_at
       FROM dashboard_metrics 
       ORDER BY recorded_at DESC 
       LIMIT 1`
    );
    
    const metrics = metricsResult.rows[0] || {
      active_vehicles: 0,
      total_vehicles: 0,
      fuel_consumption_liters: 0,
      efficiency_rating: 0,
      cost_per_km: 0,
      avg_temperature: 0,
      system_uptime: 0
    };
    
    // Get real-time stats from vehicles table
    const vehiclesResult = await pool.query(
      `SELECT COUNT(*) as total, 
              COUNT(CASE WHEN active = true THEN 1 END) as active,
              AVG(temperature) as avg_temp,
              AVG(efficiency_rating) as avg_efficiency
       FROM vehicles`
    );
    
    const vehicleStats = vehiclesResult.rows[0];
    
    res.json({
      success: true,
      data: {
        activeVehicles: parseInt(vehicleStats.active) || metrics.active_vehicles,
        totalVehicles: parseInt(vehicleStats.total) || metrics.total_vehicles,
        fuelConsumption: parseFloat(metrics.fuel_consumption_liters) || 0,
        efficiencyRating: parseFloat(vehicleStats.avg_efficiency) || parseFloat(metrics.efficiency_rating) || 0,
        costPerKM: parseFloat(metrics.cost_per_km) || 0,
        avgTemp: parseFloat(vehicleStats.avg_temp) || parseFloat(metrics.avg_temperature) || 0,
        systemUptime: parseFloat(metrics.system_uptime) || 0,
        dataRefresh: new Date().toISOString(),
        systemHealth: 'operational'
      }
    });
  } catch (error) {
    logger.error('Error fetching dashboard summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
