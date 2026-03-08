#!/usr/bin/env python3
"""
Comprehensive audit of assignment requirements vs implementation
Based on: Mining Solutions Engineer @ Skylark Drones Assignment
"""

import os
import json
from pathlib import Path

class AssignmentAudit:
    def __init__(self, root_path):
        self.root = Path(root_path)
        self.results = {
            "hardware_setup": {},
            "edge_processing": {},
            "data_architecture": {},
            "mapbox_visualization": {},
            "hosting": {},
            "deliverables": {},
            "summary": {}
        }
    
    def check_file_exists(self, path):
        """Check if file exists"""
        full_path = self.root / path
        return full_path.exists()
    
    def check_content(self, file_path, keywords):
        """Check if file contains keywords"""
        try:
            full_path = self.root / file_path
            if not full_path.exists():
                return {k: False for k in keywords}
            
            with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read().lower()
            
            return {k: k.lower() in content for k in keywords}
        except:
            return {k: False for k in keywords}
    
    def audit_hardware_setup(self):
        """Verify Part A - Hardware Setup Requirements"""
        results = {}
        
        # 1. Raspberry Pi support
        results["raspberry_pi_support"] = self.check_content(
            "edge/config.py",
            ["raspberry", "gpio", "uart", "serial"]
        )
        
        # 2. At least 2 GPS modules
        results["dual_gps_modules"] = self.check_content(
            "edge/gps_processor.py",
            ["ttyusb", "ttysb0", "ttyama0", "dual", "second_gps"]
        )
        
        # 3. Independent identification
        results["gps_identification"] = self.check_content(
            "edge/gps_processor.py",
            ["device_id", "gps_id", "source", "module_name"]
        )
        
        # 4. Simultaneous multi-GPS interfacing
        results["multi_gps_threading"] = self.check_content(
            "edge/gps_processor.py",
            ["threading", "thread", "concurrent", "parallel"]
        )
        
        # 5. NMEA parsing
        results["nmea_parsing"] = self.check_file_exists("edge/nmea_parser.py")
        results["nmea_keywords"] = self.check_content(
            "edge/nmea_parser.py",
            ["gpgga", "gprmc", "checksum", "nmea"]
        )
        
        # 6. Data extraction: Latitude, Longitude, Speed, Timestamp
        results["data_extraction"] = self.check_content(
            "edge/nmea_parser.py",
            ["latitude", "longitude", "speed", "timestamp"]
        )
        
        self.results["hardware_setup"] = results
        return results
    
    def audit_edge_processing(self):
        """Verify Part B - Edge Processing Logic"""
        results = {}
        
        # 1. Route Deviation Detection
        results["route_deviation"] = self.check_file_exists("edge/detection_engine.py")
        results["route_deviation_keywords"] = self.check_content(
            "edge/detection_engine.py",
            ["route", "deviation", "distance", "threshold"]
        )
        
        # 2. High Fuel Consumption Detection
        results["fuel_consumption"] = self.check_content(
            "edge/detection_engine.py",
            ["fuel", "consumption", "speed_fluctuation", "acceleration", "anomaly"]
        )
        
        # 3. Idle Detection
        results["idle_detection"] = self.check_content(
            "edge/detection_engine.py",
            ["idle", "stationary", "engine", "speed == 0"]
        )
        
        # 4. Kalman Filter for smoothing
        results["kalman_filter"] = self.check_content(
            "edge/gps_processor.py",
            ["kalman", "filter", "accurate"]
        )
        
        self.results["edge_processing"] = results
        return results
    
    def audit_data_architecture(self):
        """Verify Part C - Data Architecture"""
        results = {}
        
        # 1. Edge (Raspberry Pi)
        results["edge_present"] = self.check_file_exists("edge/gps_processor.py")
        
        # 2. Backend server
        results["backend_server"] = self.check_file_exists("backend/src/index.js")
        results["backend_express"] = self.check_content(
            "backend/src/index.js",
            ["express", "app.listen", "http"]
        )
        
        # 3. Database
        results["postgres_database"] = self.check_file_exists("backend/scripts/000_init_schema.sql")
        results["database_tables"] = self.check_content(
            "backend/scripts/000_init_schema.sql",
            ["gps_data", "vehicles", "anomalies", "alerts"]
        )
        
        # 4. API or MQTT layer
        results["mqtt_integration"] = self.check_file_exists("edge/mqtt_client.py")
        results["rest_api"] = self.check_file_exists("backend/src/routes")
        results["websocket"] = self.check_file_exists("backend/src/websocket")
        
        # 5. Frontend visualization
        results["frontend_app"] = self.check_file_exists("frontend/src/App.jsx")
        
        self.results["data_architecture"] = results
        return results
    
    def audit_mapbox_visualization(self):
        """Verify Part D - Mapbox Visualization"""
        results = {}
        
        # 1. Real-time vehicle position
        results["vehicle_position"] = self.check_content(
            "frontend/src/App.jsx",
            ["marker", "vehicle", "latitude", "longitude"]
        )
        
        # 2. Vehicle paths
        results["vehicle_paths"] = self.check_content(
            "frontend/src/App.jsx",
            ["route", "path", "polyline", "linestring"]
        )
        
        # 3. Highlighted deviation alerts
        results["deviation_alerts"] = self.check_content(
            "frontend/src/App.jsx",
            ["alert", "deviation", "highlight", "alert_panel"]
        )
        
        # 4. Highlighted high-consumption zones
        results["consumption_zones"] = self.check_content(
            "frontend/src/App.jsx",
            ["consumption", "zone", "fuel", "highlight"]
        )
        
        # 5. Idle alerts
        results["idle_alerts"] = self.check_content(
            "frontend/src/App.jsx",
            ["idle", "alert", "notification"]
        )
        
        # 6. Bonus: Heatmaps
        results["heatmap_feature"] = self.check_content(
            "frontend/src/App.jsx",
            ["heatmap", "heat layer"]
        )
        
        # 7. Bonus: Replay feature
        results["replay_feature"] = self.check_content(
            "frontend/src/App.jsx",
            ["replay", "playback", "timeline", "time scrubber"]
        )
        
        # 8. Bonus: Filters
        results["filter_feature"] = self.check_content(
            "frontend/src/App.jsx",
            ["filter", "search", "select"]
        )
        
        self.results["mapbox_visualization"] = results
        return results
    
    def audit_hosting(self):
        """Verify Part E - Hosting Requirements"""
        results = {}
        
        # 1. Backend hosting configuration
        results["backend_dockerfile"] = self.check_file_exists("backend/Dockerfile")
        results["backend_docker_content"] = self.check_content(
            "backend/Dockerfile",
            ["node", "express", "cmd"]
        )
        
        # 2. Frontend hosting configuration
        results["frontend_dockerfile"] = self.check_file_exists("frontend/Dockerfile")
        results["frontend_docker_content"] = self.check_content(
            "frontend/Dockerfile",
            ["react", "build", "serve"]
        )
        
        # 3. Docker Compose orchestration
        results["docker_compose"] = self.check_file_exists("docker-compose.yml")
        results["docker_compose_content"] = self.check_content(
            "docker-compose.yml",
            ["backend", "frontend", "postgres", "redis"]
        )
        
        # 4. Environment configuration
        results["env_example"] = self.check_file_exists(".env.example")
        
        # 5. Railway/Render deployment support
        results["procfile"] = self.check_file_exists("backend/Procfile")
        results["railway_config"] = self.check_file_exists("railway.json") or self.check_file_exists("railway.toml")
        
        self.results["hosting"] = results
        return results
    
    def audit_deliverables(self):
        """Verify Deliverables"""
        results = {}
        
        # 1. GitHub repository
        results["github_readme"] = self.check_file_exists("README.md")
        results["github_gitignore"] = self.check_file_exists(".gitignore")
        
        # 2. Hardware wiring diagram
        results["hardware_diagram"] = self.check_file_exists("docs/HARDWARE.md")
        
        # 3. Architecture diagram
        results["architecture_diagram"] = (
            self.check_file_exists("docs/ARCHITECTURE.md") or 
            self.check_file_exists("ARCHITECTURE.md") or
            self.check_file_exists("docs/ALGORITHMS_AND_TECH_STACK.md")
        )
        
        # 4. Live deployed link (will need manual verification)
        results["deployment_guide"] = self.check_file_exists("docs/DEPLOYMENT.md")
        
        # 5. Hindi demo video (will need manual verification)
        results["video_recording_guide"] = self.check_file_exists("docs/VIDEO_SETUP.md") or \
                                           self.check_content("README.md", ["video", "demo", "hindi"])
        
        # 6. README with setup instructions
        results["setup_instructions"] = self.check_content(
            "README.md",
            ["setup", "installation", "quick start", "how to"]
        )
        
        # Additional deliverables
        results["quickstart_guide"] = self.check_file_exists("QUICKSTART.md")
        results["submission_checklist"] = self.check_file_exists("docs/SUBMISSION_CHECKLIST_AND_ACTION_PLAN.md")
        
        self.results["deliverables"] = results
        return results
    
    def audit_video_requirements(self):
        """Verify Video Submission Requirements"""
        results = {}
        
        results["mining_problem_explained"] = self.check_content(
            "README.md",
            ["mining", "problem", "fuel", "consumption", "route"]
        )
        
        results["hardware_explanation"] = self.check_file_exists("docs/HARDWARE.md")
        
        results["architecture_doc"] = self.check_file_exists("docs/ALGORITHMS_AND_TECH_STACK.md")
        
        results["deployment_guide"] = self.check_file_exists("docs/DEPLOYMENT.md")
        
        results["scalability_discussion"] = self.check_content(
            "docs/ALGORITHMS_AND_TECH_STACK.md",
            ["scalability", "500 vehicles", "cluster", "timescaledb"]
        )
        
        self.results["video_requirements"] = results
        return results
    
    def calculate_completeness(self):
        """Calculate overall completeness percentage"""
        all_checks = {}
        
        for category, checks in self.results.items():
            if category != "summary":
                all_checks.update(checks)
        
        if not all_checks:
            return 0
        
        # Count True values (boolean checks)
        true_count = sum(1 for v in all_checks.values() if isinstance(v, bool) and v)
        total_checks = sum(1 for v in all_checks.values() if isinstance(v, bool))
        
        if total_checks == 0:
            return 0
        
        return (true_count / total_checks) * 100
    
    def run_audit(self):
        """Run all audits"""
        print("\n" + "="*80)
        print("SKYLARK DRONES - MINING IOT ASSIGNMENT REQUIREMENTS AUDIT")
        print("="*80)
        
        self.audit_hardware_setup()
        self.audit_edge_processing()
        self.audit_data_architecture()
        self.audit_mapbox_visualization()
        self.audit_hosting()
        self.audit_deliverables()
        self.audit_video_requirements()
        
        # Calculate and display results
        self.display_results()
    
    def display_results(self):
        """Display audit results in a formatted way"""
        
        completeness = self.calculate_completeness()
        
        print("\n[HARDWARE SETUP] (Part A)")
        print("-" * 80)
        for check, result in self.results["hardware_setup"].items():
            status = "[OK]" if result else "[FAIL]"
            print(f"{status} {check.replace('_', ' ').title()}: {result}")
        
        print("\n[EDGE PROCESSING LOGIC] (Part B)")
        print("-" * 80)
        for check, result in self.results["edge_processing"].items():
            status = "[OK]" if result else "[FAIL]"
            print(f"{status} {check.replace('_', ' ').title()}: {result}")
        
        print("\n[DATA ARCHITECTURE] (Part C)")
        print("-" * 80)
        for check, result in self.results["data_architecture"].items():
            status = "[OK]" if result else "[FAIL]"
            print(f"{status} {check.replace('_', ' ').title()}: {result}")
        
        print("\n[MAPBOX VISUALIZATION] (Part D)")
        print("-" * 80)
        for check, result in self.results["mapbox_visualization"].items():
            status = "[OK]" if result else "[FAIL]"
            print(f"{status} {check.replace('_', ' ').title()}: {result}")
        
        print("\n[HOSTING] (Part E)")
        print("-" * 80)
        for check, result in self.results["hosting"].items():
            status = "[OK]" if result else "[FAIL]"
            print(f"{status} {check.replace('_', ' ').title()}: {result}")
        
        print("\n[DELIVERABLES]")
        print("-" * 80)
        for check, result in self.results["deliverables"].items():
            status = "[OK]" if result else "[FAIL]"
            print(f"{status} {check.replace('_', ' ').title()}: {result}")
        
        print("\n[VIDEO REQUIREMENTS] (Hindi Submission)")
        print("-" * 80)
        for check, result in self.results["video_requirements"].items():
            status = "[OK]" if result else "[FAIL]"
            print(f"{status} {check.replace('_', ' ').title()}: {result}")
        
        print("\n" + "="*80)
        print(f"OVERALL COMPLETION: {completeness:.1f}%")
        print("="*80)
        
        # Identify gaps
        gaps = [k for k, v in self._flatten_results().items() if not v]
        if gaps:
            print("\n[WARNING] POTENTIAL GAPS TO ADDRESS:")
            for gap in gaps:
                print(f"   - {gap}")
        else:
            print("\n[SUCCESS] ALL REQUIREMENTS VERIFIED!")
        
        print("\n" + "="*80)
    
    def _flatten_results(self):
        """Flatten results for gap identification"""
        flattened = {}
        for category, checks in self.results.items():
            if category != "summary":
                flattened.update(checks)
        return flattened


if __name__ == "__main__":
    root_path = os.path.dirname(os.path.abspath(__file__))
    audit = AssignmentAudit(root_path)
    audit.run_audit()
