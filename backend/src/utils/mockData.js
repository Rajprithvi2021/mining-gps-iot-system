/**
 * Mock Data Service
 * Returns realistic sample data when database is unavailable
 */

const mockVehicles = [
  {
    id: 1,
    name: 'Truck-001',
    type: 'Excavator',
    active: true,
    status: 'active',
    current_latitude: 48.8566,
    current_longitude: 2.3522,
    current_speed_kmh: 45,
    last_gps_update: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    efficiency: 8,
    fuel: 75,
    temp: 45,
    location: 'Zone A'
  },
  {
    id: 2,
    name: 'Truck-002',
    type: 'Dump Truck',
    active: true,
    status: 'active',
    current_latitude: 48.8590,
    current_longitude: 2.3510,
    current_speed_kmh: 52,
    last_gps_update: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    efficiency: 7,
    fuel: 60,
    temp: 42,
    location: 'Zone B'
  },
  {
    id: 3,
    name: 'Truck-003',
    type: 'Loader',
    active: true,
    status: 'active',
    current_latitude: 48.8540,
    current_longitude: 2.3535,
    current_speed_kmh: 38,
    last_gps_update: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    efficiency: 9,
    fuel: 85,
    temp: 38,
    location: 'Zone C'
  },
  {
    id: 4,
    name: 'Truck-004',
    type: 'Excavator',
    active: false,
    status: 'idle',
    current_latitude: 48.8500,
    current_longitude: 2.3450,
    current_speed_kmh: 0,
    last_gps_update: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
    efficiency: 6,
    fuel: 40,
    temp: 28,
    location: 'Base'
  },
  {
    id: 5,
    name: 'Truck-005',
    type: 'Dump Truck',
    active: true,
    status: 'active',
    current_latitude: 48.8555,
    current_longitude: 2.3545,
    current_speed_kmh: 48,
    last_gps_update: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    efficiency: 8,
    fuel: 70,
    temp: 41,
    location: 'Zone A'
  }
];

const mockAlerts = [
  {
    id: 1,
    vehicle_id: 1,
    type: 'High Temperature',
    vehicle: 'Truck-001',
    severity: 'warning',
    message: 'Engine temperature exceeded threshold',
    time: '2 min ago',
    timestamp: new Date(Date.now() - 120000).toISOString()
  },
  {
    id: 2,
    vehicle_id: 4,
    type: 'Fuel Low',
    vehicle: 'Truck-004',
    severity: 'critical',
    message: 'Fuel level below 50%',
    time: '5 min ago',
    timestamp: new Date(Date.now() - 300000).toISOString()
  },
  {
    id: 3,
    vehicle_id: 2,
    type: 'Route Deviation',
    vehicle: 'Truck-002',
    severity: 'info',
    message: 'Vehicle deviated from planned route',
    time: '12 min ago',
    timestamp: new Date(Date.now() - 720000).toISOString()
  },
  {
    id: 4,
    vehicle_id: 3,
    type: 'Idle Detected',
    vehicle: 'Truck-003',
    severity: 'info',
    message: 'Vehicle idle for 25 minutes',
    time: '25 min ago',
    timestamp: new Date(Date.now() - 1500000).toISOString()
  }
];

const mockDashboard = {
  activeVehicles: 4,
  totalVehicles: 5,
  fuelConsumption: 4500,
  efficiencyRating: 8.5,
  costPerKM: 125,
  avgTemp: 35.75,
  systemUptime: 99.8,
  dataRefresh: 'Real-time',
  systemHealth: 99
};

const mockAnalytics = {
  totalEngineers: 12,
  apiLatencyP99: 45,
  errorRate: 0.001,
  pipelinePassed: 98,
  totalTests: 4250,
  uptime: 99.95,
  dataRefresh: 'Real-time',
  systemHealth: 99
};

const mockServiceHealth = [
  { service: 'API Gateway', status: 'healthy', latency: '12ms', uptime: 99.99 },
  { service: 'GPS Tracker', status: 'healthy', latency: '45ms', uptime: 99.95 },
  { service: 'Analytics Engine', status: 'healthy', latency: '89ms', uptime: 99.97 },
  { service: 'Alert System', status: 'healthy', latency: '234ms', uptime: 98.5 },
  { service: 'Data Pipeline', status: 'healthy', latency: '156ms', uptime: 99.91 }
];

module.exports = {
  mockVehicles,
  mockAlerts,
  mockDashboard,
  mockAnalytics,
  mockServiceHealth
};
