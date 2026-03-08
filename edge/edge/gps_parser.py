"""
Multi-GPS NMEA Parser
Reads from 2 simultaneous GPS modules (UART + USB)
"""

import pynmea2
import serial
import threading
from datetime import datetime
import time
import sys

class MultiGPSReader:
    """
    Initialize and read from dual GPS modules
    """
    def __init__(self, uart_port='/dev/ttyAMA0', usb_port='/dev/ttyUSB0', baudrate=9600):
        self.baudrate = baudrate
        self.uart_port = uart_port
        self.usb_port = usb_port
        self.latest_gps = {
            'gps1': {'lat': 0, 'lon': 0, 'speed': 0, 'timestamp': None, 'accuracy': 0, 'satellites': 0},
            'gps2': {'lat': 0, 'lon': 0, 'speed': 0, 'timestamp': None, 'accuracy': 0, 'satellites': 0}
        }
        self.lock = threading.Lock()
        self.uart_serial = None
        self.usb_serial = None
    
    def connect(self):
        """Establish connections to both GPS modules"""
        try:
            # Try to connect to UART GPS
            try:
                self.uart_serial = serial.Serial(self.uart_port, self.baudrate, timeout=1)
                print(f"✅ [GPS1] Connected to UART: {self.uart_port}")
            except Exception as e:
                print(f"⚠️  [GPS1] UART connection failed: {e}")
                self.uart_serial = None
            
            # Try to connect to USB GPS
            try:
                self.usb_serial = serial.Serial(self.usb_port, self.baudrate, timeout=1)
                print(f"✅ [GPS2] Connected to USB: {self.usb_port}")
            except Exception as e:
                print(f"⚠️  [GPS2] USB connection failed: {e}")
                self.usb_serial = None
            
            if not self.uart_serial and not self.usb_serial:
                raise Exception("Could not connect to any GPS module")
                
        except Exception as e:
            print(f"❌ Connection error: {e}")
            raise
    
    def _read_gps(self, serial_obj, gps_id):
        """Read from single GPS module in background thread"""
        if not serial_obj:
            return
            
        while True:
            try:
                line = serial_obj.readline().decode('utf-8', errors='ignore').strip()
                if not line:
                    continue
                
                # Parse NMEA sentence
                try:
                    msg = pynmea2.parse(line)
                except:
                    continue
                
                # Extract GGA (position + satellites)
                if hasattr(msg, 'sentence_type') and msg.sentence_type == 'GGA':
                    with self.lock:
                        self.latest_gps[gps_id].update({
                            'lat': float(msg.latitude) if msg.latitude else 0,
                            'lon': float(msg.longitude) if msg.longitude else 0,
                            'timestamp': datetime.utcnow().isoformat(),
                            'accuracy': int(msg.num_sats) * 2 if msg.num_sats else 0,
                            'satellites': int(msg.num_sats) if msg.num_sats else 0
                        })
                
                # Extract RMC (speed)
                elif hasattr(msg, 'sentence_type') and msg.sentence_type == 'RMC':
                    speed = msg.spd_over_grnd if hasattr(msg, 'spd_over_grnd') else 0
                    with self.lock:
                        self.latest_gps[gps_id]['speed'] = float(speed) if speed else 0
                        
            except Exception as e:
                print(f"[{gps_id}] Parse error: {e}")
                pass
    
    def start(self):
        """Start background threads for both GPS modules"""
        if self.uart_serial:
            t1 = threading.Thread(target=self._read_gps, args=(self.uart_serial, 'gps1'), daemon=True)
            t1.start()
        
        if self.usb_serial:
            t2 = threading.Thread(target=self._read_gps, args=(self.usb_serial, 'gps2'), daemon=True)
            t2.start()
        
        print("[GPS] Multi-GPS reader started")
    
    def get_latest(self):
        """Return latest GPS data from both modules"""
        with self.lock:
            return self.latest_gps.copy()
    
    def close(self):
        """Close all serial connections"""
        if self.uart_serial:
            self.uart_serial.close()
        if self.usb_serial:
            self.usb_serial.close()


if __name__ == '__main__':
    reader = MultiGPSReader()
    
    try:
        reader.connect()
        reader.start()
        
        print("\n📡 Reading GPS data (Ctrl+C to exit)...\n")
        
        while True:
            gps_data = reader.get_latest()
            
            # Format output
            gps1 = gps_data['gps1']
            gps2 = gps_data['gps2']
            
            status1 = '✅' if gps1['satellites'] > 3 else '⚠️ '
            status2 = '✅' if gps2['satellites'] > 3 else '⚠️ '
            
            print(f"\r{status1} GPS1: ({gps1['lat']:.4f}, {gps1['lon']:.4f}) | Speed: {gps1['speed']:.1f}kt | Sats: {gps1['satellites']}   ", end='', flush=True)
            print(f"  {status2} GPS2: ({gps2['lat']:.4f}, {gps2['lon']:.4f}) | Speed: {gps2['speed']:.1f}kt | Sats: {gps2['satellites']}   ", flush=True)
            
            time.sleep(1)
    
    except KeyboardInterrupt:
        print("\n\n[GPS] Shutting down...")
        reader.close()
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        reader.close()
        sys.exit(1)
