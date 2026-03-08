# Hardware Setup Guide

## GPS Hardware Configuration

### Dual GPS Module Setup

The Skylark Drones system uses two independent GPS modules for redundancy and accuracy:

#### Module 1: USB-Connected GPS (Neo-6M)
- **Connection**: USB-to-Serial adapter
- **Port**: `/dev/ttyUSB0` (Linux/Pi) or `COM3` (Windows)
- **Baud Rate**: 9600
- **Protocol**: NMEA 0183
- **Power**: 5V (via USB)

**Wiring**:
```
GPS Module          USB Adapter
-----------         -----------
VCC    (Red)   →    5V
GND    (Black) →    GND
TX     (Green) →    RX
RX     (White) →    TX
```

#### Module 2: UART-Connected GPS (Neo-6M)
- **Connection**: GPIO UART pins on Raspberry Pi
- **Port**: `/dev/ttyAMA0` (Linux/Pi)
- **Baud Rate**: 9600
- **Protocol**: NMEA 0183
- **Power**: 3.3V from Pi GPIO

**Wiring (Raspberry Pi GPIO)**:
```
GPS Module          Raspberry Pi GPIO
-----------         -----------------
VCC (Red)      →    Pin 1 (3.3V)
GND (Black)    →    Pin 6 (GND)
TX (Green)     →    Pin 10 (GPIO 15 RXD)
RX (White)     →    Pin 8 (GPIO 14 TXD)
```

### Raspberry Pi Configuration

#### Enable UART
1. Edit `/boot/config.txt`:
   ```bash
   sudo nano /boot/config.txt
   ```

2. Add or modify:
   ```
   dtoverlay=pi3-miniuart-bt
   enable_uart=1
   ```

3. Disable serial login:
   ```bash
   sudo raspi-config
   # Select: Interfacing Options → Serial → Disable Login Shell
   ```

4. Reboot:
   ```bash
   sudo reboot
   ```

#### Enable GPIO Permissions
```bash
sudo usermod -a -G dialout $USER
# Logout and login for changes to take effect
```

### Tested GPS Devices

| Model | Accuracy | Cost | Notes |
|-------|----------|------|-------|
| u-blox Neo-6M | ±2.5m | $30-50 | Recommended, widely available |
| u-blox Neo-8M | ±2.0m | $40-60 | Better accuracy, backward compatible |
| Quectel L70 | ±2.0m | $35-55 | Good for IoT, industrial grade |

### Power Consumption

| Component | Current (mA) | Voltage |
|-----------|-------------|---------|
| Raspberry Pi 4 | 500-800 | 5V |
| GPS Module (USB) | 50-100 | 5V |
| GPS Module (UART) | 30-50 | 3.3V |
| **Total Peak** | ~1000 mA | 5V |

**Power Supply Recommendation**: 3A @ 5V minimum

### Testing the Connection

#### Test USB Module
```bash
cat /dev/ttyUSB0
# Should show NMEA sentences like:
# $GPGGA,093000.00,4717.39480,-07305.64961,1,08,1.52,1.7,M,-34.3,M,,*49
```

#### Test UART Module
```bash
cat /dev/ttyAMA0
# Should show NMEA sentences
```

#### Using gpspipe (if gpsd is installed)
```bash
gpspipe -r
```

### Troubleshooting Hardware

**Issue**: No data from GPS module
- Check physical connections
- Verify baud rate (9600)
- Test with `cat /dev/ttyXXX`
- Check power supply (should be stable 5V)

**Issue**: Intermittent GPS connection
- Check for loose connections
- Verify UART is enabled on Pi
- Check for electromagnetic interference
- Test signal quality in outdoor location

**Issue**: Low satellite count (< 4)
- Move antenna to better sky view
- Check for obstructions
- Wait for cold start (can take 5-10 minutes)
- Test with u-blox u-center software

### NMEA Sentence Format

The system parses two key NMEA sentence types:

**GGA (Global Positioning System Fix Data)**:
```
$GPGGA,hhmmss.ss,llll.lllll,a,yyyyy.yyyyy,a,x,xx,x.x,x.x,M,x.x,M,x.x,xxxx
         |           |         |  |          |  | |  | |  |   |   |    |
         |           |         |  |          |  | |  | |  |   |   |    └─ DGPS age
         |           |         |  |          |  | |  | |  |   |   └───── DGPS ID
         |           |         |  |          |  | |  | |  |   └───────── Geoid height
         |           |         |  |          |  | |  | └──────────────── Altitude (m)
         |           |         |  |          |  | |  └─────────────────── HDOP
         |           |         |  |          │  | └────────────────────── Satellite count
         |           |         |  |          │  └────────────────────── Fix quality
         |           |         |  └──────────┴─── Longitude
         |           └────────────────────────── Latitude
         └─────────────────────────────────── UTC Time
```

**RMC (Recommended Minimum Navigation Information)**:
```
$GPRMC,hhmmss.ss,A,llll.lllll,a,yyyyy.yyyyy,a,x.xx,x.xx,ddmmyy,x.xx,a
        |          |  |         |  |          |  |    |      |      |    |
        |          |  |         |  |          |  |    |      |      |    └─ Mode indicator
        |          |  |         |  |          |  |    |      |      └────── Magnetic variation
        |          |  |         |  |          |  |    |      └──────────── Date
        |          |  |         |  |          |  |    └──────────────────── Track angle
        |          |  |         |  |          |  └────────────────────────── Speed (knots)
        |          |  |         |  └──────────┴─── Longitude
        |          |  └────────────────────────── Latitude
        |          └──────────────────────────── Status (A=valid, V=void)
        └──────────────────────────────────────── UTC Time
```

### Kalman Filter Tuning

The Kalman filter smooths GPS data for ±2m accuracy:

**Configuration** (in `edge/config.py`):
```python
KALMAN_CONFIG = {
    "process_variance": 1e-5,    # How much GPS changes between samples
    "measurement_variance": 0.001 # How much we trust individual readings
}
```

**Effects of Tuning**:
- **Increase Q** (process_variance): More responsive to real movement
- **Increase R** (measurement_variance): Smoother but delayed response
- **Recommended**: Q = 1e-5, R = 0.001 for vehicle tracking

---

## Reference

- [u-blox Neo-6M Datasheet](https://www.u-blox.com/en/product/neo-6-series)
- [NMEA 0183 Specification](http://www.nmea.org/)
- [Raspberry Pi GPIO Pins](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html)
- [Kalman Filter Explanation](https://en.wikipedia.org/wiki/Kalman_filter)
