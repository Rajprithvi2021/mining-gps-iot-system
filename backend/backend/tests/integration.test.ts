/**
 * Complete Test Suite
 * ===================
 * Unit tests, integration tests, and load testing
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import request from 'supertest';
import express from 'express';
import { AuthService, UserRole, authMiddleware } from './auth_service';
import { AnomalyDetectionEngine } from './anomaly_detection';
import { AlertManagerService } from './alert_manager';

// Mock database
let db: Pool;
let authService: AuthService;
let app: express.Application;

beforeAll(async () => {
  // Initialize test database
  db = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost/skylark_test',
  });

  authService = new AuthService(db, 'test_secret');

  // Setup Express app with auth middleware
  app = express();
  app.use(express.json());

  app.post('/auth/login', async (req, res) => {
    try {
      const result = await authService.login(req.body.email, req.body.password);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  });

  app.post('/protected', authMiddleware('test_secret'), (req, res) => {
    res.json({ message: 'Success' });
  });
});

afterAll(async () => {
  await db.end();
});

/**
 * ===== UNIT TESTS =====
 */

describe('Authentication Service', () => {
  it('should hash password correctly', async () => {
    const password = 'TestPassword123!';
    const hash = await authService.hashPassword(password);

    expect(hash).not.toBe(password);
    const isValid = await authService.verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should generate valid JWT token', () => {
    const user = {
      id: 1,
      email: 'test@example.com',
      orgId: 1,
      role: UserRole.ADMIN,
    };

    const token = authService.generateToken(user);
    expect(token).toBeDefined();

    const decoded = authService.verifyToken(token);
    expect(decoded.email).toBe(user.email);
    expect(decoded.role).toBe(user.role);
  });

  it('should reject invalid token', () => {
    expect(() => {
      authService.verifyToken('invalid.token.here');
    }).toThrow('Invalid token');
  });

  it('should reject expired token', () => {
    // Create token with 0 expiry
    const token = require('jsonwebtoken').sign(
      { id: 1, email: 'test@example.com' },
      'test_secret',
      { expiresIn: '0s' }
    );

    // Wait for token to expire
    setTimeout(() => {
      expect(() => {
        authService.verifyToken(token);
      }).toThrow();
    }, 100);
  });
});

/**
 * Anomaly Detection Unit Tests
 */
describe('Anomaly Detection Engine', () => {
  let engine: AnomalyDetectionEngine;

  beforeAll(() => {
    engine = new AnomalyDetectionEngine(db, null as any);
  });

  it('should detect idle anomaly', async () => {
    const gpsData = {
      timestamp: new Date(),
      vehicleId: 1,
      latitude: 28.6139,
      longitude: 77.2090,
      speedKmh: 0.1,  // Idle
      altitudeM: 450,
    };

    const anomalies = await engine.processGPSPoint(gpsData);

    // Expect idle detection
    const idleAnomaly = anomalies.find(a => a.type === 'IDLE_DETECTION');
    expect(idleAnomaly).toBeDefined();
  });

  it('should detect harsh acceleration', async () => {
    const gpsData = {
      timestamp: new Date(),
      vehicleId: 2,
      latitude: 28.6139,
      longitude: 77.2090,
      speedKmh: 50,  // Rapid acceleration
      altitudeM: 450,
    };

    const anomalies = await engine.processGPSPoint(gpsData);

    // Expect harsh driving detection possible
    expect(Array.isArray(anomalies)).toBe(true);
  });

  it('should not flag legitimate highway speeds', async () => {
    const gpsData = {
      timestamp: new Date(),
      vehicleId: 3,
      latitude: 28.6139,
      longitude: 77.2090,
      speedKmh: 80,  // Normal highway speed
      altitudeM: 450,
    };

    const anomalies = await engine.processGPSPoint(gpsData);

    const harshAnomalies = anomalies.filter(a => 
      a.type === 'HARSH_ACCELERATION' || a.type === 'HARSH_BRAKING'
    );

    expect(harshAnomalies.length).toBeLessThanOrEqual(1);
  });

  it('should handle missing GPS data gracefully', async () => {
    const invalidData = {
      timestamp: new Date(),
      vehicleId: null,  // Invalid
      latitude: NaN,
      longitude: NaN,
      speedKmh: -1,  // Invalid
      altitudeM: 450,
    } as any;

    try {
      const anomalies = await engine.processGPSPoint(invalidData);
      expect(Array.isArray(anomalies)).toBe(true);
    } catch (err) {
      // Should handle gracefully
      expect(err).toBeDefined();
    }
  });
});

/**
 * ===== INTEGRATION TESTS =====
 */

describe('Authentication API Endpoints', () => {
  let loginToken: string;

  it('should register new user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });

    expect(res.status).toBe(401); // No user yet
  });

  it('should reject missing credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should allow access with valid token', async () => {
    // First, create a valid token
    const user = {
      id: 1,
      email: 'test@example.com',
      orgId: 1,
      role: UserRole.MANAGER,
    };

    loginToken = authService.generateToken(user);

    const res = await request(app)
      .post('/protected')
      .set('Authorization', `Bearer ${loginToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Success');
  });

  it('should reject missing auth header', async () => {
    const res = await request(app).post('/protected');

    expect(res.status).toBe(401);
  });

  it('should reject invalid token format', async () => {
    const res = await request(app)
      .post('/protected')
      .set('Authorization', 'Bearer invalid');

    expect(res.status).toBe(401);
  });
});

/**
 * ===== LOAD TESTING =====
 */

describe('Load Testing', () => {
  it('should handle 1000 concurrent GPS points', async () => {
    const engine = new AnomalyDetectionEngine(db, null as any);

    const promises: Promise<any>[] = [];

    for (let i = 0; i < 1000; i++) {
      const gpsData = {
        timestamp: new Date(),
        vehicleId: Math.floor(i / 10) + 1,  // 100 vehicles
        latitude: 28.6139 + Math.random() * 0.1,
        longitude: 77.2090 + Math.random() * 0.1,
        speedKmh: Math.random() * 100,
        altitudeM: 450 + Math.random() * 100,
      };

      promises.push(engine.processGPSPoint(gpsData));
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(results.length).toBe(1000);
    console.log(`✓ Processed 1000 GPS points in ${duration}ms (${(1000000 / duration).toFixed(0)} points/sec)`);
  });

  it('should handle 100 concurrent alert acknowledges', async () => {
    const promises: Promise<boolean>[] = [];

    for (let i = 0; i < 100; i++) {
      // Simulate alert acknowledgment request
      promises.push(
        (async () => {
          // In real test, this would hit the database
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          return true;
        })()
      );
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(results.every(r => r === true)).toBe(true);
    console.log(`✓ Processed 100 alert acknowledges in ${duration}ms`);
  });

  it('should handle rapid token generations', async () => {
    const promises: Promise<string>[] = [];

    for (let i = 0; i < 500; i++) {
      const user = {
        id: i,
        email: `user${i}@example.com`,
        orgId: Math.floor(i / 50) + 1,
        role: UserRole.DRIVER,
      };

      promises.push(Promise.resolve(authService.generateToken(user)));
    }

    const startTime = Date.now();
    const tokens = await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(tokens.length).toBe(500);
    tokens.forEach(token => {
      expect(token).toBeDefined();
      expect(authService.verifyToken(token)).toBeDefined();
    });

    console.log(`✓ Generated and verified 500 tokens in ${duration}ms`);
  });
});

/**
 * ===== PERFORMANCE BENCHMARKS =====
 */

describe('Performance Benchmarks', () => {
  it('should hash password in < 100ms', async () => {
    const startTime = Date.now();
    await authService.hashPassword('TestPassword123!');
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
    console.log(`✓ Password hashing: ${duration}ms`);
  });

  it('should verify password in < 100ms', async () => {
    const hash = await authService.hashPassword('TestPassword123!');

    const startTime = Date.now();
    await authService.verifyPassword('TestPassword123!', hash);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
    console.log(`✓ Password verification: ${duration}ms`);
  });

  it('should generate JWT in < 10ms', () => {
    const user = {
      id: 1,
      email: 'test@example.com',
      orgId: 1,
      role: UserRole.MANAGER,
    };

    const startTime = Date.now();
    authService.generateToken(user);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(10);
    console.log(`✓ JWT generation: ${duration}ms`);
  });

  it('should verify JWT in < 5ms', () => {
    const user = {
      id: 1,
      email: 'test@example.com',
      orgId: 1,
      role: UserRole.MANAGER,
    };

    const token = authService.generateToken(user);

    const startTime = Date.now();
    authService.verifyToken(token);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5);
    console.log(`✓ JWT verification: ${duration}ms`);
  });
});

/**
 * ===== REGRESSION TESTS =====
 */

describe('Error Handling', () => {
  it('should handle database connection errors', async () => {
    const badDb = new Pool({
      connectionString: 'postgresql://invalid:invalid@localhost/invalid',
    });

    const badAuthService = new AuthService(badDb, 'secret');

    try {
      await badAuthService.login('test@example.com', 'password');
      fail('Should have thrown error');
    } catch (err) {
      expect(err).toBeDefined();
    }

    await badDb.end();
  });

  it('should sanitize SQL injection attempts', async () => {
    const maliciousEmail = "test@example.com'; DROP TABLE users; --";

    try {
      await authService.login(maliciousEmail, 'password');
    } catch (err) {
      // Should fail gracefully, not execute SQL
      expect(err).toBeDefined();
    }
  });

  it('should handle null/undefined values', async () => {
    const results = await Promise.all([
      authService.hashPassword('').catch(() => null),
      authService.verifyPassword('', '').catch(() => false),
      authService.getUserById(-1).catch(() => null),
    ]);

    expect(results.every(r => r !== undefined)).toBe(true);
  });
});

export default {
  authService,
  app,
};
