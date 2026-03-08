# Edge Device (Raspberry Pi)

GPS data collection and anomaly detection on the Raspberry Pi.

## Setup Instructions

### 1. Hardware Assembly

Connect two GPS modules to Raspberry Pi 4:

```
GPS Module 1 (UART):
- VCC → 5V
- GND → GND
- TX → GPIO14 (UART RX)
- RX → GPIO15 (UART TX)

GPS Module 2 (USB):
- USB A → USB Port 2/3
```

### 2. Software Installation

```bash
ssh pi@raspberrypi.local

# Update system
sudo apt update && sudo apt upgrade -y

# Install Python + dependencies
sudo apt install -y python3-dev python3-pip python3-venv

# Create virtual environment
python3 -m venv /opt/skylark/venv
source /opt/skylark/venv/bin/activate

# Install Python packages
pip install -r requirements.txt

# Test multi-GPS reading
python3 gps_parser.py
```

### 3. Verify GPS Operation

```bash
# Check if GPS devices are connected
ls -la /dev/ttyAMA0 /dev/ttyUSB0

# Monitor raw NMEA output
sudo cat /dev/ttyAMA0 | head -20
```

## File Structure

- `gps_parser.py` - Multi-GPS NMEA reader (2 simultaneous modules)
- `kalman_filter.py` - GPS position smoothing
- `offline_queue.py` - SQLite offline buffering
- `alert_scorer.py` - Anomaly scoring engine
- `detectors/` - Individual anomaly detectors
  - `route_deviation.py` - Geofence detection
  - `idle_detection.py` - Vehicle idle detection
  - `fuel_anomaly.py` - Fuel consumption analysis
  - `harsh_driving.py` - Acceleration detection
  - `grade_detection.py` - Elevation-based analysis

## Testing

```bash
# Run unit tests
pytest tests/

# Simulate GPS data
python3 -m tests.test_gps_parser
```

## Systemd Service

To auto-start on boot:

```bash
sudo cp systemd/gps-daemon.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable gps-daemon
sudo systemctl start gps-daemon
sudo systemctl status gps-daemon
```

## Troubleshooting

**GPS not reading?**
- Check `/dev/ttyAMA0` permissions: `ls -la /dev/ttyAMA0`
- Install pyserial: `pip install pyserial`
- Test with: `cat /dev/ttyAMA0`

**MQTT connection failing?**
- Verify broker address in `config/mqtt_config.json`
- Test with: `mosquitto_sub -h localhost -t test`

## Performance Targets

- GPS reading latency: < 100ms
- Anomaly detection: < 50ms
- MQTT message throughput: 50+ messages/sec
- Offline buffer capacity: 48 hours (100,000 points)
