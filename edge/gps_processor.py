#!/usr/bin/env python3
"""
Skylark Drones - Edge GPS Processing System
Raspberry Pi-based real-time vehicle tracking and anomaly detection

Main processor handling:
- Dual GPS module data collection (u-blox NEO-6M)
- NMEA sentence parsing
- Route deviation detection
- Idle behavior detection
- Fuel consumption anomaly detection
- MQTT publishing to cloud backend
"""

import serial
import json
import time
import threading
import logging
import os
from datetime import datetime, timedelta
from collections import deque
from math import radians, cos, sin, asin, sqrt
import paho.mqtt.client as mqtt
from config import GPS_PORTS, MQTT_CONFIG, VEHICLE_ID, DETECTION_CONFIG
from nmea_parser import NMEAParser
from detection_engine import DetectionEngine
from mqtt_client import MQTTPublisher

# Configure logging - handle both Windows and Linux paths
handlers = [logging.StreamHandler()]

# Try to create log file on Linux
if os.path.exists('/var/log'):
    handlers.append(logging.FileHandler('/var/log/skylark-gps.log'))
elif os.name == 'nt':  # Windows
    log_dir = os.path.expanduser('~/.skylark-gps')
    os.makedirs(log_dir, exist_ok=True)
    handlers.append(logging.FileHandler(os.path.join(log_dir, 'skylark-gps.log')))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=handlers
)
logger = logging.getLogger(__name__)


class GPSProcessor:
    """Main GPS data processing engine"""
    
    def __init__(self, vehicle_id):
        self.vehicle_id = vehicle_id
        self.gps_threads = []
        self.data_buffer = deque(maxlen=300)  # Keep last 5 minutes (1 point/sec)
        self.serial_connections = {}
        self.mqtt_publisher = None
        self.detection_engine = None
        self.is_running = False
        
        # Initialize components
        self._init_mqtt()
        self._init_detection_engine()
        logger.info(f"GPS Processor initialized for vehicle: {vehicle_id}")
    
    def _init_mqtt(self):
        """Initialize MQTT publisher"""
        self.mqtt_publisher = MQTTPublisher(
            broker=MQTT_CONFIG['broker'],
            port=MQTT_CONFIG['port'],
            username=MQTT_CONFIG['username'],
            password=MQTT_CONFIG['password']
        )
        self.mqtt_publisher.connect()
        logger.info("MQTT publisher initialized")
    
    def _init_detection_engine(self):
        """Initialize anomaly detection engine"""
        self.detection_engine = DetectionEngine(
            vehicle_id=self.vehicle_id,
            config=DETECTION_CONFIG
        )
        logger.info("Detection engine initialized")
    
    def connect_gps_modules(self):
        """Establish connections to GPS modules"""
        for port_name, port_config in GPS_PORTS.items():
            try:
                conn = serial.Serial(
                    port=port_config['port'],
                    baudrate=port_config['baudrate'],
                    timeout=1
                )
                self.serial_connections[port_name] = conn
                logger.info(f"Connected to {port_name} on {port_config['port']}")
            except serial.SerialException as e:
                logger.error(f"Failed to connect to {port_name}: {e}")
    
    def read_gps_stream(self, gps_id):
        """Read continuously from GPS module"""
        if gps_id not in self.serial_connections:
            logger.error(f"GPS {gps_id} not connected")
            return
        
        conn = self.serial_connections[gps_id]
        parser = NMEAParser()
        
        logger.info(f"Starting data stream from {gps_id}")
        while self.is_running:
            try:
                if conn.in_waiting:
                    line = conn.readline().decode('utf-8').strip()
                    
                    # Parse NMEA sentence
                    gps_data = parser.parse(line)
                    
                    if gps_data and gps_data.get('latitude') and gps_data.get('longitude'):
                        # Add metadata
                        gps_data['vehicle_id'] = self.vehicle_id
                        gps_data['gps_id'] = gps_id
                        gps_data['timestamp'] = datetime.utcnow().isoformat()
                        
                        # Buffer data
                        self.data_buffer.append(gps_data)
                        
                        # Publish to MQTT
                        self._publish_gps_data(gps_data)
                        
                        # Run detection algorithms
                        self._run_detections(gps_data)
            
            except Exception as e:
                logger.error(f"Error reading from {gps_id}: {e}")
                time.sleep(0.5)
    
    def _publish_gps_data(self, gps_data):
        """Publish GPS data to MQTT"""
        try:
            topic = f"vehicles/{self.vehicle_id}/gps/location"
            payload = {
                'latitude': gps_data['latitude'],
                'longitude': gps_data['longitude'],
                'speed_kmh': gps_data.get('speed', 0),
                'heading': gps_data.get('heading', 0),
                'accuracy_m': gps_data.get('accuracy', 0),
                'timestamp': gps_data['timestamp'],
                'gps_id': gps_data['gps_id']
            }
            self.mqtt_publisher.publish(topic, json.dumps(payload))
        except Exception as e:
            logger.error(f"Error publishing GPS data: {e}")
    
    def _run_detections(self, gps_data):
        """Execute detection algorithms"""
        if len(self.data_buffer) < 10:
            return  # Need minimum data points
        
        # Convert buffer to list for processing
        data_points = list(self.data_buffer)
        
        # Route deviation detection
        deviation_alert = self.detection_engine.detect_route_deviation(data_points)
        if deviation_alert:
            self._publish_alert(deviation_alert)
        
        # Idle behavior detection
        idle_alert = self.detection_engine.detect_idle_behavior(data_points)
        if idle_alert:
            self._publish_alert(idle_alert)
        
        # Fuel consumption anomaly detection
        fuel_alert = self.detection_engine.detect_fuel_anomaly(data_points)
        if fuel_alert:
            self._publish_alert(fuel_alert)
    
    def _publish_alert(self, alert):
        """Publish detection alert"""
        try:
            topic = f"vehicles/{self.vehicle_id}/alerts/{alert['type'].lower()}"
            self.mqtt_publisher.publish(topic, json.dumps(alert))
            logger.warning(f"Alert published: {alert['type']} - {alert['description']}")
        except Exception as e:
            logger.error(f"Error publishing alert: {e}")
    
    def start(self):
        """Start the GPS processor"""
        self.is_running = True
        self.connect_gps_modules()
        
        if not self.serial_connections:
            logger.error("No GPS modules connected!")
            return False
        
        # Start GPS reading threads
        for gps_id in self.serial_connections.keys():
            thread = threading.Thread(target=self.read_gps_stream, args=(gps_id,))
            thread.daemon = True
            thread.start()
            self.gps_threads.append(thread)
            logger.info(f"Started GPS reader thread for {gps_id}")
        
        logger.info("GPS Processor started successfully")
        return True
    
    def stop(self):
        """Stop the GPS processor"""
        self.is_running = False
        
        # Close serial connections
        for conn in self.serial_connections.values():
            conn.close()
        
        # Disconnect MQTT
        self.mqtt_publisher.disconnect()
        
        # Wait for threads to finish
        for thread in self.gps_threads:
            thread.join(timeout=2)
        
        logger.info("GPS Processor stopped")
    
    def get_current_position(self):
        """Get latest GPS position"""
        if len(self.data_buffer) == 0:
            return None
        
        latest = self.data_buffer[-1]
        return {
            'latitude': latest.get('latitude'),
            'longitude': latest.get('longitude'),
            'timestamp': latest.get('timestamp'),
            'accuracy': latest.get('accuracy')
        }
    
    def get_trip_statistics(self):
        """Calculate trip statistics from buffered data"""
        if len(self.data_buffer) < 2:
            return None
        
        data_points = list(self.data_buffer)
        distances = []
        speeds = []
        
        for i in range(1, len(data_points)):
            prev = data_points[i-1]
            curr = data_points[i]
            
            # Calculate distance using haversine
            distance = self._haversine(
                prev['latitude'], prev['longitude'],
                curr['latitude'], curr['longitude']
            )
            distances.append(distance)
            speeds.append(curr.get('speed', 0))
        
        return {
            'total_distance_km': sum(distances),
            'avg_speed_kmh': sum(speeds) / len(speeds) if speeds else 0,
            'max_speed_kmh': max(speeds) if speeds else 0,
            'data_points': len(self.data_buffer),
            'buffer_duration_minutes': len(self.data_buffer) / 60
        }
    
    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2):
        """Calculate distance between two GPS coordinates (in km)"""
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        r = 6371  # Radius of earth in kilometers
        return c * r


def main():
    """Main entry point"""
    processor = GPSProcessor(vehicle_id=VEHICLE_ID)
    
    try:
        if processor.start():
            logger.info("GPS Processor running. Press Ctrl+C to stop.")
            # Keep the processor running
            while True:
                time.sleep(1)
                stats = processor.get_trip_statistics()
                if stats:
                    logger.debug(f"Trip stats: {stats}")
    
    except KeyboardInterrupt:
        logger.info("Shutdown signal received")
    
    finally:
        processor.stop()


if __name__ == '__main__':
    main()
