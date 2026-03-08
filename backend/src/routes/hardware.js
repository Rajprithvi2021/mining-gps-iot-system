/**
 * Hardware API Routes
 * Exposes simulated hardware information and status
 */

const express = require('express');
const router = express.Router();
const hardwareSimulator = require('../services/hardwareSimulator');

/**
 * GET /api/v1/hardware/status
 * Get overall hardware simulation status
 */
router.get('/status', (req, res) => {
  try {
    const status = hardwareSimulator.getStatus();
    res.json({
      success: true,
      data: status,
      message: 'Hardware simulation is active - all vehicles have simulated Raspberry Pi, GPS, IoT sensors, and MQTT communication'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/hardware/all
 * Get hardware info for all vehicles
 */
router.get('/all', async (req, res) => {
  try {
    const hardwareInfo = await hardwareSimulator.getAllHardwareInfo();
    res.json({
      success: true,
      data: {
        total_vehicles: hardwareInfo.length,
        vehicles: hardwareInfo
      },
      message: 'Hardware information for all simulated vehicles'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/hardware/:vehicleId
 * Get detailed hardware info for specific vehicle
 */
router.get('/:vehicleId', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const hardwareInfo = await hardwareSimulator.getHardwareInfo(parseInt(vehicleId));

    if (!hardwareInfo) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      data: hardwareInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/hardware/:vehicleId/raspberry-pi
 * Get Raspberry Pi simulation details
 */
router.get('/:vehicleId/raspberry-pi', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const hardwareInfo = await hardwareSimulator.getHardwareInfo(parseInt(vehicleId));

    if (!hardwareInfo) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      data: {
        vehicle_id: hardwareInfo.vehicle_id,
        raspberry_pi: hardwareInfo.hardware_details.raspberry_pi,
        message: 'Raspberry Pi 4B simulation with real-time system monitoring'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/hardware/:vehicleId/gps
 * Get GPS device simulation details
 */
router.get('/:vehicleId/gps', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const hardwareInfo = await hardwareSimulator.getHardwareInfo(parseInt(vehicleId));

    if (!hardwareInfo) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      data: {
        vehicle_id: hardwareInfo.vehicle_id,
        gps_device: hardwareInfo.hardware_details.gps_device,
        message: 'u-blox NEO-M8N GPS simulation with real-time position updates'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/hardware/:vehicleId/sensors
 * Get IoT sensors simulation details
 */
router.get('/:vehicleId/sensors', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const hardwareInfo = await hardwareSimulator.getHardwareInfo(parseInt(vehicleId));

    if (!hardwareInfo) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      data: {
        vehicle_id: hardwareInfo.vehicle_id,
        sensors: hardwareInfo.hardware_details.iot_sensors,
        sensor_count: 6,
        active_sensors: [
          'Temperature (DS18B20)',
          'Fuel Level (Capacitive)',
          'Speed (OBD-II CAN Bus)',
          'Accelerometer (MPU-6050)',
          'Humidity (DHT22)',
          'Engine Status (ECU)'
        ],
        message: 'IoT sensor suite with real-time readings'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/hardware/:vehicleId/mqtt
 * Get MQTT communication simulation details
 */
router.get('/:vehicleId/mqtt', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const hardwareInfo = await hardwareSimulator.getHardwareInfo(parseInt(vehicleId));

    if (!hardwareInfo) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      data: {
        vehicle_id: hardwareInfo.vehicle_id,
        mqtt: hardwareInfo.hardware_details.mqtt_connection,
        message: 'MQTT broker simulation for real-time data publish/subscribe'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
