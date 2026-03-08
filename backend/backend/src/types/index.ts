/**
 * Core TypeScript Types & Interfaces
 * ===================================
 * Shared type definitions across all backend services
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum VehicleType {
  TRUCK = 'truck',
  EXCAVATOR = 'excavator',
  TIPPER = 'tipper',
  DOZER = 'dozer',
  LOADER = 'loader',
}

export enum AnomalyType {
  ROUTE_DEVIATION = 'ROUTE_DEVIATION',
  IDLE_DETECTION = 'IDLE_DETECTION',
  HARSH_ACCELERATION = 'HARSH_ACCELERATION',
  HARSH_BRAKING = 'HARSH_BRAKING',
  FUEL_ANOMALY = 'FUEL_ANOMALY',
  GRADE_ALERT = 'GRADE_ALERT',
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  NEW = 'new',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  DRIVER = 'driver',
  ANALYST = 'analyst',
}

export enum LoadState {
  EMPTY = 'EMPTY',
  HALF_LOADED = 'HALF_LOADED',
  FULL = 'FULL',
  UNKNOWN = 'UNKNOWN',
}

// ============================================================================
// GPS & LOCATION DATA
// ============================================================================

export interface GPSData {
  timestamp: Date;
  vehicleId: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  altitudeM?: number;
  satellites?: number;
  hdop?: number;  // Horizontal Dilution of Precision
  accuracyM?: number;
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
}

export interface GeoBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

// ============================================================================
// VEHICLES & FLEET
// ============================================================================

export interface Vehicle {
  id: number;
  orgId: number;
  vehicleId: string;  // e.g., "MINE-001"
  type: VehicleType;
  model: string;
  licensePlate?: string;
  capacityTons?: number;
  fuelTankCapacityLiters?: number;
  vin?: string;
  status: 'active' | 'maintenance' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Driver {
  id: number;
  orgId: number;
  name: string;
  employeeId?: string;
  driverLicenseNumber?: string;
  status: 'active' | 'inactive' | 'training';
}

export interface Trip {
  id: number;
  vehicleId: number;
  orgId: number;
  startTime: Date;
  endTime?: Date;
  distanceKm: number;
  fuelConsumedLiters?: number;
  durationMinutes?: number;
  loadState?: LoadState;
  loadConfidence?: number;
  numAnomalies: number;
  anomalySummary?: Record<string, number>;
  status: 'ongoing' | 'completed' | 'paused';
}

// ============================================================================
// ANOMALIES & ALERTS
// ============================================================================

export interface Anomaly {
  id: number;
  vehicleId: number;
  anomalyType: AnomalyType;
  severity: AlertSeverity;
  latitude?: number;
  longitude?: number;
  timestamp: Date;
  durationSec?: number;
  data: Record<string, any>;  // Flexible schema
  humanReviewed: boolean;
  notes?: string;
}

export interface Alert {
  id: number;
  orgId: number;
  anomalyId?: number;
  vehicleId: number;
  alertType: string;
  severity: AlertSeverity;
  message: string;
  status: AlertStatus;
  sentAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

// ============================================================================
// METRICS & ANALYTICS
// ============================================================================

export interface DailyMetrics {
  vehicleId: number;
  date: Date;
  distanceKm: number;
  fuelConsumedLiters: number;
  fuelEfficiencyKmPerLiter: number;
  idleMinutes: number;
  harshAccelerationCount: number;
  harshBrakingCount: number;
  routeDeviationCount: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  numTrips: number;
}

export interface VehicleStatus {
  vehicleId: number;
  lastLocation: LocationPoint;
  lastUpdate: Date;
  speedKmh: number;
  isActive: boolean;
  recentAlerts: Alert[];
  healthScore: number;  // 0-100
}

export interface FleetStatistics {
  totalVehicles: number;
  activeVehicles: number;
  totalDistance: number;
  totalAnomalies: number;
  avgHealthScore: number;
  fuelConsumption: number;
  topRisks: Anomaly[];
}

// ============================================================================
// API REQUESTS/RESPONSES
// ============================================================================

export interface CreateAnomalyRequest {
  vehicleId: number;
  anomalyType: AnomalyType;
  severity: AlertSeverity;
  latitude?: number;
  longitude?: number;
  timestamp: Date;
  data: Record<string, any>;
}

export interface CreateAlertRequest {
  anomalyId?: number;
  vehicleId: number;
  severity: AlertSeverity;
  message: string;
}

export interface IngestGPSRequest {
  vehicles: Array<{
    vehicleId: string;
    gpsPoints: Array<{
      timestamp: string;  // ISO 8601
      latitude: number;
      longitude: number;
      speedKmh: number;
      satellites?: number;
      accuracyM?: number;
      altitudeM?: number;
    }>;
  }>;
}

export interface QueryAnomaliesRequest {
  vehicleId?: number;
  orgId?: number;
  anomalyType?: AnomalyType;
  severity?: AlertSeverity;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// DATABASE MODELS (TypeORM)
// ============================================================================

export interface DBUser {
  id: number;
  orgId: number;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  status: 'active' | 'inactive';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBOrganization {
  id: number;
  name: string;
  industry: string;
  country: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// REAL-TIME & WEBSOCKET
// ============================================================================

export interface WebSocketMessage {
  type: 'LOCATION_UPDATE' | 'ANOMALY_ALERT' | 'STATUS_CHANGED' | 'SUBSCRIPTION';
  payload: Record<string, any>;
  timestamp: Date;
}

export interface SubscriptionFilter {
  vehicleIds?: number[];
  anomalyTypes?: AnomalyType[];
  severityLevels?: AlertSeverity[];
  orgId?: number;
}

// ============================================================================
// ANALYTICS MODELS
// ============================================================================

export interface DriverRiskProfile {
  driverId: number;
  harshAccelerationRate: number;  // events per 100km
  harshBrakingRate: number;
  idlePercentage: number;
  routeDeviationRate: number;
  riskScore: number;  // 0-100
  trainingNeeded: string[];
}

export interface MaintenancePrediction {
  vehicleId: number;
  predictedIssue: string;
  confidence: number;  // 0-1
  daysTillFailure: number;
  recommendedAction: string;
}

// ============================================================================
// PAGINATION
// ============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export interface APIError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
}

export class APIException extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'APIException';
  }
}
