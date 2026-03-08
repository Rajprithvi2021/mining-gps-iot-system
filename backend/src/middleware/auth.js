// Authentication & Authorization Middleware
const logger = require('../utils/logger');

// API Key authentication
const apiKeyAuth = (req, res, next) => {
  // Skip auth for health check and public endpoints
  if (req.path === '/health' || req.path === '/') {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.API_KEY || 'sk-default-key-change-in-production';

  if (!apiKey || apiKey !== validKey) {
    logger.warn(`Unauthorized API key attempt from ${req.ip}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid or missing API key'
    });
  }

  next();
};

// JWT-like token for Pi devices
const piDeviceAuth = (req, res, next) => {
  const deviceId = req.headers['x-device-id'];
  const deviceToken = req.headers['x-device-token'];

  if (!deviceId || !deviceToken) {
    return res.status(401).json({
      success: false,
      error: 'Device authentication required'
    });
  }

  // In production, validate against database
  // For now, accept any device ID with matching token pattern
  if (deviceToken.length < 20) {
    logger.warn(`Invalid device token from ${deviceId}`);
    return res.status(401).json({
      success: false,
      error: 'Invalid device token'
    });
  }

  // Attach device info to request
  req.device = { id: deviceId, type: 'pi' };
  next();
};

// Input validation middleware
const validateGPSData = (req, res, next) => {
  const { vehicle_id, gps_points } = req.body;

  // Validate vehicle_id
  if (!vehicle_id || typeof vehicle_id !== 'string') {
    return res.status(400).json({
      success: false,
      errors: [{ param: 'vehicle_id', msg: 'Valid vehicle_id required' }]
    });
  }

  // Validate gps_points
  if (!Array.isArray(gps_points) || gps_points.length === 0) {
    return res.status(400).json({
      success: false,
      errors: [{ param: 'gps_points', msg: 'gps_points must be non-empty array' }]
    });
  }

  // Validate each GPS point
  for (let i = 0; i < gps_points.length; i++) {
    const point = gps_points[i];

    if (typeof point.latitude !== 'number' || point.latitude < -90 || point.latitude > 90) {
      return res.status(400).json({
        success: false,
        errors: [{ param: `gps_points[${i}].latitude`, msg: 'Invalid latitude' }]
      });
    }

    if (typeof point.longitude !== 'number' || point.longitude < -180 || point.longitude > 180) {
      return res.status(400).json({
        success: false,
        errors: [{ param: `gps_points[${i}].longitude`, msg: 'Invalid longitude' }]
      });
    }

    if (point.speed_kmh && (typeof point.speed_kmh !== 'number' || point.speed_kmh < 0)) {
      return res.status(400).json({
        success: false,
        errors: [{ param: `gps_points[${i}].speed_kmh`, msg: 'Speed must be non-negative' }]
      });
    }

    if (!point.timestamp || isNaN(new Date(point.timestamp).getTime())) {
      return res.status(400).json({
        success: false,
        errors: [{ param: `gps_points[${i}].timestamp`, msg: 'Valid ISO timestamp required' }]
      });
    }
  }

  next();
};

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Remove any dangerous characters from string inputs
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/[<>\"']/g, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [key, sanitize(value)])
      );
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);

  next();
};

// Request signing for integrity verification
const verifyRequestSignature = (req, res, next) => {
  const signature = req.headers['x-signature'];
  
  // Skip verification for now (optional feature)
  // In production: hash body + secret + timestamp and compare with signature
  
  next();
};

module.exports = {
  apiKeyAuth,
  piDeviceAuth,
  validateGPSData,
  sanitizeInput,
  verifyRequestSignature
};
