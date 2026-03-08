"""
NMEA Protocol Parser
Handles parsing of NMEA 0183 sentences from u-blox GPS modules

Supported sentences:
- $GPGGA: Global Positioning System Fix Data
- $GPRMC: Recommended Minimum Navigation Information
- $GPGSV: GPS Satellites in View
"""

import re
from typing import Optional, Dict


class NMEAParser:
    """Parse NMEA sentences from GPS modules"""
    
    def __init__(self):
        self.last_valid_fix = None
    
    def parse(self, sentence: str) -> Optional[Dict]:
        """
        Parse NMEA sentence and extract GPS data
        
        Args:
            sentence: Raw NMEA sentence (e.g., "$GPGGA,...")
        
        Returns:
            Dictionary with parsed GPS data or None if invalid
        """
        
        if not sentence or not sentence.startswith('$'):
            return None
        
        try:
            # Validate checksum
            if not self._validate_checksum(sentence):
                return None
            
            # Determine sentence type
            if sentence.startswith('$GPGGA') or sentence.startswith('$GNGGA'):
                return self._parse_gga(sentence)
            elif sentence.startswith('$GPRMC') or sentence.startswith('$GNRMC'):
                return self._parse_rmc(sentence)
            elif sentence.startswith('$GPGSV') or sentence.startswith('$GNGSV'):
                return self._parse_gsv(sentence)
        
        except Exception as e:
            # Silently fail for malformed sentences
            pass
        
        return None
    
    def _validate_checksum(self, sentence: str) -> bool:
        """Validate NMEA sentence checksum"""
        if '*' not in sentence:
            return True  # No checksum
        
        try:
            data, checksum = sentence.split('*')
            calculated = 0
            
            for char in data[1:]:  # Skip $
                calculated ^= ord(char)
            
            return calculated == int(checksum, 16)
        
        except ValueError:
            return False
    
    def validate_checksum(self, sentence: str) -> bool:
        """Public method to validate NMEA sentence checksum"""
        return self._validate_checksum(sentence)
    
    def _parse_gga(self, sentence: str) -> Optional[Dict]:
        """
        Parse GGA sentence (Global Positioning System Fix Data)
        
        Format: $GPGGA,time,lat,N/S,lon,E/W,quality,satellites,HDOP,altitude,...
        """
        
        parts = sentence.split(',')
        if len(parts) < 10:
            return None
        
        try:
            # Extract fix quality (0=invalid, 1=GPS, 2=DGPS, etc.)
            fix_quality = int(parts[6])
            if fix_quality == 0:
                return None  # No fix
            
            # Parse latitude (format: DDMM.MMMM,N/S)
            lat_raw = parts[2]
            lat_hem = parts[3]
            latitude = self._parse_coordinate(lat_raw, lat_hem)
            
            # Parse longitude (format: DDDMM.MMMM,E/W)
            lon_raw = parts[4]
            lon_hem = parts[5]
            longitude = self._parse_coordinate(lon_raw, lon_hem)
            
            # Parse altitude and HDOP
            altitude = float(parts[9]) if parts[9] else 0
            hdop = float(parts[8]) if parts[8] else 0
            satellites = int(parts[7]) if parts[7] else 0
            
            gps_data = {
                'latitude': latitude,
                'longitude': longitude,
                'altitude_m': altitude,
                'accuracy': hdop * 2,  # Rough estimate: HDOP * 2 meters
                'satellites': satellites,
                'fix_quality': fix_quality,
                'source': 'GGA'
            }
            
            self.last_valid_fix = gps_data
            return gps_data
        
        except (ValueError, IndexError):
            return None
    
    def _parse_rmc(self, sentence: str) -> Optional[Dict]:
        """
        Parse RMC sentence (Recommended Minimum Navigation Information)
        
        Format: $GPRMC,time,status,lat,N/S,lon,E/W,speed,course,date,...
        """
        
        parts = sentence.split(',')
        if len(parts) < 10:
            return None
        
        try:
            # Check status (A=active, V=void)
            status = parts[2]
            if status != 'A':
                return None  # Invalid fix
            
            # Parse latitude
            lat_raw = parts[3]
            lat_hem = parts[4]
            latitude = self._parse_coordinate(lat_raw, lat_hem)
            
            # Parse longitude
            lon_raw = parts[5]
            lon_hem = parts[6]
            longitude = self._parse_coordinate(lon_raw, lon_hem)
            
            # Parse speed (in knots, convert to km/h)
            speed_knots = float(parts[7]) if parts[7] else 0
            speed_kmh = speed_knots * 1.852
            
            # Parse heading/course
            heading = float(parts[8]) if parts[8] else 0
            
            gps_data = {
                'latitude': latitude,
                'longitude': longitude,
                'speed': speed_kmh,
                'heading': heading,
                'source': 'RMC'
            }
            
            return gps_data
        
        except (ValueError, IndexError):
            return None
    
    def _parse_gsv(self, sentence: str) -> Optional[Dict]:
        """
        Parse GSV sentence (GPS Satellites in View)
        
        Format: $GPGSV,number_of_sentences,sentence_number,satellites_in_view,...
        (satellite data repeats)
        """
        
        parts = sentence.split(',')
        if len(parts) < 4:
            return None
        
        try:
            satellites_in_view = int(parts[3])
            
            return {
                'satellites_in_view': satellites_in_view,
                'source': 'GSV'
            }
        
        except ValueError:
            return None
    
    @staticmethod
    def _parse_coordinate(coord_str: str, hemisphere: str) -> float:
        """
        Parse latitude/longitude coordinate
        
        Format: DDMM.MMMM (latitude) or DDDMM.MMMM (longitude)
        """
        
        if not coord_str:
            return 0.0
        
        # Split into degrees and minutes based on decimal point
        # Latitude: DDMM.MMMM (2-digit degrees)
        # Longitude: DDDMM.MMMM (3-digit degrees)
        index_decimal = coord_str.find('.')
        if index_decimal == 5:  # DDDMM format (longitude: 5 chars before decimal)
            degrees = float(coord_str[:3])
            minutes = float(coord_str[3:])
        else:  # DDMM format (latitude: 4 chars before decimal)
            degrees = float(coord_str[:2])
            minutes = float(coord_str[2:])
        
        # Convert to decimal degrees
        decimal = degrees + (minutes / 60)
        
        # Apply hemisphere (South and West are negative)
        if hemisphere in ['S', 'W']:
            decimal = -decimal
        
        return round(decimal, 8)


def test_nmea_parser():
    """Test NMEA parser with sample sentences"""
    
    parser = NMEAParser()
    
    # Sample GGA sentence (with valid checksum)
    gga_sentence = "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*42"
    result = parser.parse(gga_sentence)
    print(f"GGA Parse Result: {result}")
    
    # Sample RMC sentence
    rmc_sentence = "$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6C"
    result = parser.parse(rmc_sentence)
    print(f"RMC Parse Result: {result}")
    
    # Invalid sentence (bad checksum)
    bad_sentence = "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*FF"
    result = parser.parse(bad_sentence)
    print(f"Invalid Parse Result: {result}")


if __name__ == '__main__':
    test_nmea_parser()
