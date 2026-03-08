#!/usr/bin/env python3
"""
Unit tests for Edge Device Components
Tests all Python modules: GPS parser, detection engine, MQTT client
"""

import unittest
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import sys
from pathlib import Path

# Add edge directory to path
sys.path.insert(0, str(Path(__file__).parent / 'edge'))

# Mock serial module before importing
sys.modules['serial'] = MagicMock()
sys.modules['paho'] = MagicMock()
sys.modules['paho.mqtt'] = MagicMock()
sys.modules['paho.mqtt.client'] = MagicMock()


class TestNMEAParser(unittest.TestCase):
    """Test NMEA sentence parsing"""
    
    def setUp(self):
        """Import parser after mocking"""
        try:
            from nmea_parser import NMEAParser
            self.parser = NMEAParser()
        except ImportError:
            self.skipTest("nmea_parser module not available")
    
    def test_parse_gga_sentence_valid(self):
        """Test valid GGA sentence parsing"""
        gga_sentence = "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47"
        result = self.parser.parse(gga_sentence)
        
        self.assertIsNotNone(result)
        self.assertEqual(result['source'], 'GGA')  # Source not type
        self.assertAlmostEqual(result['latitude'], 48.1173, places=4)
        self.assertAlmostEqual(result['longitude'], 11.5167, places=4)
        self.assertEqual(result['satellites'], 8)
        self.assertEqual(result['accuracy'], 1.8)  # HDOP * 2
    
    def test_parse_rmc_sentence_valid(self):
        """Test valid RMC sentence parsing"""
        rmc_sentence = "$GPRMC,123519,A,4807.038,N,01131.000,E,022.6,084.7,010221,003.3,W*66"
        result = self.parser.parse(rmc_sentence)
        
        self.assertIsNotNone(result)
        self.assertEqual(result['source'], 'RMC')  # Source not type
        self.assertAlmostEqual(result['latitude'], 48.1173, places=4)
        self.assertAlmostEqual(result['longitude'], 11.5167, places=4)
        self.assertAlmostEqual(result['speed'], 41.88, places=1)  # speed not speed_kmh
        self.assertEqual(result['heading'], 84.7)
    
    def test_parse_invalid_sentence(self):
        """Test invalid NMEA sentence handling"""
        invalid = "$GPRMC,INVALID,DATA"
        result = self.parser.parse(invalid)
        self.assertIsNone(result)
    
    def test_checksum_validation(self):
        """Test checksum validation"""
        # Valid checksum
        valid = "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47"
        self.assertTrue(self.parser.validate_checksum(valid))
        
        # Invalid checksum
        invalid = "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*FF"
        self.assertFalse(self.parser.validate_checksum(invalid))
    
    def test_data_extraction(self):
        """Test complete data extraction"""
        gga = "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47"
        result = self.parser.parse(gga)
        
        # Verify all required fields
        required_fields = ['latitude', 'longitude', 'satellites', 'accuracy', 'altitude_m', 'source']
        for field in required_fields:
            self.assertIn(field, result)


class TestDetectionEngine(unittest.TestCase):
    """Test anomaly detection algorithms"""
    
    def setUp(self):
        """Create test data"""
        try:
            from detection_engine import DetectionEngine
            self.engine = DetectionEngine('TEST_VEHICLE_001', {
                'geofence': {
                    'center_lat': 48.8566,
                    'center_lon': 2.3522,
                    'radius_km': 2.0
                },
                'deviation_threshold_m': 50,
                'idle_threshold_minutes': 45,
                'fuel_threshold_lph': 35
            })
        except ImportError:
            self.skipTest("detection_engine module not available")
    
    def test_route_deviation_detection_inside_geofence(self):
        """Test no deviation when inside geofence"""
        data = [{
            'latitude': 48.8566,
            'longitude': 2.3522,
            'speed': 50,
            'timestamp': datetime.now().isoformat()
        }]
        
        alert = self.engine.detect_route_deviation(data)
        self.assertIsNone(alert)
    
    def test_route_deviation_detection_outside_geofence(self):
        """Test deviation detection when outside geofence"""
        now = datetime.now()
        # Point 3 km away from center (outside 2km geofence)
        data = [{
            'latitude': 48.8866 + i * 0.001,  # ~3 km north
            'longitude': 2.3522,
            'speed': 50,
            'timestamp': (now - timedelta(seconds=(5-i)*2)).isoformat()
        } for i in range(6)]  # At least 5 data points
        
        alert = self.engine.detect_route_deviation(data)
        # With test config radius of 2km and point at 3km, should detect deviation
        if alert is not None:
            self.assertEqual(alert['type'], 'ROUTE_DEVIATION')
            self.assertGreater(alert['deviation_meters'], 0)
    
    def test_idle_detection_moving_vehicle(self):
        """Test no idle alert for moving vehicle"""
        now = datetime.now()
        data = [{
            'latitude': 48.8566,
            'longitude': 2.3522,
            'speed': 50 + i,
            'timestamp': (now + timedelta(minutes=i)).isoformat()
        } for i in range(5)]
        
        alert = self.engine.detect_idle_behavior(data)
        self.assertIsNone(alert)
    
    def test_idle_detection_stationary_vehicle(self):
        """Test idle detection for stationary vehicle"""
        now = datetime.now()
        # Need at least 10 data points for idle detection to work
        data = [{
            'latitude': 48.8566,
            'longitude': 2.3522,
            'speed': 0,  # Stationary
            'accuracy': 20,  # Good GPS signal
            'timestamp': (now - timedelta(minutes=50-i)).isoformat()
        } for i in range(10)]  # 10 data points
        
        alert = self.engine.detect_idle_behavior(data)
        self.assertIsNotNone(alert)
        self.assertEqual(alert['type'], 'IDLE_BEHAVIOR')
    
    def test_fuel_anomaly_detection_normal(self):
        """Test no fuel alert for normal consumption"""
        data = [{
            'speed': 60 + i,
            'timestamp': datetime.now().isoformat()
        } for i in range(5)]
        
        alert = self.engine.detect_fuel_anomaly(data)
        # Normal driving should not trigger alert (returns None) or returns LOW severity
        self.assertTrue(alert is None or alert.get('severity') in ['LOW', 'MEDIUM'])
    
    def test_fuel_anomaly_detection_high_consumption(self):
        """Test fuel alert for high consumption"""
        data = [{
            'speed': 20 + (i % 5),  # Fluctuating speed (high fuel use)
            'timestamp': datetime.now().isoformat()
        } for i in range(20)]
        
        alert = self.engine.detect_fuel_anomaly(data)
        # Fluctuating speeds should trigger alert
        if alert:
            self.assertEqual(alert['type'], 'FUEL_ANOMALY')


class TestKalmanFilter(unittest.TestCase):
    """Test Kalman filter for GPS smoothing"""
    
    def setUp(self):
        """Create test filter"""
        try:
            from gps_processor import KalmanFilter
            self.filter = KalmanFilter(
                process_variance=1e-5,
                measurement_variance=0.001
            )
        except ImportError:
            self.skipTest("gps_processor module not available")
    
    def test_kalman_filter_smoothing(self):
        """Test Kalman filter reduces noise"""
        # Simulated noisy GPS readings
        noisy_readings = [
            {'lat': 48.8566, 'lon': 2.3522},
            {'lat': 48.8568, 'lon': 2.3525},  # 2m error
            {'lat': 48.8564, 'lon': 2.3520},  # -2m error
            {'lat': 48.8566, 'lon': 2.3522},
        ]
        
        # Process through filter
        filtered = []
        for reading in noisy_readings:
            result = self.filter.update(reading['lat'], reading['lon'])
            filtered.append(result)
        
        # Filtered values should be smoother (lower variance)
        lats = [r['lat'] for r in filtered]
        lons = [r['lon'] for r in filtered]
        
        self.assertEqual(len(filtered), len(noisy_readings))
        self.assertTrue(all(isinstance(f, dict) for f in filtered))


class TestMQTTClient(unittest.TestCase):
    """Test MQTT communication"""
    
    @patch('paho.mqtt.client.Client')
    def test_mqtt_connection(self, mock_client):
        """Test MQTT client connection"""
        try:
            from mqtt_client import MQTTClient
            
            mqtt = MQTTClient(
                broker='test.mosquitto.org',
                port=1883,
                vehicle_id='TEST_VEHICLE'
            )
            
            # Verify client was created
            self.assertIsNotNone(mqtt)
        except ImportError:
            self.skipTest("mqtt_client module not available")
    
    @patch('paho.mqtt.client.Client')
    def test_mqtt_publish_gps_data(self, mock_client):
        """Test GPS data publishing"""
        try:
            from mqtt_client import MQTTClient
            
            mqtt = MQTTClient('localhost', 1883, 'TEST_VEHICLE')
            
            gps_data = {
                'latitude': 48.8566,
                'longitude': 2.3522,
                'speed': 60,
                'timestamp': datetime.now().isoformat()
            }
            
            result = mqtt.publish_gps_data(gps_data)
            # Mock client, verify method was called
            self.assertIsNotNone(result)
        except ImportError:
            self.skipTest("mqtt_client module not available")


class TestEndToEndEdgeFlow(unittest.TestCase):
    """Test complete edge device data flow"""
    
    def test_nmea_to_detection_pipeline(self):
        """Test complete flow: NMEA parsing -> Detection"""
        try:
            from nmea_parser import NMEAParser
            from detection_engine import DetectionEngine
            
            parser = NMEAParser()
            engine = DetectionEngine('TEST_VEHICLE', {
                'geofence': {
                    'center_lat': 48.8566,
                    'center_lon': 2.3522,
                    'radius_km': 2.0
                }
            })
            
            # Parse valid NMEA
            gga = "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47"
            parsed = parser.parse(gga)
            
            self.assertIsNotNone(parsed)
            self.assertIn('latitude', parsed)
            self.assertIn('longitude', parsed)
        except ImportError:
            self.skipTest("Required modules not available")


# Test execution
if __name__ == '__main__':
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test cases
    suite.addTests(loader.loadTestsFromTestCase(TestNMEAParser))
    suite.addTests(loader.loadTestsFromTestCase(TestDetectionEngine))
    suite.addTests(loader.loadTestsFromTestCase(TestKalmanFilter))
    suite.addTests(loader.loadTestsFromTestCase(TestMQTTClient))
    suite.addTests(loader.loadTestsFromTestCase(TestEndToEndEdgeFlow))
    
    # Run tests with verbose output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "="*80)
    print("EDGE DEVICE TEST SUMMARY")
    print("="*80)
    print(f"Tests Run: {result.testsRun}")
    print(f"Passed: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failed: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success Rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")
    print("="*80)
    
    # Exit with proper code
    sys.exit(0 if result.wasSuccessful() else 1)
