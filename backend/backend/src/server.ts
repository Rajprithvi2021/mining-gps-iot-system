/**
 * Main Server Entry Point
 * =======================
 * Initializes Express, GraphQL, WebSocket, and connects all services
 */

import express, { Express, Request, Response } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { Pool } from 'pg';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import winston from 'winston';
import dotenv from 'dotenv';
import mqtt from 'mqtt';

// Load environment variables
dotenv.config();

// Import services
import {
  AuthService,
  setupAuthRoutes,
  authMiddleware,
  UserRole,
  requiredRole,
} from './services/auth_service';
import { AnomalyDetectionEngine } from './services/anomaly_detection';
import { AlertManagerService } from './services/alert_manager';
import { FleetAnalyticsService } from './services/fleet_analytics';
import { createGraphQLServer } from './services/graphql_api';

// ===== Configuration =====

const PORT = parseInt(process.env.PORT || '3000');
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_this';
const DATABASE_URL = process.env.DATABASE_URL;
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';

// ===== Logging =====

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'skylark-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// ===== Database Setup =====

const db = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on('error', (err: Error) => {
  logger.error('Unexpected error on idle client', err);
});

// Test database connection
async function testDatabaseConnection(): Promise<void> {
  try {
    const result = await db.query('SELECT NOW()');
    logger.info('Database connected successfully', {
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    logger.error('Failed to connect to database', err);
    process.exit(1);
  }
}

// ===== MQTT Setup =====

let mqttClient: mqtt.MqttClient;

async function setupMQTT(): Promise<mqtt.MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(MQTT_URL, {
      clientId: 'skylark-api-' + Math.random().toString(16).substr(2, 8),
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
    });

    client.on('connect', () => {
      logger.info('MQTT connected successfully');
      resolve(client);
    });

    client.on('error', (err: Error) => {
      logger.error('MQTT connection error', err);
      reject(err);
    });
  });
}

// ===== Express Setup =====

const app: Express = express();
const httpServer: HTTPServer = createServer(app);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

// ===== Health & Status Endpoints =====

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    environment: NODE_ENV,
  });
});

/**
 * Ready check endpoint (database + MQTT)
 */
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check database
    await db.query('SELECT 1');

    // Check MQTT
    if (!mqttClient || !mqttClient.connected) {
      return res.status(503).json({ ready: false, reason: 'MQTT not connected' });
    }

    res.json({
      ready: true,
      database: 'connected',
      mqtt: 'connected',
      timestamp: new Date(),
    });
  } catch (err) {
    res.status(503).json({
      ready: false,
      reason: 'Database check failed',
      error: (err as Error).message,
    });
  }
});

/**
 * Metrics endpoint
 */
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as anomalies_1h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as anomalies_24h,
        (SELECT COUNT(*) FROM vehicles) as total_vehicles,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM gps_data WHERE time > NOW() - INTERVAL '1 hour') as gps_points_1h
      FROM anomalies
    `);

    res.json(stats.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ===== Service Initialization =====

let authService: AuthService;
let anomalyEngine: AnomalyDetectionEngine;
let alertManager: AlertManagerService;
let fleetAnalytics: FleetAnalyticsService;

async function initializeServices(): Promise<void> {
  logger.info('Initializing services...');

  // Authentication
  authService = new AuthService(db, JWT_SECRET);
  setupAuthRoutes(app, authService);

  // Anomaly Detection
  anomalyEngine = new AnomalyDetectionEngine(db, null); // Queue will be added later

  // Alert Manager
  alertManager = new AlertManagerService(db, null, null); // Queues will be added

  // Fleet Analytics
  fleetAnalytics = new FleetAnalyticsService(db);

  // Wire up event listeners between services
  anomalyEngine.on('anomaly-detected', (anomaly) => {
    alertManager.handleAnomaly(anomaly).catch(err => {
      logger.error('Error handling anomaly', err);
    });
  });

  logger.info('Services initialized successfully');
}

// ===== Socket.IO Setup =====

async function setupSocketIO(): Promise<SocketIOServer> {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || ['http://localhost:3001'],
      methods: ['GET', 'POST'],
    },
  });

  // Middleware - authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Missing authentication token'));
    }

    try {
      const user = authService.verifyToken(token);
      (socket.handshake.auth as any).user = user;
      next();
    } catch (err) {
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection handlers
  io.on('connection', (socket) => {
    const user = (socket.handshake.auth as any).user;
    logger.info(`User ${user.email} connected`, { socketId: socket.id });

    // Subscribe to vehicle updates
    socket.on('subscribe:vehicle', (vehicleId: number) => {
      const room = `vehicle:${vehicleId}`;
      socket.join(room);
      logger.info(`User subscribed to vehicle ${vehicleId}`, { socketId: socket.id });
    });

    // Subscribe to organization alerts
    socket.on('subscribe:alerts', () => {
      const room = `org:${user.orgId}:alerts`;
      socket.join(room);
      logger.info(`User subscribed to organization alerts`, { socketId: socket.id });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User ${user.email} disconnected`, { socketId: socket.id });
    });
  });

  // Emit events from services to connected clients
  alertManager.on('alert-created', (alert) => {
    io.to(`org:${alert.org_id}:alerts`).emit('alert:new', alert);
    io.to(`vehicle:${alert.vehicle_id}`).emit('alert:new', alert);
  });

  anomalyEngine.on('anomaly-detected', (anomaly) => {
    io.to(`vehicle:${anomaly.vehicle_id}`).emit('anomaly:detected', anomaly);
  });

  return io;
}

// ===== API Routes =====

/**
 * Protected test endpoint
 */
app.get(
  '/api/protected',
  authMiddleware(JWT_SECRET),
  (req: Request, res: Response) => {
    res.json({ message: 'This is a protected endpoint' });
  }
);

/**
 * Admin-only endpoint
 */
app.get(
  '/api/admin/stats',
  authMiddleware(JWT_SECRET),
  requiredRole(UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT
          COUNT(DISTINCT vehicle_id) as total_vehicles,
          COUNT(DISTINCT user_id) as total_users,
          COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical_anomalies,
          COUNT(*) FILTER (WHERE severity = 'HIGH') as high_anomalies
        FROM anomalies
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);

      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ===== Error Handling =====

app.use((err: any, req: Request, res: Response) => {
  logger.error('Unhandled error', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    requestId: req.id,
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ===== Server Startup =====

async function startServer(): Promise<void> {
  try {
    // Test and setup database
    await testDatabaseConnection();

    // Setup MQTT
    mqttClient = await setupMQTT();

    // Initialize services
    await initializeServices();

    // Setup GraphQL
    await createGraphQLServer(app, httpServer, db, JWT_SECRET);

    // Setup Socket.IO
    await setupSocketIO();

    // Start listening
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`, {
        environment: NODE_ENV,
        graphql: `http://0.0.0.0:${PORT}/graphql`,
      });
    });

  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

// ===== Graceful Shutdown =====

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  mqttClient.end();
  await db.end();

  logger.info('Server shutdown complete');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  mqttClient.end();
  await db.end();

  logger.info('Server shutdown complete');
  process.exit(0);
});

// ===== Start the Server =====

if (require.main === module) {
  startServer().catch(err => {
    logger.error('Fatal error during startup', err);
    process.exit(1);
  });
}

export { app, httpServer, db, authService };

    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Endpoints:`);
  console.log(`   - Health: http://localhost:${PORT}/health`);
  console.log(`   - GraphQL: http://localhost:${PORT}/graphql`);
});
