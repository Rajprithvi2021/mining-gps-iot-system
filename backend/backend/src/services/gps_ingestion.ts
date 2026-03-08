/**
 * GPS Ingestion Service
 * =====================
 * High-throughput GPS data processor
 *
 * Responsibilities:
 * 1. Receive MQTT GPS updates from edge devices
 * 2. Parse, validate, and normalize coordinates
 * 3. Store in time-series database (TimescaleDB)
 * 4. Detect basic location changes
 * 5. Publish to message queue for downstream processing
 *
 * Expected throughput: 1000 GPS points/second (500 vehicles × 2 Hz)
 * Latency target: <100ms from MQTT → Database
 */

import { EventEmitter } from 'events';
import { Pool } from 'pg';
import * as mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';

import {
  GPSData,
  Vehicle,
  GPSData as InjectionPayload,
  LocationPoint,
} from '../types';

interface GPSIngestConfig {
  mqttBrokerUrl: string;
  mqttUsername?: string;
  mqttPassword?: string;
  mqttTopicPattern: string;  // e.g., "vehicle/+/gps"
  postgresPool: Pool;
  redisClient?: any;
  batchSize: number;
  batchTimeoutMs: number;
}

interface GPSIngestMetrics {
  totalProcessed: number;
  validPoints: number;
  invalidPoints: number;
  avgLatencyMs: number;
  pointsPerSecond: number;
  lastUpdateTime: Date;
}

/**
 * Validates GPS coordinates are within reasonable bounds
 */
function validateCoordinates(lat: number, lon: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Calculates distance between two points (Haversine formula)
 * Used for movement detection
 */
function haversineDistance(p1: LocationPoint, p2: LocationPoint): number {
  const R = 6371;  // Earth's radius in kilometers
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.latitude * Math.PI) / 180) *
      Math.cos((p2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000;  // Convert to meters
}

export class GPSIngestionService extends EventEmitter {
  private config: GPSIngestConfig;
  private mqttClient: mqtt.MqttClient | null = null;
  private gpsBuffer: Map<number, GPSData[]> = new Map();
  private vehicleCache: Map<string, Vehicle> = new Map();
  private metrics: GPSIngestMetrics = {
    totalProcessed: 0,
    validPoints: 0,
    invalidPoints: 0,
    avgLatencyMs: 0,
    pointsPerSecond: 0,
    lastUpdateTime: new Date(),
  };
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(config: GPSIngestConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize MQTT connection and start processing
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.mqttClient = mqtt.connect(this.config.mqttBrokerUrl, {
          username: this.config.mqttUsername,
          password: this.config.mqttPassword,
          clientId: `gps-ingest-${uuidv4().slice(0, 8)}`,
          clean: true,
          reconnectPeriod: 3000,
        });

        this.mqttClient.on('connect', () => {
          console.log('✅ MQTT connected');

          // Subscribe to all GPS topics
          this.mqttClient!.subscribe(
            this.config.mqttTopicPattern,
            (err) => {
              if (err) {
                console.error('❌ MQTT subscription error:', err);
                reject(err);
              } else {
                console.log(`📡 Subscribed to: ${this.config.mqttTopicPattern}`);

                // Start batch processor
                this.startBatchProcessor();

                // Emit metrics every 10 seconds
                this.startMetricsReporter();

                resolve();
              }
            }
          );
        });

        this.mqttClient.on('message', (topic, payload) => {
          this.handleGPSMessage(topic, payload);
        });

        this.mqttClient.on('error', (err) => {
          console.error('❌ MQTT error:', err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Handle incoming MQTT GPS message
   */
  private async handleGPSMessage(
    topic: string,
    payload: Buffer
  ): Promise<void> {
    const start = Date.now();

    try {
      // Parse MQTT topic: vehicle/{vehicle_id}/gps
      const parts = topic.split('/');
      if (parts.length < 3) {
        this.metrics.invalidPoints++;
        return;
      }

      const vehicleId = parts[1];
      const data = JSON.parse(payload.toString());

      // Validate structure
      if (!data.latitude || !data.longitude || !data.timestamp) {
        this.metrics.invalidPoints++;
        return;
      }

      // Validate coordinates
      if (!validateCoordinates(data.latitude, data.longitude)) {
        this.metrics.invalidPoints++;
        return;
      }

      // Look up vehicle ID from database
      const vehicle = await this.resolveVehicle(vehicleId);
      if (!vehicle) {
        console.warn(`⚠️ Unknown vehicle: ${vehicleId}`);
        this.metrics.invalidPoints++;
        return;
      }

      // Create GPS record
      const gpsRecord: GPSData = {
        timestamp: new Date(data.timestamp),
        vehicleId: vehicle.id,
        latitude: data.latitude,
        longitude: data.longitude,
        speedKmh: data.speed_kmh || 0,
        altitudeM: data.altitude_m,
        satellites: data.satellites,
        hdop: data.hdop,
        accuracyM: data.accuracy_m,
      };

      // Add to buffer for batch processing
      if (!this.gpsBuffer.has(vehicle.id)) {
        this.gpsBuffer.set(vehicle.id, []);
      }
      this.gpsBuffer.get(vehicle.id)!.push(gpsRecord);

      // Track metrics
      this.metrics.validPoints++;
      this.metrics.totalProcessed++;
      const latency = Date.now() - start;
      this.metrics.avgLatencyMs =
        (this.metrics.avgLatencyMs + latency) / 2;

      // Emit for real-time subscriptions
      this.emit('gps-update', {
        vehicleId: vehicle.id,
        location: {
          latitude: gpsRecord.latitude,
          longitude: gpsRecord.longitude,
        },
        speedKmh: gpsRecord.speedKmh,
        timestamp: gpsRecord.timestamp,
      });
    } catch (err) {
      console.error('❌ Error processing GPS message:', err);
      this.metrics.invalidPoints++;
    }
  }

  /**
   * Resolve string vehicle ID to database Vehicle record
   * (Uses cache to avoid lookups)
   */
  private async resolveVehicle(vehicleId: string): Promise<Vehicle | null> {
    // Check cache first
    if (this.vehicleCache.has(vehicleId)) {
      return this.vehicleCache.get(vehicleId)!;
    }

    // Query database
    try {
      const result = await this.config.postgresPool.query(
        'SELECT id, org_id, vehicle_id, type, model, status FROM vehicles WHERE vehicle_id = $1',
        [vehicleId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const vehicle: Vehicle = {
        id: result.rows[0].id,
        orgId: result.rows[0].org_id,
        vehicleId: result.rows[0].vehicle_id,
        type: result.rows[0].type,
        model: result.rows[0].model,
        status: result.rows[0].status,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Cache for 1 hour
      this.vehicleCache.set(vehicleId, vehicle);
      setTimeout(() => {
        this.vehicleCache.delete(vehicleId);
      }, 3600000);

      return vehicle;
    } catch (err) {
      console.error('❌ Database error resolving vehicle:', err);
      return null;
    }
  }

  /**
   * Process buffered GPS data in batches
   */
  private startBatchProcessor(): void {
    this.batchTimer = setInterval(async () => {
      const allPoints: Array<{
        vehicleId: number;
        timestamp: Date;
        latitude: number;
        longitude: number;
        speedKmh: number;
        altitudeM?: number;
        satellites?: number;
        hdop?: number;
        accuracyM?: number;
      }> = [];

      // Collect all buffered points
      for (const [vehicleId, points] of this.gpsBuffer) {
        if (points.length > 0) {
          allPoints.push(
            ...points.map((p) => ({
              vehicleId,
              timestamp: p.timestamp,
              latitude: p.latitude,
              longitude: p.longitude,
              speedKmh: p.speedKmh,
              altitudeM: p.altitudeM,
              satellites: p.satellites,
              hdop: p.hdop,
              accuracyM: p.accuracyM,
            }))
          );
          points.length = 0;  // Clear buffer
        }
      }

      if (allPoints.length > 0) {
        await this.writeToDB(allPoints);
      }
    }, this.config.batchTimeoutMs);
  }

  /**
   * Write batch of GPS points to PostgreSQL
   */
  private async writeToDB(
    points: Array<{
      vehicleId: number;
      timestamp: Date;
      latitude: number;
      longitude: number;
      speedKmh: number;
      altitudeM?: number;
      satellites?: number;
      hdop?: number;
      accuracyM?: number;
    }>
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO gps_data (
          time, vehicle_id, latitude, longitude, speed_kmh, 
          altitude_m, satellites, hdop, accuracy_m, location
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 
                  ST_SetSRID(ST_Point($4, $3), 4326))
      `;

      // Use connection pool for concurrency
      const client = await this.config.postgresPool.connect();
      try {
        await client.query('BEGIN');

        for (const point of points) {
          await client.query(query, [
            point.timestamp,
            point.vehicleId,
            point.latitude,
            point.longitude,
            point.speedKmh,
            point.altitudeM,
            point.satellites,
            point.hdop,
            point.accuracyM,
          ]);
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      console.log(`✅ Wrote ${points.length} GPS points to database`);
    } catch (err) {
      console.error('❌ Database write error:', err);
    }
  }

  /**
   * Emit metrics every 10 seconds
   */
  private startMetricsReporter(): void {
    setInterval(() => {
      const timeDiff =
        (new Date().getTime() -
          this.metrics.lastUpdateTime.getTime()) /
        1000;
      this.metrics.pointsPerSecond =
        this.metrics.validPoints / timeDiff;
      this.metrics.lastUpdateTime = new Date();

      this.emit('metrics', { ...this.metrics });
      console.log(
        `📊 GPS Ingestion: ${this.metrics.validPoints} valid/sec, ` +
        `${this.metrics.avgLatencyMs.toFixed(1)}ms latency`
      );
    }, 10000);
  }

  /**
   * Get current metrics
   */
  getMetrics(): GPSIngestMetrics {
    return { ...this.metrics };
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    if (this.mqttClient) {
      await new Promise<void>((resolve, reject) => {
        this.mqttClient!.end(false, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log('✅ GPS Ingestion Service disconnected');
  }
}
