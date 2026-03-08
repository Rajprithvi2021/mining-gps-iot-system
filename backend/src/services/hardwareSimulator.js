/**
 * Hardware Simulator Service
 * Simulates Raspberry Pi, GPS devices, IoT sensors, and real vehicle tracking
 * Makes the system behave like it has real hardware deployed
 */

const pool = require('../utils/database');

class HardwareSimulator {
  constructor() {
    this.simulationActive = true;
    this.vehicleStates = new Map();
    this.simulationInterval = null;
  }

  /**
   * Initialize hardware simulation for all vehicles
   */
  async initialize() {
    console.log('🤖 Initializing Hardware Simulator...');
    
    try {
      // Get all vehicles from database
      const result = await pool.query('SELECT id, current_latitude, current_longitude FROM vehicles');
      
      // Initialize state for each vehicle
      result.rows.forEach(vehicle => {
        this.vehicleStates.set(vehicle.id, {
          id: vehicle.id,
          raspberryPi: this.createRaspberryPiSimulation(),
          gps: this.createGPSSimulation(vehicle.current_latitude, vehicle.current_longitude),
          sensors: this.createSensorSimulation(),
          mqtt: this.createMQTTSimulation(),
          lastUpdate: new Date()
        });
      });

      console.log(`✅ Initialized simulation for ${result.rows.length} vehicles`);
      
      // Start continuous simulation
      this.startSimulation();
    } catch (error) {
      console.error('❌ Error initializing hardware simulator:', error);
    }
  }

  /**
   * Simulate Raspberry Pi device on vehicle
   */
  createRaspberryPiSimulation() {
    return {
      deviceId: `RPI-${Math.random().toString(36).substring(7).toUpperCase()}`,
      cpuUsage: Math.floor(Math.random() * 40) + 10, // 10-50%
      memoryUsage: Math.floor(Math.random() * 50) + 20, // 20-70%
      temperature: Math.floor(Math.random() * 15) + 35, // 35-50°C
      uptime: Math.floor(Math.random() * 30) + 10, // 10-40 days
      diskUsage: Math.floor(Math.random() * 30) + 10, // 10-40%
      gpioStatus: 'ACTIVE',
      sensorCount: 6,
      hardwareVersion: '4B',
      kernelVersion: '5.15.76-v7l+',
      status: 'OPERATIONAL'
    };
  }

  /**
   * Simulate GPS Device with realistic movement
   */
  createGPSSimulation(baseLat, baseLng) {
    return {
      deviceId: `GPS-${Math.random().toString(36).substring(7).toUpperCase()}`,
      manufacturer: 'u-blox',
      model: 'NEO-M8N',
      status: 'ACQUIRING_SIGNAL',
      signalStrength: Math.floor(Math.random() * 20) + 80, // 80-100%
      satellitesConnected: Math.floor(Math.random() * 8) + 12, // 12-20 satellites
      hdop: (Math.random() * 1 + 0.5).toFixed(2), // Horizontal Dilution of Precision
      pdop: (Math.random() * 1.5 + 1).toFixed(2), // Position Dilution of Precision
      baseLat: parseFloat(baseLat),
      baseLng: parseFloat(baseLng),
      currentLat: parseFloat(baseLat),
      currentLng: parseFloat(baseLng),
      accuracy: Math.floor(Math.random() * 5) + 2, // 2-7 meters
      refreshRate: 5, // Hz (5 times per second)
      baudRate: 9600,
      protocol: 'NMEA-0183'
    };
  }

  /**
   * Simulate Multiple IoT Sensors
   */
  createSensorSimulation() {
    return {
      temperatureSensor: {
        sensorId: `TEMP-${Math.random().toString(36).substring(7).toUpperCase()}`,
        type: 'DS18B20',
        currentValue: Math.floor(Math.random() * 20) + 28, // 28-48°C
        unit: 'Celsius',
        calibration: -0.5,
        accuracy: 0.5,
        status: 'ACTIVE'
      },
      fuelSensor: {
        sensorId: `FUEL-${Math.random().toString(36).substring(7).toUpperCase()}`,
        type: 'Capacitive',
        currentValue: Math.floor(Math.random() * 60) + 30, // 30-90%
        unit: 'Percentage',
        maxCapacity: 500, // Liters
        calibration: 0,
        accuracy: 2,
        status: 'ACTIVE'
      },
      speedSensor: {
        sensorId: `SPEED-${Math.random().toString(36).substring(7).toUpperCase()}`,
        type: 'OBD-II CAN Bus',
        currentValue: Math.floor(Math.random() * 60) + 5, // 5-65 km/h
        unit: 'km/h',
        maxSpeed: 120,
        calibration: 0,
        accuracy: 1,
        status: 'ACTIVE'
      },
      accelerometerSensor: {
        sensorId: `ACCEL-${Math.random().toString(36).substring(7).toUpperCase()}`,
        type: 'MPU-6050',
        axisX: (Math.random() * 0.5 - 0.25).toFixed(2), // G units
        axisY: (Math.random() * 0.5 - 0.25).toFixed(2),
        axisZ: (Math.random() - 0.5).toFixed(2),
        status: 'ACTIVE'
      },
      hygrometrySensor: {
        sensorId: `HUM-${Math.random().toString(36).substring(7).toUpperCase()}`,
        type: 'DHT22',
        currentValue: Math.floor(Math.random() * 40) + 30, // 30-70% humidity
        unit: 'Percentage',
        accuracy: 2,
        status: 'ACTIVE'
      },
      vehicleStatusSensor: {
        sensorId: `STATUS-${Math.random().toString(36).substring(7).toUpperCase()}`,
        type: 'Engine Control Unit',
        engineRunning: Math.random() > 0.15, // 85% running
        doorsLocked: true,
        lightStatus: 'AUTO',
        hornStatus: 'OFF',
        wiperStatus: 'OFF',
        status: 'ACTIVE'
      }
    };
  }

  /**
   * Simulate MQTT Communication
   */
  createMQTTSimulation() {
    return {
      brokerId: `MQTT-BROKER-${Math.random().toString(36).substring(7).toUpperCase()}`,
      brokerAddress: 'mqtt.skylark-mining.local:1883',
      clientId: `vehicle-client-${Math.random().toString(36).substring(7).toUpperCase()}`,
      topics: [
        'vehicle/+/gps/position',
        'vehicle/+/sensors/temperature',
        'vehicle/+/sensors/fuel',
        'vehicle/+/sensors/speed',
        'vehicle/+/alerts/generated',
        'vehicle/+/status/heartbeat'
      ],
      QoS: 1,
      connectionStatus: 'CONNECTED',
      messagesPublished: Math.floor(Math.random() * 1000) + 500,
      messagesReceived: Math.floor(Math.random() * 500) + 200,
      reconnectAttempts: Math.floor(Math.random() * 3),
      lastHeartbeat: new Date()
    };
  }

  /**
   * Start continuous hardware simulation
   * Updates all vehicles with realistic movement and sensor changes
   */
  startSimulation() {
    this.simulationInterval = setInterval(() => {
      this.updateAllVehicles();
    }, 5000); // Update every 5 seconds

    console.log('🚀 Hardware simulation started (updates every 5 seconds)');
  }

  /**
   * Update all vehicles with realistic movement and sensor data
   */
  async updateAllVehicles() {
    if (!this.simulationActive) return;

    try {
      for (const [vehicleId, state] of this.vehicleStates) {
        // Update GPS position (realistic movement)
        this.updateGPSPosition(state);

        // Update sensor readings
        this.updateSensorReadings(state);

        // Update Raspberry Pi stats
        this.updateRaspberryPiStats(state);

        // Save to database
        await this.saveVehicleStateToDatabase(vehicleId, state);
      }
    } catch (error) {
      console.error('❌ Error updating vehicles:', error);
    }
  }

  /**
   * Update GPS position with realistic vehicle movement
   */
  updateGPSPosition(state) {
    const gps = state.gps;
    const activeStatus = Math.random() > 0.15; // 85% chance vehicle is active

    if (activeStatus) {
      // Realistic movement: small random adjustments
      const latChange = (Math.random() - 0.5) * 0.0005; // ~50 meters
      const lngChange = (Math.random() - 0.5) * 0.0005;

      gps.currentLat = parseFloat((gps.currentLat + latChange).toFixed(6));
      gps.currentLng = parseFloat((gps.currentLng + lngChange).toFixed(6));

      // Update signal strength (better when moving)
      gps.signalStrength = Math.min(100, gps.signalStrength + Math.random() * 5);
      gps.satellitesConnected = Math.min(20, gps.satellitesConnected + Math.floor(Math.random() * 2));
    } else {
      // Parked: maintain position, signal might vary
      gps.signalStrength = Math.max(70, gps.signalStrength - Math.random() * 3);
    }

    gps.accuracy = Math.max(1, gps.accuracy - Math.random() * 0.5);
    gps.lastUpdate = new Date();
  }

  /**
   * Update sensor readings with realistic variations
   */
  updateSensorReadings(state) {
    const sensors = state.sensors;
    const isMoving = Math.random() > 0.15;

    // Temperature: gradual changes (±2°C per update)
    sensors.temperatureSensor.currentValue = Math.max(25, Math.min(55,
      sensors.temperatureSensor.currentValue + (Math.random() - 0.5) * 4
    ));

    // Fuel: decreases when moving
    if (isMoving) {
      sensors.fuelSensor.currentValue = Math.max(0, Math.min(100,
        sensors.fuelSensor.currentValue - Math.random() * 2
      ));
    }

    // Speed: changes based on activity
    if (isMoving) {
      sensors.speedSensor.currentValue = Math.floor(Math.random() * 60) + 5;
    } else {
      sensors.speedSensor.currentValue = Math.floor(Math.random() * 5); // 0-5 km/h (idle)
    }

    // Humidity: varies gradually
    sensors.hygrometrySensor.currentValue = Math.max(20, Math.min(80,
      sensors.hygrometrySensor.currentValue + (Math.random() - 0.5) * 3
    ));

    // Engine status changes occasionally
    if (Math.random() > 0.95) {
      sensors.vehicleStatusSensor.engineRunning = !sensors.vehicleStatusSensor.engineRunning;
    }
  }

  /**
   * Update Raspberry Pi system stats
   */
  updateRaspberryPiStats(state) {
    const rpi = state.raspberryPi;

    // CPU usage varies with sensor reading activity
    rpi.cpuUsage = Math.min(80, Math.max(5, rpi.cpuUsage + (Math.random() - 0.5) * 10));

    // Memory usage increases slowly (normal behavior)
    rpi.memoryUsage = Math.min(90, rpi.memoryUsage + Math.random() * 2);

    // Temperature based on CPU usage
    rpi.temperature = 35 + (rpi.cpuUsage / 100) * 25;

    // Disk usage stable (slow increase)
    rpi.diskUsage = Math.min(90, rpi.diskUsage + Math.random() * 0.5);
  }

  /**
   * Save vehicle state to database
   */
  async saveVehicleStateToDatabase(vehicleId, state) {
    try {
      const { gps, sensors } = state;

      await pool.query(
        `UPDATE vehicles SET
          current_latitude = $1,
          current_longitude = $2,
          current_speed_kmh = $3,
          fuel_percentage = $4,
          temperature = $5,
          updated_at = NOW()
        WHERE id = $6`,
        [
          gps.currentLat,
          gps.currentLng,
          sensors.speedSensor.currentValue,
          sensors.fuelSensor.currentValue,
          sensors.temperatureSensor.currentValue,
          vehicleId
        ]
      );
    } catch (error) {
      console.error(`Error saving vehicle ${vehicleId}:`, error);
    }
  }

  /**
   * Get hardware info for a vehicle (what Raspberry Pi would report)
   */
  async getHardwareInfo(vehicleId) {
    const state = this.vehicleStates.get(vehicleId);
    if (!state) return null;

    return {
      vehicle_id: vehicleId,
      hardware_details: {
        raspberry_pi: state.raspberryPi,
        gps_device: state.gps,
        iot_sensors: state.sensors,
        mqtt_connection: state.mqtt,
        last_update: state.lastUpdate,
        simulation_active: true
      }
    };
  }

  /**
   * Get all vehicle hardware info
   */
  async getAllHardwareInfo() {
    const allHardware = [];

    for (const [vehicleId, state] of this.vehicleStates) {
      allHardware.push({
        vehicle_id: vehicleId,
        raspberry_pi: state.raspberryPi,
        gps_device: state.gps,
        sensors: state.sensors,
        mqtt: state.mqtt,
        last_update: state.lastUpdate
      });
    }

    return allHardware;
  }

  /**
   * Stop simulation
   */
  stop() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationActive = false;
      console.log('🛑 Hardware simulation stopped');
    }
  }

  /**
   * Get simulation status
   */
  getStatus() {
    return {
      active: this.simulationActive,
      vehicleCount: this.vehicleStates.size,
      updateInterval: '5 seconds',
      simulationType: 'Full Hardware Emulation',
      components: [
        'Raspberry Pi 4B Simulation',
        'u-blox GPS Device Simulation',
        'Temperature Sensor (DS18B20)',
        'Fuel Level Sensor',
        'Speed Sensor (CAN Bus)',
        'IMU/Accelerometer',
        'Humidity Sensor',
        'MQTT Broker Simulation',
        'Real Vehicle Movement'
      ]
    };
  }
}

// Export singleton instance
module.exports = new HardwareSimulator();
