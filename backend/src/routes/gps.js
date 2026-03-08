const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../utils/database');
const logger = require('../utils/logger');

// POST /api/v1/gps-data - Receive GPS data from Pi/Simulator
router.post('/', [
  body('vehicle_id').trim().notEmpty().withMessage('vehicle_id required'),
  body('gps_points').isArray().withMessage('gps_points must be array'),
  body('timestamp').trim().notEmpty().withMessage('timestamp required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { vehicle_id, gps_points, alerts, fuel_metrics } = req.body;

  try {
    // Verify vehicle exists
    const vehicleResult = await pool.query(
      'SELECT id FROM vehicles WHERE id = $1',
      [vehicle_id]
    );
    
    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    let inserted_count = 0;

    // Insert GPS points
    for (const point of gps_points) {
      await pool.query(
        `INSERT INTO gps_points (vehicle_id, latitude, longitude, speed_kmh, 
         heading_degrees, accuracy_m, satellites_count, timestamp, gps_source) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          vehicle_id,
          point.latitude,
          point.longitude,
          point.speed_kmh || 0,
          point.heading_degrees || null,
          point.accuracy_m || 5,
          point.satellites || null,
          point.timestamp,
          point.gps_source || 'GPS_1'
        ]
      );
      inserted_count++;
    }

    // Update vehicle current position
    if (gps_points.length > 0) {
      const lastPoint = gps_points[gps_points.length - 1];
      await pool.query(
        `UPDATE vehicles SET current_latitude = $1, current_longitude = $2, 
         current_speed_kmh = $3, last_gps_update = $4, updated_at = NOW()
         WHERE id = $5`,
        [
          lastPoint.latitude,
          lastPoint.longitude,
          lastPoint.speed_kmh || 0,
          new Date().toISOString(),
          vehicle_id
        ]
      );
    }

    // Insert alerts if any
    if (alerts && alerts.length > 0) {
      for (const alert of alerts) {
        await pool.query(
          `INSERT INTO alerts (vehicle_id, alert_type, severity, latitude, longitude, 
           timestamp, description, metadata) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            vehicle_id,
            alert.type,
            alert.severity || 'medium',
            alert.latitude || lastPoint.latitude,
            alert.longitude || lastPoint.longitude,
            alert.timestamp,
            alert.description || '',
            JSON.stringify(alert.metadata || {})
          ]
        );
      }
    }

    logger.info(`Received ${inserted_count} GPS points from ${vehicle_id}`);

    res.json({
      success: true,
      received_count: inserted_count,
      alerts_count: alerts ? alerts.length : 0
    });

  } catch (error) {
    logger.error('Error processing GPS data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
