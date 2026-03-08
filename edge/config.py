"""
Skylark Drones Edge Configuration
Configuration file for Raspberry Pi GPS processing system
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/etc/skylark/edge.env', override=False)
load_dotenv('.env', override=False)

# ============================================================================
# VEHICLE CONFIGURATION
# ============================================================================

VEHICLE_ID = os.getenv('VEHICLE_ID', 'EXCAVATOR-A1')
VEHICLE_TYPE = os.getenv('VEHICLE_TYPE', 'Excavator')

# ============================================================================
# GPS CONFIGURATION
# ============================================================================

GPS_PORTS = {
    'GPS1': {
        'port': os.getenv('GPS1_PORT', '/dev/ttyUSB0'),
        'baudrate': int(os.getenv('GPS1_BAUDRATE', '9600')),
        'timeout': 1
    },
    'GPS2': {
        'port': os.getenv('GPS2_PORT', '/dev/ttyUSB1'),
        'baudrate': int(os.getenv('GPS2_BAUDRATE', '9600')),
        'timeout': 1
    }
}

# ============================================================================
# MQTT CONFIGURATION
# ============================================================================

MQTT_CONFIG = {
    'broker': os.getenv('MQTT_BROKER', 'mqtt.skylark-drones.com'),
    'port': int(os.getenv('MQTT_PORT', '8883')),
    'username': os.getenv('MQTT_USERNAME', 'edge-device'),
    'password': os.getenv('MQTT_PASSWORD', 'secure-password'),
    'keepalive': int(os.getenv('MQTT_KEEPALIVE', '60')),
    'use_tls': os.getenv('MQTT_USE_TLS', 'true').lower() == 'true'
}

# ============================================================================
# DETECTION CONFIGURATION
# ============================================================================

DETECTION_CONFIG = {
    # Route Deviation Detection
    'deviation_threshold_m': int(os.getenv('DEVIATION_THRESHOLD_M', '50')),
    'geofence': {
        'center_lat': float(os.getenv('GEOFENCE_LAT', '48.8566')),
        'center_lon': float(os.getenv('GEOFENCE_LON', '2.3522')),
        'radius_km': float(os.getenv('GEOFENCE_RADIUS_KM', '2.0')),
        'type': 'circle'
    },
    
    # Idle Behavior Detection
    'idle_speed_threshold_kmh': float(os.getenv('IDLE_SPEED_THRESHOLD', '1.0')),
    'idle_duration_threshold_min': int(os.getenv('IDLE_DURATION_THRESHOLD_MIN', '5')),
    'idle_critical_duration_min': int(os.getenv('IDLE_CRITICAL_DURATION_MIN', '30')),
    'idle_gps_accuracy_threshold_m': int(os.getenv('IDLE_GPS_ACCURACY_THRESHOLD_M', '50')),
    
    # Fuel Consumption Anomaly Detection
    'baseline_fuel_consumption': float(os.getenv('BASELINE_FUEL_CONSUMPTION', '12.0')),
    'optimal_speed_kmh': float(os.getenv('OPTIMAL_SPEED_KMH', '60')),
    'max_safe_acceleration_mps2': float(os.getenv('MAX_SAFE_ACCELERATION_MPS2', '4.0')),
    'fuel_anomaly_threshold_percent': float(os.getenv('FUEL_ANOMALY_THRESHOLD_PERCENT', '20')),
}

# ============================================================================
# BACKEND API CONFIGURATION
# ============================================================================

BACKEND_CONFIG = {
    'api_url': os.getenv('BACKEND_API_URL', 'http://localhost:3000/api/v1'),
    'api_key': os.getenv('BACKEND_API_KEY', 'edge-device-key-123'),
    'ssl_verify': os.getenv('BACKEND_SSL_VERIFY', 'true').lower() == 'true'
}

# ============================================================================
# DATA BUFFER CONFIGURATION
# ============================================================================

DATA_BUFFER_CONFIG = {
    'max_size': int(os.getenv('BUFFER_MAX_SIZE', '300')),  # Keep 5 min of data (1 point/sec)
    'sync_interval_seconds': int(os.getenv('BUFFER_SYNC_INTERVAL', '300')),  # Sync every 5 min
    'local_storage_path': os.getenv('LOCAL_STORAGE_PATH', '/var/lib/skylark/cache.db')
}

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

LOGGING_CONFIG = {
    'level': os.getenv('LOG_LEVEL', 'INFO'),
    'file': os.getenv('LOG_FILE', '/var/log/skylark-gps.log'),
    'max_bytes': int(os.getenv('LOG_MAX_BYTES', '10485760')),  # 10 MB
    'backup_count': int(os.getenv('LOG_BACKUP_COUNT', '5'))
}

# ============================================================================
# SYSTEM CONFIGURATION
# ============================================================================

SYSTEM_CONFIG = {
    'enable_mock_gps': os.getenv('ENABLE_MOCK_GPS', 'false').lower() == 'true',
    'enable_mock_mqtt': os.getenv('ENABLE_MOCK_MQTT', 'false').lower() == 'true',
    'health_check_interval_seconds': int(os.getenv('HEALTH_CHECK_INTERVAL', '30')),
    'watchdog_enabled': os.getenv('WATCHDOG_ENABLED', 'true').lower() == 'true',
    'watchdog_timeout_minutes': int(os.getenv('WATCHDOG_TIMEOUT_MINUTES', '30'))
}

# ============================================================================
# EXAMPLE .ENV FILE
# ============================================================================

"""
# Vehicle Configuration
VEHICLE_ID=EXCAVATOR-A1
VEHICLE_TYPE=Excavator

# GPS Configuration
GPS1_PORT=/dev/ttyUSB0
GPS1_BAUDRATE=9600
GPS2_PORT=/dev/ttyUSB1
GPS2_BAUDRATE=9600

# MQTT Configuration
MQTT_BROKER=mqtt.skylark-drones.com
MQTT_PORT=8883
MQTT_USERNAME=edge-device-excavator-a1
MQTT_PASSWORD=your-secure-password-here
MQTT_KEEPALIVE=60
MQTT_USE_TLS=true

# Geofence Configuration
GEOFENCE_LAT=48.8566
GEOFENCE_LON=2.3522
GEOFENCE_RADIUS_KM=2.0

# Detection Thresholds
DEVIATION_THRESHOLD_M=50
IDLE_SPEED_THRESHOLD=1.0
IDLE_DURATION_THRESHOLD_MIN=5
BASELINE_FUEL_CONSUMPTION=12.0
OPTIMAL_SPEED_KMH=60

# Backend API
BACKEND_API_URL=http://api.skylark-drones.com/api/v1
BACKEND_API_KEY=your-api-key-here

# System Configuration
LOG_LEVEL=INFO
ENABLE_MOCK_GPS=false
ENABLE_MOCK_MQTT=false
"""

# ============================================================================
# PRODUCTION DEPLOYMENT GUIDE
# ============================================================================

"""
1. Create /etc/skylark/ directory:
   sudo mkdir -p /etc/skylark

2. Place configuration in /etc/skylark/edge.env:
   sudo cp edge.env /etc/skylark/edge.env
   sudo chmod 600 /etc/skylark/edge.env

3. Create systemd service file:
   sudo cp skylark-gps.service /etc/systemd/system/
   
4. Enable and start service:
   sudo systemctl daemon-reload
   sudo systemctl enable skylark-gps.service
   sudo systemctl start skylark-gps.service

5. Monitor service:
   sudo journalctl -u skylark-gps.service -f

6. Verify running:
   sudo systemctl status skylark-gps.service
"""
