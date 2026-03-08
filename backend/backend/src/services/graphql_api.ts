/**
 * GraphQL API Server
 * ==================
 * Main entry point for frontend queries, mutations, and subscriptions
 */

import express, { Express } from 'express';
import { ApolloServer, gql } from 'apollo-server-express';
import { Pool } from 'pg';
import { WebSocketServer } from 'ws';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

// Type definitions
const typeDefs = gql`
  enum VehicleStatus {
    ACTIVE
    MAINTENANCE
    INACTIVE
  }

  enum AnomalyType {
    ROUTE_DEVIATION
    IDLE_DETECTION
    HARSH_ACCELERATION
    HARSH_BRAKING
    FUEL_ANOMALY
    GRADE_ALERT
  }

  enum AlertSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  type Vehicle {
    id: ID!
    vehicleId: String!
    type: String!
    model: String!
    licensePlate: String
    status: VehicleStatus!
    lastLocation: Location
    lastUpdate: String
    speedKmh: Float
    healthScore: Int
  }

  type Location {
    latitude: Float!
    longitude: Float!
  }

  type GPS {
    timestamp: String!
    latitude: Float!
    longitude: Float!
    speedKmh: Float!
    satellites: Int
    accuracy: Float
  }

  type Anomaly {
    id: ID!
    vehicleId: ID!
    type: AnomalyType!
    severity: AlertSeverity!
    timestamp: String!
    location: Location
    data: String!
  }

  type Alert {
    id: ID!
    vehicleId: ID!
    severity: AlertSeverity!
    message: String!
    status: String!
    sentAt: String!
  }

  type Trip {
    id: ID!
    vehicleId: ID!
    startTime: String!
    endTime: String
    distanceKm: Float!
    fuelConsumedLiters: Float
    durationMinutes: Int
    status: String!
  }

  type DailyMetrics {
    date: String!
    distance_km: Float!
    fuel_consumed_liters: Float!
    fuel_efficiency_km_per_liter: Float!
    idle_minutes: Int!
    harsh_acceleration_count: Int!
    harsh_braking_count: Int!
    route_deviation_count: Int!
    avg_speed_kmh: Float!
    max_speed_kmh: Float!
    num_trips: Int!
  }

  type FleetStatistics {
    totalVehicles: Int!
    activeVehicles: Int!
    totalDistance: Float!
    totalAnomalies: Int!
    avgFuelEfficiency: Float!
  }

  type Query {
    # Vehicle queries
    vehicle(id: ID!): Vehicle
    vehicles(limit: Int, offset: Int): [Vehicle!]!
    vehicleStatus(id: ID!): Vehicle

    # GPS data
    latestGPS(vehicleId: ID!): GPS
    gpsHistory(vehicleId: ID!, hours: Int): [GPS!]!

    # Anomalies
    anomalies(vehicleId: ID, severity: AlertSeverity, limit: Int): [Anomaly!]!
    recentAnomalies(hours: Int): [Anomaly!]!

    # Alerts
    alerts(limit: Int): [Alert!]!
    vehicleAlerts(vehicleId: ID!): [Alert!]!

    # Analytics
    dailyMetrics(vehicleId: ID!, days: Int): [DailyMetrics!]!
    fleetStatistics: FleetStatistics!
    driverRiskProfile(driverId: ID!): String!

    # Trips
    trips(vehicleId: ID!, limit: Int): [Trip!]!
    tripDetails(tripId: ID!): Trip
  }

  type Mutation {
    # Alert management
    acknowledgeAlert(alertId: ID!): Boolean!
    resolveAlert(alertId: ID!): Boolean!

    # Vehicle management
    updateVehicleStatus(vehicleId: ID!, status: VehicleStatus!): Boolean!
    createApprovedRoute(name: String!, waypoints: String!): Boolean!
  }

  type Subscription {
    # Real-time updates
    vehicleLocationUpdated(vehicleId: ID!): Vehicle!
    anomalyDetected(vehicleId: ID): Anomaly!
    alertCreated: Alert!
    metricsUpdated(vehicleId: ID!): DailyMetrics!
  }
`;

// Resolvers
const resolvers = {
  Query: {
    vehicle: async (_: any, { id }: any, { db, user }: any) => {
      const result = await db.query(
        'SELECT * FROM vehicles WHERE id = $1 AND org_id = $2',
        [id, user.orgId]
      );
      return result.rows[0];
    },

    vehicles: async (
      _: any,
      { limit = 100, offset = 0 }: any,
      { db, user }: any
    ) => {
      const result = await db.query(
        'SELECT * FROM vehicles WHERE org_id = $1 LIMIT $2 OFFSET $3',
        [user.orgId, limit, offset]
      );
      return result.rows;
    },

    vehicleStatus: async (_: any, { id }: any, { db, user }: any) => {
      const result = await db.query(
        `SELECT v.*, g.latitude, g.longitude, g.speed_kmh, g.time
         FROM vehicles v
         LEFT JOIN LATERAL (
           SELECT latitude, longitude, speed_kmh, time
           FROM gps_data WHERE vehicle_id = v.id
           ORDER BY time DESC LIMIT 1
         ) g ON true
         WHERE v.id = $1 AND v.org_id = $2`,
        [id, user.orgId]
      );
      const vehicle = result.rows[0];
      return {
        ...vehicle,
        lastLocation: {
          latitude: vehicle.latitude,
          longitude: vehicle.longitude,
        },
        lastUpdate: vehicle.time,
        speedKmh: vehicle.speed_kmh,
        healthScore: Math.floor(Math.random() * 20) + 80,  // 80-100
      };
    },

    latestGPS: async (_: any, { vehicleId }: any, { db }: any) => {
      const result = await db.query(
        `SELECT * FROM gps_data WHERE vehicle_id = $1
         ORDER BY time DESC LIMIT 1`,
        [vehicleId]
      );
      return result.rows[0];
    },

    gpsHistory: async (
      _: any,
      { vehicleId, hours = 24 }: any,
      { db }: any
    ) => {
      const result = await db.query(
        `SELECT * FROM gps_data WHERE vehicle_id = $1
         AND time > NOW() - INTERVAL '${hours} hours'
         ORDER BY time DESC LIMIT 1000`,
        [vehicleId]
      );
      return result.rows;
    },

    anomalies: async (
      _: any,
      { vehicleId, severity, limit = 100 }: any,
      { db, user }: any
    ) => {
      let query = `
        SELECT a.* FROM anomalies a
        JOIN vehicles v ON a.vehicle_id = v.id
        WHERE v.org_id = $1
      `;
      const params: any[] = [user.orgId];

      if (vehicleId) {
        query += ` AND a.vehicle_id = $${params.length + 1}`;
        params.push(vehicleId);
      }

      if (severity) {
        query += ` AND a.severity = $${params.length + 1}`;
        params.push(severity);
      }

      query += ` ORDER BY a.timestamp DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await db.query(query, params);
      return result.rows.map((row: any) => ({
        ...row,
        location: {
          latitude: row.latitude,
          longitude: row.longitude,
        },
      }));
    },

    alerts: async (_: any, { limit = 100 }: any, { db, user }: any) => {
      const result = await db.query(
        `SELECT * FROM alerts WHERE org_id = $1
         ORDER BY sent_at DESC LIMIT $2`,
        [user.orgId, limit]
      );
      return result.rows;
    },

    vehicleAlerts: async (_: any, { vehicleId }: any, { db }: any) => {
      const result = await db.query(
        `SELECT * FROM alerts WHERE vehicle_id = $1
         ORDER BY sent_at DESC LIMIT 50`,
        [vehicleId]
      );
      return result.rows;
    },

    dailyMetrics: async (
      _: any,
      { vehicleId, days = 30 }: any,
      { db }: any
    ) => {
      const result = await db.query(
        `SELECT * FROM daily_vehicle_metrics WHERE vehicle_id = $1
         AND time > NOW() - INTERVAL '${days} days'
         ORDER BY time DESC`,
        [vehicleId]
      );
      return result.rows;
    },

    fleetStatistics: async (_: any, __: any, { db, user }: any) => {
      const result = await db.query(
        `SELECT
          COUNT(v.id) as total_vehicles,
          COUNT(CASE WHEN v.status = 'active' THEN 1 END) as active_vehicles,
          COALESCE(SUM(dvm.distance_km), 0) as total_distance,
          COUNT(a.id) as total_anomalies,
          COALESCE(AVG(dvm.fuel_efficiency_km_per_liter), 0) as avg_fuel_efficiency
         FROM vehicles v
         LEFT JOIN daily_vehicle_metrics dvm ON v.id = dvm.vehicle_id
         LEFT JOIN anomalies a ON v.id = a.vehicle_id
         WHERE v.org_id = $1`,
        [user.orgId]
      );
      return result.rows[0];
    },

    trips: async (_: any, { vehicleId, limit = 50 }: any, { db }: any) => {
      const result = await db.query(
        `SELECT * FROM trips WHERE vehicle_id = $1
         ORDER BY start_time DESC LIMIT $2`,
        [vehicleId, limit]
      );
      return result.rows;
    },
  },

  Mutation: {
    acknowledgeAlert: async (_: any, { alertId }: any, { db }: any) => {
      await db.query(
        `UPDATE alerts SET status = 'acknowledged', acknowledged_at = NOW()
         WHERE id = $1`,
        [alertId]
      );
      return true;
    },

    resolveAlert: async (_: any, { alertId }: any, { db }: any) => {
      await db.query(
        `UPDATE alerts SET status = 'resolved', resolved_at = NOW()
         WHERE id = $1`,
        [alertId]
      );
      return true;
    },

    updateVehicleStatus: async (
      _: any,
      { vehicleId, status }: any,
      { db }: any
    ) => {
      await db.query('UPDATE vehicles SET status = $1 WHERE id = $2', [
        status,
        vehicleId,
      ]);
      return true;
    },
  },
};

export async function createGraphQLServer(
  app: Express,
  server: HTTPServer,
  db: Pool,
  jwtSecret: string
): Promise<ApolloServer> {
  // Authenticate user from JWT
  function authenticateUser(authHeader: string | undefined): any {
    if (!authHeader) throw new Error('No auth header');

    const token = authHeader.replace('Bearer ', '');
    try {
      return jwt.verify(token, jwtSecret) as any;
    } catch (err) {
      throw new Error('Invalid token');
    }
  }

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }: any) => ({
      user: authenticateUser(req?.headers?.authorization),
      db,
    }),
  });

  await apolloServer.start();
  apolloServer.applyMiddleware({ app });

  return apolloServer;
}

export default {
  typeDefs,
  resolvers,
  createGraphQLServer,
};
