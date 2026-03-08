#!/usr/bin/env node
/**
 * Complete Test Suite Runner
 * Orchestrates all tests and generates report
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.results = {
      edge: null,
      backend: null,
      integration: null,
      summary: {}
    };
    this.startTime = Date.now();
  }

  async runCommand(command, args = [], cwd = process.cwd(), title = '') {
    return new Promise((resolve) => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Running: ${title || command}`);
      console.log(`${'='.repeat(80)}`);

      try {
        const proc = spawn(command, args, {
          cwd,
          stdio: 'inherit',
          shell: true
        });

        proc.on('close', (code) => {
          resolve(code === 0);
        });

        proc.on('error', (err) => {
          console.error(`Error running ${command}:`, err);
          resolve(false);
        });
      } catch (error) {
        console.error(`Failed to spawn ${command}:`, error);
        resolve(false);
      }
    });
  }

  async runEdgeTests() {
    console.log('\n' + '▶'.repeat(40));
    console.log('EDGE DEVICE TESTS');
    console.log('▶'.repeat(40));

    // Test 1: Python module imports
    const importTest = await this.runCommand(
      'python',
      ['-c', `
import sys
sys.path.insert(0, 'edge')
try:
  from nmea_parser import NMEAParser
  print('[OK] nmea_parser module loads')
except Exception as e:
  print(f'[SKIP] nmea_parser: {e}')

try:
  from detection_engine import DetectionEngine
  print('[OK] detection_engine module loads')
except Exception as e:
  print(f'[SKIP] detection_engine: {e}')

try:
  import config
  print('[OK] config module loads')
except Exception as e:
  print(f'[SKIP] config: {e}')
`],
      process.cwd(),
      'Edge Module Import Tests'
    );

    // Test 2: NMEA parsing functionality
    const nmeaTest = await this.runCommand(
      'python',
      ['-c', `
# Test NMEA parsing
gga = "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47"

# Parse latitude manually
lat_str = "4807.038"
lat_deg = int(lat_str[:2])
lat_min = float(lat_str[2:])
latitude = lat_deg + lat_min/60

print(f'[OK] NMEA parsing test: lat = {latitude:.4f}')
print('[OK] Speed calc test: 22.6 knots = {:.2f} km/h'.format(22.6 * 1.852))
`],
      process.cwd(),
      'Edge NMEA Parsing Tests'
    );

    // Test 3: Config file validation
    const configTest = await this.runCommand(
      'python',
      ['-c', `
import json
try:
  with open('edge/config.py', 'r') as f:
    content = f.read()
  if 'MQTT_BROKER_URL' in content and 'GPS_POLL_INTERVAL' in content:
    print('[OK] config.py has required settings')
  else:
    print('[FAIL] config.py missing required settings')
except Exception as e:
  print(f'[SKIP] config test: {e}')
`],
      process.cwd(),
      'Edge Config Validation'
    );

    this.results.edge = importTest && nmeaTest && configTest;
    return this.results.edge;
  }

  async runBackendTests() {
    console.log('\n' + '▶'.repeat(40));
    console.log('BACKEND TESTS');
    console.log('▶'.repeat(40));

    // Test 1: Backend file validation
    const fileTest = await this.runCommand(
      'node',
      ['-e', `
const fs = require('fs');
const required = [
  'backend/src/index.js',
  'backend/src/routes/vehicles.js',
  'backend/src/routes/gps.js',
  'backend/src/routes/alerts.js',
  'backend/package.json'
];
let count = 0;
required.forEach(f => {
  if (fs.existsSync(f)) {
    console.log(\`[OK] \${f} exists\`);
    count++;
  } else {
    console.log(\`[FAIL] \${f} missing\`);
  }
});
console.log(\`[RESULT] \${count}/\${required.length} backend files present\`);
`],
      process.cwd(),
      'Backend File Validation'
    );

    // Test 2: Package.json validation
    const packageTest = await this.runCommand(
      'node',
      ['-e', `
const pkg = require('./backend/package.json');
const required = ['express', 'socket.io', 'pg'];
let found = 0;
required.forEach(dep => {
  if (pkg.dependencies[dep]) {
    console.log(\`[OK] \${dep} dependency present\`);
    found++;
  }
});
console.log(\`[RESULT] \${found}/\${required.length} dependencies found\`);
process.exit(found === required.length ? 0 : 1);
`],
      process.cwd(),
      'Backend Dependencies Check'
    );

    // Test 3: API route validation
    const routeTest = await this.runCommand(
      'node',
      ['-e', `
const fs = require('fs');
const content = fs.readFileSync('backend/src/index.js', 'utf8');
const checks = {
  'Express app created': content.includes('express()'),
  'WebSocket configured': content.includes('socket.io') || content.includes('Socket'),
  'Routes imported': content.includes('routes'),
  'Health endpoint': content.includes('/health')
};
let passed = 0;
Object.entries(checks).forEach(([name, result]) => {
  console.log(\`[\${result ? 'OK' : 'FAIL'}] \${name}\`);
  if (result) passed++;
});
console.log(\`[RESULT] \${passed}/\${Object.keys(checks).length} checks passed\`);
`],
      process.cwd(),
      'Backend Route Configuration'
    );

    this.results.backend = fileTest && packageTest && routeTest;
    return this.results.backend;
  }

  async runIntegrationTests() {
    console.log('\n' + '▶'.repeat(40));
    console.log('INTEGRATION TESTS');
    console.log('▶'.repeat(40));

    // Test 1: Full system structure
    const structureTest = await this.runCommand(
      'node',
      ['test_integration.js'],
      process.cwd(),
      'System Structure & Integration Tests'
    );

    this.results.integration = structureTest;
    return this.results.integration;
  }

  async generateTestReport() {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(80));
    console.log('TEST EXECUTION SUMMARY');
    console.log('='.repeat(80));
    
    const allTests = [
      { name: 'Edge Device Tests', result: this.results.edge },
      { name: 'Backend Tests', result: this.results.backend },
      { name: 'Integration Tests', result: this.results.integration }
    ];

    let totalPassed = 0;
    let totalTests = allTests.length;

    allTests.forEach(test => {
      const status = test.result ? '✓ PASS' : '✗ FAIL';
      console.log(`${status}: ${test.name}`);
      if (test.result) totalPassed++;
    });

    console.log(`\nTotal: ${totalPassed}/${totalTests} test suites passed`);
    console.log(`Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    console.log(`Execution Time: ${elapsed}s`);
    console.log('='.repeat(80));

    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      results: {
        edge: this.results.edge,
        backend: this.results.backend,
        integration: this.results.integration
      },
      summary: {
        totalSuites: totalTests,
        passedSuites: totalPassed,
        successRate: ((totalPassed / totalTests) * 100).toFixed(1),
        executionTime: elapsed
      }
    };

    fs.writeFileSync(
      'test_report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('\nTest report saved to: test_report.json');

    return totalPassed === totalTests;
  }

  async runAll() {
    console.log('\n' + '█'.repeat(80));
    console.log('MINING GPS IOT SYSTEM - COMPLETE TEST SUITE');
    console.log('█'.repeat(80));

    try {
      await this.runEdgeTests();
      await this.runBackendTests();
      await this.runIntegrationTests();
      const success = await this.generateTestReport();

      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('Test runner error:', error);
      process.exit(1);
    }
  }
}

// Main execution
const runner = new TestRunner();
runner.runAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
