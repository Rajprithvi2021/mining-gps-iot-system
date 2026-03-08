import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export default function HardwareStatus() {
  const [hardwareInfo, setHardwareInfo] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(1);
  const [allVehicles, setAllVehicles] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHardwareData();
    const interval = setInterval(fetchHardwareData, 5000);
    return () => clearInterval(interval);
  }, [selectedVehicleId]);

  const fetchHardwareData = async () => {
    try {
      const response = await fetch(`${API_BASE}/hardware/${selectedVehicleId}`);
      const data = await response.json();
      if (data.success) {
        setHardwareInfo(data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching hardware info:', error);
      setLoading(false);
    }
  };

  const fetchAllVehicles = async () => {
    try {
      const response = await fetch(`${API_BASE}/hardware/all`);
      const data = await response.json();
      if (data.success) {
        setAllVehicles(data.data.vehicles.slice(0, 20));
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  useEffect(() => {
    fetchAllVehicles();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading hardware information...</div>;
  }

  if (!hardwareInfo) {
    return <div className="p-8 text-center text-red-600">No hardware data available</div>;
  }

  const hardware = hardwareInfo.hardware_details;
  const rpi = hardware.raspberry_pi;
  const gps = hardware.gps_device;
  const sensors = hardware.iot_sensors;
  const mqtt = hardware.mqtt_connection;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">🤖 Hardware Simulator</h1>
        <p className="text-gray-600">Real-time Raspberry Pi, GPS, IoT Sensors & MQTT Simulation</p>
      </div>

      {/* Vehicle Selector */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <label className="block text-lg font-semibold mb-4">Select Vehicle</label>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 20 }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => setSelectedVehicleId(i + 1)}
              className={`p-3 rounded-lg font-medium transition ${
                selectedVehicleId === i + 1
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Vehicle {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b">
        {['overview', 'raspberry-pi', 'gps', 'sensors', 'mqtt'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === tab
                ? 'border-b-4 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Raspberry Pi Card */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Raspberry Pi 4B</h3>
              <span className="text-2xl">🔴</span>
            </div>
            <div className="space-y-2 text-sm">
              <div>Device ID: <span className="font-mono">{rpi.deviceId}</span></div>
              <div>CPU: <span className="font-bold">{rpi.cpuUsage.toFixed(1)}%</span></div>
              <div>Memory: <span className="font-bold">{rpi.memoryUsage.toFixed(1)}%</span></div>
              <div>Temp: <span className="font-bold">{rpi.temperature.toFixed(1)}°C</span></div>
              <div>Uptime: <span className="font-bold">{rpi.uptime} days</span></div>
              <div className="mt-4 pt-4 border-t border-white/30">
                <span className="text-xs bg-green-900 px-2 py-1 rounded">
                  ✓ {rpi.status}
                </span>
              </div>
            </div>
          </div>

          {/* GPS Card */}
          <div className="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">GPS Device u-blox</h3>
              <span className="text-2xl">📍</span>
            </div>
            <div className="space-y-2 text-sm">
              <div>Device ID: <span className="font-mono">{gps.deviceId}</span></div>
              <div>Signal: <span className="font-bold">{gps.signalStrength.toFixed(0)}%</span></div>
              <div>Satellites: <span className="font-bold">{gps.satellitesConnected}</span></div>
              <div>Accuracy: <span className="font-bold">{gps.accuracy.toFixed(1)}m</span></div>
              <div>Lat/Lng: <span className="font-mono text-xs">{gps.currentLat.toFixed(4)} / {gps.currentLng.toFixed(4)}</span></div>
              <div className="mt-4 pt-4 border-t border-white/30">
                <span className="text-xs bg-blue-900 px-2 py-1 rounded">
                  ✓ {gps.status}
                </span>
              </div>
            </div>
          </div>

          {/* IoT Sensors Card */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">IoT Sensors (6)</h3>
              <span className="text-2xl">⚡</span>
            </div>
            <div className="space-y-1 text-sm">
              <div>Temp: <span className="font-bold">{sensors.temperatureSensor.currentValue.toFixed(1)}°C</span></div>
              <div>Fuel: <span className="font-bold">{sensors.fuelSensor.currentValue.toFixed(1)}%</span></div>
              <div>Speed: <span className="font-bold">{sensors.speedSensor.currentValue.toFixed(1)} km/h</span></div>
              <div>Humidity: <span className="font-bold">{sensors.hygrometrySensor.currentValue.toFixed(1)}%</span></div>
              <div className="mt-4 pt-4 border-t border-white/30">
                <span className="text-xs bg-yellow-900 px-2 py-1 rounded">
                  ✓ All Active
                </span>
              </div>
            </div>
          </div>

          {/* MQTT Card */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">MQTT Broker</h3>
              <span className="text-2xl">📡</span>
            </div>
            <div className="space-y-2 text-sm">
              <div>Broker: <span className="font-mono text-xs">{mqtt.brokerAddress}</span></div>
              <div>Client ID: <span className="font-mono text-xs">{mqtt.clientId}</span></div>
              <div>Published: <span className="font-bold">{mqtt.messagesPublished}</span></div>
              <div>Received: <span className="font-bold">{mqtt.messagesReceived}</span></div>
              <div className="mt-4 pt-4 border-t border-white/30">
                <span className="text-xs bg-green-900 px-2 py-1 rounded">
                  ✓ {mqtt.connectionStatus}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Raspberry Pi Detailed Tab */}
      {activeTab === 'raspberry-pi' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-6">Raspberry Pi 4B Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Device ID', value: rpi.deviceId },
              { label: 'Hardware Version', value: rpi.hardwareVersion },
              { label: 'CPU Usage', value: `${rpi.cpuUsage.toFixed(1)}%` },
              { label: 'Memory Usage', value: `${rpi.memoryUsage.toFixed(1)}%` },
              { label: 'Temperature', value: `${rpi.temperature.toFixed(1)}°C` },
              { label: 'Disk Usage', value: `${rpi.diskUsage.toFixed(1)}%` },
              { label: 'Uptime', value: `${rpi.uptime} days` },
              { label: 'Kernel', value: rpi.kernelVersion },
              { label: 'GPIO Status', value: rpi.gpioStatus },
              { label: 'Sensor Count', value: rpi.sensorCount },
              { label: 'System Status', value: rpi.status },
            ].map(item => (
              <div key={item.label} className="bg-gray-100 p-4 rounded-lg">
                <p className="text-gray-600 text-sm mb-1">{item.label}</p>
                <p className="text-gray-800 font-bold text-lg">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GPS Detailed Tab */}
      {activeTab === 'gps' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-6">GPS Device u-blox NEO-M8N</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Device ID', value: gps.deviceId },
              { label: 'Manufacturer', value: gps.manufacturer },
              { label: 'Model', value: gps.model },
              { label: 'Status', value: gps.status },
              { label: 'Signal Strength', value: `${gps.signalStrength.toFixed(0)}%` },
              { label: 'Satellites', value: gps.satellitesConnected },
              { label: 'HDOP', value: gps.hdop },
              { label: 'PDOP', value: gps.pdop },
              { label: 'Current Latitude', value: gps.currentLat.toFixed(6) },
              { label: 'Current Longitude', value: gps.currentLng.toFixed(6) },
              { label: 'Accuracy', value: `${gps.accuracy.toFixed(1)}m` },
              { label: 'Refresh Rate', value: `${gps.refreshRate} Hz` },
              { label: 'Baud Rate', value: `${gps.baudRate} bps` },
              { label: 'Protocol', value: gps.protocol },
            ].map(item => (
              <div key={item.label} className="bg-gray-100 p-4 rounded-lg">
                <p className="text-gray-600 text-sm mb-1">{item.label}</p>
                <p className="text-gray-800 font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sensors Detailed Tab */}
      {activeTab === 'sensors' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-6">IoT Sensor Suite (6 Sensors)</h2>
          <div className="space-y-4">
            {[
              { name: 'Temperature Sensor', sensor: sensors.temperatureSensor, unit: '°C' },
              { name: 'Fuel Level Sensor', sensor: sensors.fuelSensor, unit: '%' },
              { name: 'Speed Sensor', sensor: sensors.speedSensor, unit: 'km/h' },
              { name: 'Humidity Sensor', sensor: sensors.hygrometrySensor, unit: '%' },
            ].map(item => (
              <div key={item.name} className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg">{item.name}</h3>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-semibold">
                    {item.sensor.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-gray-600 text-sm">Current Value</p>
                    <p className="font-bold text-lg">{item.sensor.currentValue.toFixed(1)} {item.unit}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Type/Model</p>
                    <p className="font-bold">{item.sensor.type}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Sensor ID</p>
                    <p className="font-mono text-xs font-bold">{item.sensor.sensorId}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Accelerometer */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg">Accelerometer (IMU)</h3>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-semibold">
                  {sensors.accelerometerSensor.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-gray-600 text-sm">Type</p>
                  <p className="font-bold">{sensors.accelerometerSensor.type}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">X Axis (G)</p>
                  <p className="font-bold">{sensors.accelerometerSensor.axisX}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Y Axis (G)</p>
                  <p className="font-bold">{sensors.accelerometerSensor.axisY}</p>
                </div>
              </div>
            </div>

            {/* Vehicle Status */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg">Vehicle Status Sensor (ECU)</h3>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-semibold">
                  {sensors.vehicleStatusSensor.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-gray-600 text-sm">Engine Running</p>
                  <p className="font-bold text-lg">{sensors.vehicleStatusSensor.engineRunning ? '✓ Yes' : '✗ No'}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Doors Locked</p>
                  <p className="font-bold text-lg">{sensors.vehicleStatusSensor.doorsLocked ? '✓ Yes' : '✗ No'}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Light Status</p>
                  <p className="font-bold">{sensors.vehicleStatusSensor.lightStatus}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MQTT Detailed Tab */}
      {activeTab === 'mqtt' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-6">MQTT Broker Connection</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Broker ID', value: mqtt.brokerId },
              { label: 'Broker Address', value: mqtt.brokerAddress },
              { label: 'Client ID', value: mqtt.clientId },
              { label: 'QoS Level', value: mqtt.QoS },
              { label: 'Status', value: mqtt.connectionStatus },
              { label: 'Messages Published', value: mqtt.messagesPublished },
              { label: 'Messages Received', value: mqtt.messagesReceived },
              { label: 'Reconnect Attempts', value: mqtt.reconnectAttempts },
            ].map(item => (
              <div key={item.label} className="bg-gray-100 p-4 rounded-lg">
                <p className="text-gray-600 text-sm mb-1">{item.label}</p>
                <p className="text-gray-800 font-bold text-lg">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-bold mb-3">Published Topics</h3>
            <div className="space-y-2">
              {mqtt.topics.map(topic => (
                <div key={topic} className="bg-white p-3 rounded font-mono text-sm border border-gray-200">
                  📤 {topic}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
        <p className="text-blue-800">
          <strong>ℹ️ Real Hardware Simulation:</strong> All vehicles are running simulated Raspberry Pi devices with real-time GPS updates, 
          6 IoT sensors, and MQTT communication. Data updates every 5 seconds and integrates with the live vehicle tracking system.
        </p>
      </div>
    </div>
  );
}
