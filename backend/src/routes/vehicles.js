const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const logger = require('../utils/logger');

// GET /api/v1/vehicles - List all vehicles with pagination and search
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = search ? `%${search}%` : '%%';
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM vehicles 
       WHERE name ILIKE $1 OR type ILIKE $1`,
      [searchTerm]
    );
    const totalCount = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    const result = await pool.query(
      `SELECT id, name, type, active, current_latitude, current_longitude, 
              current_speed_kmh, fuel_percentage, temperature, location, efficiency_rating,
              last_gps_update, updated_at 
       FROM vehicles 
       WHERE name ILIKE $1 OR type ILIKE $1
       ORDER BY id ASC
       LIMIT $2 OFFSET $3`,
      [searchTerm, parseInt(limit), offset]
    );
    
    const vehicles = result.rows.map(v => ({
      id: v.id,
      name: v.name,
      type: v.type,
      active: v.active,
      status: v.active ? 'active' : 'idle',
      current_latitude: parseFloat(v.current_latitude),
      current_longitude: parseFloat(v.current_longitude),
      current_speed_kmh: parseFloat(v.current_speed_kmh),
      fuel: v.fuel_percentage,
      temp: parseFloat(v.temperature),
      location: v.location,
      efficiency: parseFloat(v.efficiency_rating),
      last_gps_update: v.last_gps_update
    }));
    
    res.json({
      success: true,
      data: vehicles,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    logger.error('Error fetching vehicles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/vehicles/:id - Get single vehicle
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM vehicles WHERE id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }
    
    res.json({
      success: true,
      vehicle: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching vehicle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/vehicles/:id/current - Get real-time position
router.get('/:id/current', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, current_latitude, current_longitude, current_speed_kmh, 
              last_gps_update 
       FROM vehicles WHERE id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }
    
    res.json({
      success: true,
      position: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching current position:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/vehicles/:id/history - Get historical GPS data
router.get('/:id/history', async (req, res) => {
  try {
    const { start_time, end_time, limit } = req.query;
    const maxLimit = parseInt(limit) || 1000;
    
    let query = `
      SELECT * FROM gps_points 
      WHERE vehicle_id = $1
    `;
    let params = [req.params.id];
    
    if (start_time) {
      query += ` AND timestamp >= $${params.length + 1}`;
      params.push(start_time);
    }
    
    if (end_time) {
      query += ` AND timestamp <= $${params.length + 1}`;
      params.push(end_time);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(maxLimit);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      points: result.rows.reverse(),
      count: result.rows.length
    });
  } catch (error) {
    logger.error('Error fetching history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
