"""
MQTT Publisher for IoT Data
Handles secure publish of GPS data and alerts to cloud MQTT broker
"""

import paho.mqtt.client as mqtt
import json
import time
import logging
from typing import Dict

logger = logging.getLogger(__name__)


class MQTTPublisher:
    """MQTT client for publishing vehicle data"""
    
    def __init__(self, broker: str, port: int, username: str, password: str):
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password
        self.client = None
        self.is_connected = False
        self._init_client()
    
    def _init_client(self):
        """Initialize MQTT client"""
        self.client = mqtt.Client(client_id="skylark-edge-gps")
        self.client.username_pw_set(self.username, self.password)
        
        # Set callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_publish = self._on_publish
        self.client.on_message = self._on_message
    
    def _on_connect(self, client, userdata, flags, rc):
        """Callback on connection"""
        if rc == 0:
            self.is_connected = True
            logger.info("MQTT connected successfully")
        else:
            logger.error(f"MQTT connection failed with code {rc}")
    
    def _on_disconnect(self, client, userdata, rc):
        """Callback on disconnection"""
        self.is_connected = False
        if rc != 0:
            logger.warning(f"Unexpected MQTT disconnection (code {rc})")
    
    def _on_publish(self, client, userdata, mid):
        """Callback on successful publish"""
        logger.debug(f"Message {mid} published")
    
    def _on_message(self, client, userdata, msg):
        """Callback on message received"""
        logger.debug(f"Message received on {msg.topic}: {msg.payload.decode()}")
    
    def connect(self):
        """Connect to MQTT broker with automatic reconnection"""
        try:
            self.client.connect(self.broker, self.port, keepalive=60)
            self.client.loop_start()  # Start network loop
            
            # Wait for connection
            timeout = 5
            elapsed = 0
            while not self.is_connected and elapsed < timeout:
                time.sleep(0.1)
                elapsed += 0.1
            
            if self.is_connected:
                logger.info(f"Connected to MQTT broker {self.broker}:{self.port}")
                return True
            else:
                logger.error("Failed to connect to MQTT broker")
                return False
        
        except Exception as e:
            logger.error(f"Error connecting to MQTT: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from MQTT broker"""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            self.is_connected = False
            logger.info("Disconnected from MQTT broker")
    
    def publish(self, topic: str, payload: str, qos: int = 1) -> bool:
        """
        Publish message to MQTT topic
        
        Args:
            topic: MQTT topic path
            payload: Message payload (JSON string)
            qos: Quality of Service (0=at most once, 1=at least once, 2=exactly once)
        
        Returns:
            True if publish successful, False otherwise
        """
        
        if not self.is_connected:
            logger.warning(f"MQTT not connected, skipping publish to {topic}")
            return False
        
        try:
            result = self.client.publish(topic, payload, qos=qos)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.debug(f"Published to {topic}")
                return True
            else:
                logger.error(f"Error publishing to {topic}: {result.rc}")
                return False
        
        except Exception as e:
            logger.error(f"Exception publishing to {topic}: {e}")
            return False
    
    def subscribe(self, topic: str):
        """
        Subscribe to MQTT topic for receiving commands
        
        Args:
            topic: MQTT topic path
        """
        
        try:
            result = self.client.subscribe(topic)
            if result[0] == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"Subscribed to {topic}")
            else:
                logger.error(f"Error subscribing to {topic}: {result[0]}")
        
        except Exception as e:
            logger.error(f"Exception subscribing to {topic}: {e}")


class MockMQTTPublisher:
    """Mock MQTT publisher for development/testing without broker"""
    
    def __init__(self, broker: str, port: int, username: str, password: str):
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password
        self.is_connected = True
        self.published_messages = []
        logger.info(f"Mock MQTT publisher initialized (broker: {broker})")
    
    def connect(self):
        """Mock connect"""
        self.is_connected = True
        logger.info("Mock MQTT: Connected")
        return True
    
    def disconnect(self):
        """Mock disconnect"""
        self.is_connected = False
        logger.info("Mock MQTT: Disconnected")
    
    def publish(self, topic: str, payload: str, qos: int = 1) -> bool:
        """Mock publish - just log in memory"""
        message = {
            'topic': topic,
            'payload': json.loads(payload) if isinstance(payload, str) else payload,
            'qos': qos
        }
        self.published_messages.append(message)
        logger.debug(f"Mock publish to {topic}: {payload[:100]}")
        return True
    
    def subscribe(self, topic: str):
        """Mock subscribe"""
        logger.info(f"Mock MQTT: Subscribed to {topic}")
    
    def get_published_messages(self):
        """Get all published messages (for testing)"""
        return self.published_messages


# MQTT Topic Schema Reference
"""
Topic Hierarchy for Skylark Drones System:

vehicles/{vehicle_id}/gps/location
  - Current position, speed, heading
  - Published 1x per second (5Hz GPS decimated)
  
vehicles/{vehicle_id}/gps/accuracy
  - GPS accuracy metrics
  - Published 1x per second
  
vehicles/{vehicle_id}/alerts/deviation
  - Route deviation alerts
  - Published on-demand when deviation detected
  
vehicles/{vehicle_id}/alerts/idle
  - Idle behavior alerts
  - Published when idle detected
  
vehicles/{vehicle_id}/alerts/fuel
  - Fuel consumption anomaly alerts
  - Published when anomaly detected
  
vehicles/{vehicle_id}/statistics
  - Trip statistics (distance, avg speed, duration)
  - Published every 5 minutes
  
vehicles/{vehicle_id}/health
  - Device health (battery, temp, GPS fix quality)
  - Published every 30 seconds
  
system/health/connection
  - Connectivity status
  - Published every 30 seconds
  
system/health/gps_status
  - Number of satellites, signal strength
  - Published every 30 seconds
  
commands/{vehicle_id}/geofence
  - Update geofence boundaries
  - Subscribed for commands
  
commands/{vehicle_id}/config
  - Update detection parameters
  - Subscribed for commands
"""
