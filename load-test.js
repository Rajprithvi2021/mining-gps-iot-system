/**
 * Load Testing Script (k6)
 * ========================
 * Tests the backend API under load with multiple concurrent vehicles
 * 
 * Run: k6 run load-test.js
 * Custom: k6 run --vus 100 --duration 5m load-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const loginTime = new Trend('login_time');
const apiResponseTime = new Trend('api_response_time');
const vehicleCount = new Gauge('vehicle_count');
const anomalyCount = new Counter('anomaly_count');

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const GRAPHQL_URL = `${BASE_URL}/graphql`;

export const options = {
  stages: [
    { duration: '1m', target: 10 },    // Ramp up to 10 users
    { duration: '3m', target: 50 },    // Ramp to 50 users
    { duration: '5m', target: 100 },   // Ramp to 100 users
    { duration: '3m', target: 50 },    // Ramp down to 50
    { duration: '1m', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'],         // 99% of requests must complete below 500ms
    http_req_failed: ['rate<0.1'],           // http failure rate must be less than 10%
    error_rate: ['rate<0.1'],                // custom error rate must be less than 10%
  },
};

/**
 * Test Data Setup
 */
const testUsers = [
  { email: 'admin@example.com', password: 'AdminPass123!' },
  { email: 'manager@example.com', password: 'ManagerPass123!' },
  { email: 'driver@example.com', password: 'DriverPass123!' },
];

const vehicles = [
  { id: 1, name: 'Truck-001' },
  { id: 2, name: 'Truck-002' },
  { id: 3, name: 'Truck-003' },
  { id: 4, name: 'Truck-004' },
  { id: 5, name: 'Truck-005' },
];

/**
 * Authentication & Token Management
 */
let authToken = '';

function authenticateUser(user = testUsers[0]) {
  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Try to login
  const res = http.post(`${BASE_URL}/auth/login`, payload, params);

  check(res, {
    'login status is 200': (r) => r.status === 200,
  });

  loginTime.add(res.timings.duration);

  if (res.status === 200) {
    const data = JSON.parse(res.body);
    authToken = data.token;
  } else {
    errorRate.add(1);
  }
}

/**
 * Test: Health Check
 */
function testHealthCheck() {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);

    check(res, {
      'health status is 200': (r) => r.status === 200,
      'response has status field': (r) => r.json('status') !== null,
    });

    apiResponseTime.add(res.timings.duration);
    errorRate.add(res.status !== 200 ? 1 : 0);

    sleep(0.5);
  });
}

/**
 * Test: GraphQL Query - Get Vehicles
 */
function testGetVehicles() {
  group('Get Vehicles', () => {
    const query = `
      query {
        vehicles(limit: 100) {
          id
          vehicleId
          status
          lastLocation {
            latitude
            longitude
          }
          speedKmh
        }
      }
    `;

    const payload = JSON.stringify({ query });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    };

    const res = http.post(GRAPHQL_URL, payload, params);

    check(res, {
      'query status is 200': (r) => r.status === 200,
      'response has data': (r) => r.json('data') !== null,
      'no errors in response': (r) => r.json('errors') === null,
    });

    if (res.status === 200) {
      const vehicles = res.json('data.vehicles');
      vehicleCount.add(vehicles ? vehicles.length : 0);
    }

    apiResponseTime.add(res.timings.duration);
    errorRate.add(res.status !== 200 ? 1 : 0);

    sleep(1);
  });
}

/**
 * Test: GraphQL Query - Get Anomalies
 */
function testGetAnomalies() {
  group('Get Anomalies', () => {
    const vehicleId = vehicles[Math.floor(Math.random() * vehicles.length)].id;

    const query = `
      query {
        anomalies(vehicleId: ${vehicleId}, limit: 50) {
          id
          type
          severity
          timestamp
        }
      }
    `;

    const payload = JSON.stringify({ query });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    };

    const res = http.post(GRAPHQL_URL, payload, params);

    check(res, {
      'query status is 200': (r) => r.status === 200,
      'response has data': (r) => r.json('data') !== null,
    });

    if (res.status === 200) {
      const anomalies = res.json('data.anomalies');
      anomalyCount.add(anomalies ? anomalies.length : 0);
    }

    apiResponseTime.add(res.timings.duration);
    errorRate.add(res.status !== 200 ? 1 : 0);

    sleep(0.5);
  });
}

/**
 * Test: GraphQL Query - Get Alerts
 */
function testGetAlerts() {
  group('Get Alerts', () => {
    const query = `
      query {
        alerts(limit: 50) {
          id
          vehicleId
          severity
          message
          status
        }
      }
    `;

    const payload = JSON.stringify({ query });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    };

    const res = http.post(GRAPHQL_URL, payload, params);

    check(res, {
      'query status is 200': (r) => r.status === 200,
      'response has data': (r) => r.json('data') !== null,
    });

    apiResponseTime.add(res.timings.duration);
    errorRate.add(res.status !== 200 ? 1 : 0);

    sleep(0.5);
  });
}

/**
 * Test: GraphQL Query - Get Fleet Statistics
 */
function testFleetStats() {
  group('Fleet Statistics', () => {
    const query = `
      query {
        fleetStatistics {
          totalVehicles
          activeVehicles
          totalDistance
          totalAnomalies
          avgFuelEfficiency
        }
      }
    `;

    const payload = JSON.stringify({ query });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    };

    const res = http.post(GRAPHQL_URL, payload, params);

    check(res, {
      'query status is 200': (r) => r.status === 200,
      'response has data': (r) => r.json('data.fleetStatistics') !== null,
    });

    apiResponseTime.add(res.timings.duration);
    errorRate.add(res.status !== 200 ? 1 : 0);

    sleep(1);
  });
}

/**
 * Test: GraphQL Mutation - Acknowledge Alert
 */
function testAcknowledgeAlert() {
  group('Acknowledge Alert', () => {
    const alertId = Math.floor(Math.random() * 1000) + 1;

    const mutation = `
      mutation {
        acknowledgeAlert(alertId: ${alertId})
      }
    `;

    const payload = JSON.stringify({ query: mutation });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    };

    const res = http.post(GRAPHQL_URL, payload, params);

    check(res, {
      'mutation status is 200': (r) => r.status === 200,
    });

    apiResponseTime.add(res.timings.duration);
    errorRate.add(res.status !== 200 ? 1 : 0);

    sleep(0.5);
  });
}

/**
 * Test: Get Daily Metrics for a Vehicle
 */
function testDailyMetrics() {
  group('Daily Metrics', () => {
    const vehicleId = vehicles[Math.floor(Math.random() * vehicles.length)].id;

    const query = `
      query {
        dailyMetrics(vehicleId: ${vehicleId}, days: 30) {
          date
          distance_km
          fuel_efficiency_km_per_liter
          idle_minutes
          num_trips
        }
      }
    `;

    const payload = JSON.stringify({ query });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    };

    const res = http.post(GRAPHQL_URL, payload, params);

    check(res, {
      'query status is 200': (r) => r.status === 200,
      'response has data': (r) => r.json('data.dailyMetrics') !== null,
    });

    apiResponseTime.add(res.timings.duration);
    errorRate.add(res.status !== 200 ? 1 : 0);

    sleep(0.5);
  });
}

/**
 * Test: Metrics Endpoint
 */
function testMetricsEndpoint() {
  group('Metrics Endpoint', () => {
    const res = http.get(`${BASE_URL}/metrics`);

    check(res, {
      'metrics status is 200': (r) => r.status === 200,
      'response has anomalies_1h': (r) => r.json('anomalies_1h') !== null,
      'response has total_vehicles': (r) => r.json('total_vehicles') !== null,
    });

    apiResponseTime.add(res.timings.duration);
    errorRate.add(res.status !== 200 ? 1 : 0);

    sleep(0.5);
  });
}

/**
 * Main Test Execution
 */
export default function () {
  // Setup: Authenticate once per VU
  if (!authToken) {
    authenticateUser();
  }

  // Run tests in sequence
  testHealthCheck();
  testGetVehicles();
  testGetAnomalies();
  testGetAlerts();
  testFleetStats();
  testDailyMetrics();
  testAcknowledgeAlert();
  testMetricsEndpoint();

  sleep(2);
}

/**
 * Setup Phase - Run once before tests
 */
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  console.log(`Test will run with dynamic number of users over time`);
}

/**
 * Teardown Phase - Run once after all tests
 */
export function teardown(data) {
  console.log('Load test completed');
}
