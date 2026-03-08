const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const logger = require('../utils/logger');

// GET /api/v1/routes - Get all mining routes
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM routes ORDER BY created_at DESC'
    );
    
    res.json({
      success: true,
      routes: result.rows
    });
  } catch (error) {
    logger.error('Error fetching routes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/routes - Create new route
router.post('/', async (req, res) => {
  try {
    const { name, description, waypoints, deviation_threshold_m, expected_duration_min, expected_distance_km } = req.body;
    
    const result = await pool.query(
      `INSERT INTO routes (name, description, waypoints, deviation_threshold_m, expected_duration_min, expected_distance_km)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description || '', JSON.stringify(waypoints), deviation_threshold_m || 50, expected_duration_min, expected_distance_km]
    );
    
    res.status(201).json({
      success: true,
      route: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating route:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
