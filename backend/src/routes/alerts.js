const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const logger = require('../utils/logger');

// GET /api/v1/alerts - Get all alerts with filtering
router.get('/', async (req, res) => {
  try {
    const { vehicle_id, severity, resolved, limit } = req.query;
    const maxLimit = parseInt(limit) || 100;
    
    let query = `SELECT id, vehicle_id, vehicle_name, type, severity, message, resolved, acknowledged, created_at as timestamp
                 FROM alerts 
                 WHERE 1=1`;
    const params = [];
    
    if (vehicle_id) {
      params.push(vehicle_id);
      query += ` AND vehicle_id = $${params.length}`;
    }
    
    if (severity) {
      params.push(severity);
      query += ` AND severity = $${params.length}`;
    }
    
    if (resolved !== undefined) {
      params.push(resolved === 'true');
      query += ` AND resolved = $${params.length}`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(maxLimit);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// POST /api/v1/alerts/:id/resolve - Resolve an alert
router.post('/:id/resolve', async (req, res) => {
  try {
    const { resolved_by, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE alerts SET resolved = true, resolved_at = NOW(), 
       resolved_by = $1, resolution_notes = $2
       WHERE id = $3
       RETURNING *`,
      [resolved_by || 'system', notes || '', req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    
    res.json({
      success: true,
      alert: result.rows[0]
    });
  } catch (error) {
    logger.error('Error resolving alert:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
