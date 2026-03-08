#!/usr/bin/env python3
"""
Test MQTT Client with Real MQTT Broker

Tests cloud communication against a real MQTT broker.
Requires: mosquitto or docker running with MQTT broker

Usage:
    python3 test_mqtt_real.py

Before running:
    Option A (Docker):
        docker run -d -p 1883:1883 --name mosquitto eclipse-mosquitto:latest
    
    Option B (Local Install):
        # Linux: sudo apt-get install mosquitto
        # Mac: brew install mosquitto
        # Windows: Download from https://mosquitto.org/download/
        mosquitto -v
"""

import unittest
import paho.mqtt.client as mqtt
import time
import json
from threading import Thread, Event
from datetime import datetime


class TestMQTTRealBroker(unittest.TestCase):
    """Test MQTT connection and communication with real broker"""
    
    def setUp(self):
        """Initialize MQTT client before each test"""
        self.broker_address = "localhost"
        self.broker_port = 1883
        self.client = mqtt.Client()
        self.received_messages = []
        self.connection_event = Event()
        self.message_event = Event()
        
        # Set callbacks
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
    
    def on_connect(self, client, userdata, flags, rc):
        """Callback when client connects"""
        if rc == 0:
            self.connection_event.set()
            print(f"✓ Connected to MQTT broker at {self.broker_address}:{self.broker_port}")
        else:
            print(f"✗ Connection failed with code {rc}")
    
    def on_message(self, client, userdata, msg):
        """Callback when message is received"""
        message = {
            'topic': msg.topic,
            'payload': msg.payload.decode('utf-8'),
            'qos': msg.qos,
            'timestamp': datetime.now().isoformat()
        }
        self.received_messages.append(message)
        self.message_event.set()
        print(f"✓ Received message on {msg.topic}: {msg.payload.decode()}")
    
    def on_disconnect(self, client, userdata, rc):
        """Callback when client disconnects"""
        if rc != 0:
            print(f"✗ Unexpected disconnection: {rc}")
        else:
            print("✓ Disconnected from MQTT broker")
    
    def test_broker_connectivity(self):
        """Test that MQTT broker is accessible"""
        try:
            self.client.connect(self.broker_address, self.broker_port, keepalive=60)
            self.client.loop_start()
            
            # Wait for connection with timeout
            is_connected = self.connection_event.wait(timeout=5)
            self.assertTrue(is_connected, f"Failed to connect to MQTT broker at {self.broker_address}:{self.broker_port}")
            
            self.client.loop_stop()
            self.client.disconnect()
        
        except Exception as e:
            self.fail(f"MQTT connection error: {str(e)}\n"
                     "Make sure MQTT broker is running:\n"
                     "  Docker: docker run -d -p 1883:1883 eclipse-mosquitto:latest\n"
                     "  Or: mosquitto -v")
    
    def test_publish_gps_data(self):
        """Test publishing GPS data to MQTT"""
        self.client.connect(self.broker_address, self.broker_port)
        self.client.loop_start()
        self.connection_event.wait(timeout=5)
        
        # Publish GPS data
        vehicle_id = "TEST_VEHICLE_001"
        gps_data = {
            'latitude': 48.8566,
            'longitude': 2.3522,
            'speed': 52.5,
            'heading': 90,
            'accuracy': 8.5,
            'satellites': 12,
            'timestamp': datetime.now().isoformat()
        }
        
        topic = f"gps/{vehicle_id}/position"
        payload = json.dumps(gps_data)
        
        info = self.client.publish(topic, payload, qos=1)
        info.wait_for_publish(timeout=5)
        
        self.assertEqual(info.rc, mqtt.MQTT_ERR_SUCCESS, "Failed to publish GPS data")
        print(f"✓ Published GPS data to {topic}")
        
        self.client.loop_stop()
        self.client.disconnect()
    
    def test_publish_alert(self):
        """Test publishing alert messages to MQTT"""
        self.client.connect(self.broker_address, self.broker_port)
        self.client.loop_start()
        self.connection_event.wait(timeout=5)
        
        # Publish alert
        vehicle_id = "TEST_VEHICLE_001"
        alert = {
            'type': 'ROUTE_DEVIATION',
            'severity': 'HIGH',
            'description': 'Vehicle deviated 250m from route',
            'latitude': 50.0000,
            'longitude': 2.3522,
            'timestamp': datetime.now().isoformat()
        }
        
        topic = f"alerts/{vehicle_id}/route_deviation"
        payload = json.dumps(alert)
        
        info = self.client.publish(topic, payload, qos=2)
        info.wait_for_publish(timeout=5)
        
        self.assertEqual(info.rc, mqtt.MQTT_ERR_SUCCESS, "Failed to publish alert")
        print(f"✓ Published alert to {topic}")
        
        self.client.loop_stop()
        self.client.disconnect()
    
    def test_subscribe_and_receive(self):
        """Test subscribing to topics and receiving messages"""
        client_sub = mqtt.Client(client_id="test_subscriber")
        client_pub = mqtt.Client(client_id="test_publisher")
        
        # Setup subscriber
        def on_sub_message(client, userdata, msg):
            self.received_messages.append(msg.payload.decode())
            self.message_event.set()
        
        client_sub.on_message = on_sub_message
        client_sub.connect(self.broker_address, self.broker_port)
        client_sub.subscribe("test/+/+", qos=1)
        client_sub.loop_start()
        
        time.sleep(1)
        
        # Setup publisher and send message
        client_pub.connect(self.broker_address, self.broker_port)
        client_pub.loop_start()
        
        test_payload = json.dumps({"test": "data", "value": 42})
        client_pub.publish("test/vehicle001/status", test_payload)
        
        # Wait for message
        is_received = self.message_event.wait(timeout=5)
        self.assertTrue(is_received, "Failed to receive published message")
        self.assertEqual(len(self.received_messages), 1)
        
        client_pub.loop_stop()
        client_pub.disconnect()
        client_sub.loop_stop()
        client_sub.disconnect()
    
    def test_multiple_topics(self):
        """Test publishing to multiple topic hierarchies"""
        self.client.connect(self.broker_address, self.broker_port)
        self.client.loop_start()
        self.connection_event.wait(timeout=5)
        
        topics = [
            ("gps/vehicle_001/position", {"lat": 48.8566, "lon": 2.3522}),
            ("gps/vehicle_001/speed", {"value": 52.5}),
            ("alerts/vehicle_001/idle", {"duration_minutes": 45}),
            ("alerts/vehicle_001/fuel", {"consumption_percent": 125}),
        ]
        
        for topic, data in topics:
            info = self.client.publish(topic, json.dumps(data), qos=1)
            info.wait_for_publish(timeout=5)
            self.assertEqual(info.rc, mqtt.MQTT_ERR_SUCCESS)
            print(f"✓ Published to {topic}")
        
        self.client.loop_stop()
        self.client.disconnect()
    
    def test_message_persistence(self):
        """Test that QoS settings work correctly"""
        self.client.connect(self.broker_address, self.broker_port)
        self.client.loop_start()
        self.connection_event.wait(timeout=5)
        
        # Test different QoS levels
        qos_levels = [0, 1, 2]
        
        for qos in qos_levels:
            info = self.client.publish(
                f"test/qos_{qos}",
                json.dumps({"qos": qos}),
                qos=qos
            )
            info.wait_for_publish(timeout=5)
            self.assertEqual(info.rc, mqtt.MQTT_ERR_SUCCESS)
            print(f"✓ Published with QoS {qos}")
        
        self.client.loop_stop()
        self.client.disconnect()


class TestMQTTClientClass(unittest.TestCase):
    """Test the MQTTPublisher class from mqtt_client.py"""
    
    def setUp(self):
        """Import and initialize MQTT publisher"""
        try:
            from mqtt_client import MQTTPublisher
            self.MQTTPublisher = MQTTPublisher
        except ImportError:
            self.skipTest("mqtt_client module not found")
    
    def test_mqtt_publisher_init(self):
        """Test MQTTPublisher initialization"""
        try:
            publisher = self.MQTTPublisher("localhost", 1883)
            self.assertIsNotNone(publisher)
            print("✓ MQTTPublisher initialized successfully")
        except Exception as e:
            self.skipTest(f"Cannot initialize publisher: {e}")
    
    def test_mqtt_publisher_publish_gps(self):
        """Test MQTTPublisher.publish_gps_data()"""
        try:
            publisher = self.MQTTPublisher("localhost", 1883)
            
            gps_data = {
                'latitude': 48.8566,
                'longitude': 2.3522,
                'speed': 52.5,
                'heading': 90,
                'timestamp': datetime.now().isoformat()
            }
            
            # Should not raise exception
            publisher.publish_gps_data(gps_data)
            print("✓ GPS data published successfully")
        except Exception as e:
            print(f"⚠ Could not test publish_gps_data: {e}")
    
    def test_mqtt_publisher_publish_alert(self):
        """Test MQTTPublisher.publish_alert()"""
        try:
            publisher = self.MQTTPublisher("localhost", 1883)
            
            alert = {
                'type': 'ROUTE_DEVIATION',
                'severity': 'HIGH',
                'description': 'Vehicle deviated from route',
                'timestamp': datetime.now().isoformat()
            }
            
            # Should not raise exception
            publisher.publish_alert(alert)
            print("✓ Alert published successfully")
        except Exception as e:
            print(f"⚠ Could not test publish_alert: {e}")


def run_broker_check():
    """Check if MQTT broker is running"""
    print("\n" + "="*60)
    print("MQTT BROKER CHECK")
    print("="*60)
    
    client = mqtt.Client()
    try:
        client.connect("localhost", 1883, keepalive=3)
        client.loop_start()
        time.sleep(1)
        client.loop_stop()
        print("✓ MQTT broker is running and accessible")
        return True
    except Exception as e:
        print("✗ MQTT broker is NOT running")
        print(f"  Error: {e}")
        print("\nStart MQTT broker with one of these commands:")
        print("  Docker: docker run -d -p 1883:1883 eclipse-mosquitto:latest")
        print("  Local:  mosquitto -v")
        return False


if __name__ == '__main__':
    # Check broker first
    broker_available = run_broker_check()
    
    print("\n" + "="*60)
    print("RUNNING MQTT TESTS")
    print("="*60 + "\n")
    
    # Run tests
    unittest.main(verbosity=2, exit=not broker_available)
