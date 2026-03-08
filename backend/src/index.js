require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

// Import routes
const gpsRoutes = require('./routes/gps');
const vehicleRoutes = require('./routes/vehicles');
const alertRoutes = require('./routes/alerts');
const dashboardRoutes = require('./routes/dashboard');
const routeRoutes = require('./routes/routes');
const analyticsRoutes = require('./routes/analytics');
const reportingRoutes = require('./routes/reports');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 1000,            // 1000 requests per minute
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/v1/gps-data', gpsRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/routes', routeRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/reports', reportingRoutes);

// WebSocket connection
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('subscribe_vehicle', (vehicleId) => {
    socket.join(`vehicle_${vehicleId}`);
    logger.debug(`Client subscribed to vehicle: ${vehicleId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`, err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Mining GPS Backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Export for testing
module.exports = { app, io };
