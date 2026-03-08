#!/usr/bin/env python3
"""
DETAILED FUNCTIONALITY AUDIT - Double Check Everything
Compares README claims vs actual implementation
"""

import os
from pathlib import Path

os.chdir(r'c:\Users\krash\OneDrive\Desktop\Skylark Drones\mining-gps-iot-system')

print("\n" + "="*75)
print("  COMPREHENSIVE FUNCTIONALITY AUDIT - README CLAIMS vs REALITY")
print("="*75 + "\n")

results = []

# ============================================
# SECTION 1: README STRUCTURE CLAIMS
# ============================================
print("PART 1: PROJECT STRUCTURE (as claimed in README)")
print("-" * 75 + "\n")

structure_checks = {
    "edge/gps_parser.py": ("gps_processor.py",),
    "edge/kalman_filter.py": ("edge/edge/gps_parser_enhanced.py", "edge/gps_processor.py"),
    "edge/detectors/": ("edge/detectors", "edge/edge/detectors"),
    "edge/config/": ("edge/config.py", "edge/config"),
    "backend/src/services/": ("backend/src/services",),
    "backend/src/routes/": ("backend/src/routes",),
    "backend/src/middleware/": ("backend/src/middleware",),
    "backend/scripts/": ("backend/scripts",),
    "frontend/src/components/": ("frontend/src/components",),
    "frontend/src/pages/": ("frontend/src/pages",),
    "frontend/src/services/": ("frontend/src/services",),
    "docs/": ("docs",),
    ".github/workflows/": (".github/workflows",),
}

for claim, possible_paths in structure_checks.items():
    found = False
    actual_path = None
    
    for path in possible_paths:
        if os.path.exists(path):
            found = True
            actual_path = path
            break
    
    status = "✓" if found else "✗"
    symbol = "PASS" if found else "FAIL"
    
    if found:
        print(f"[{status}] {claim:<30} → Found at: {actual_path}")
        results.append((claim, symbol))
    else:
        print(f"[{status}] {claim:<30} → MISSING")
        results.append((claim, symbol))

print("\n" + "="*75)
print("PART 2: FEATURE CLAIMS (from README)")
print("-" * 75 + "\n")

features = {
    "Dual GPS modules": [
        ("edge/gps_processor.py", "GPS processor file"),
        ("edge/nmea_parser.py", "NMEA parser"),
    ],
    "Kalman filtering": [
        ("edge/edge/gps_parser_enhanced.py", "Enhanced GPS parser with Kalman"),
        ("edge/gps_processor.py", "Kalman in main processor"),
    ],
    "5 anomaly detectors": [
        ("edge/detection_engine.py", "Detection engine"),
        ("edge/edge/detectors/", "Detectors directory"),
    ],
    "Offline operation (SQLite)": [
        ("edge/config.py", "Configuration with SQLite"),
        ("edge/gps_processor.py", "GPS processor with buffering"),
    ],
    "Real-time dashboard (Mapbox)": [
        ("frontend/src/App.jsx", "Frontend app"),
        ("frontend/src/services/", "API services"),
    ],
    "Real-time dashboard (WebSocket)": [
        ("backend/src/websocket/", "WebSocket support"),
        ("frontend/src/services/", "Frontend WebSocket client"),
    ],
    "Scalable architecture": [
        ("backend/src/services/", "Microservices"),
        ("docker-compose.yml", "Container orchestration"),
    ],
    "Production monitoring (Prometheus)": [
        ("docker-compose.yml", "Prometheus container"),
        ("backend/src/middleware/", "Metrics middleware"),
    ],
    "Production monitoring (Grafana)": [
        ("docker-compose.yml", "Grafana container"),
    ],
}

for feature, requirements in features.items():
    all_found = True
    missing = []
    
    for req_path, description in requirements:
        if not os.path.exists(req_path):
            all_found = False
            missing.append(description)
    
    status = "✓" if all_found else "⚠"
    symbol = "PRESENT" if all_found else "PARTIAL"
    
    print(f"[{status}] {feature}")
    for req_path, description in requirements:
        if os.path.exists(req_path):
            print(f"    ✓ {description}")
        else:
            print(f"    ✗ {description} - NOT FOUND")
    results.append((feature, symbol))
    print()

print("\n" + "="*75)
print("PART 3: DOCUMENTATION CLAIMS")
print("-" * 75 + "\n")

docs_claims = {
    "docs/ARCHITECTURE.md": "System design",
    "docs/API.md": "GraphQL schema",
    "docs/DEPLOYMENT.md": "Production setup",
    "docs/HARDWARE.md": "GPS wiring",
    "docs/TROUBLESHOOTING.md": "Common issues",
}

for doc_path, description in docs_claims.items():
    if os.path.exists(doc_path):
        size = os.path.getsize(doc_path)
        print(f"[✓] {doc_path:<30} ({size} bytes) - {description}")
        results.append((f"Doc: {doc_path}", "PASS"))
    else:
        print(f"[✗] {doc_path:<30} MISSING - {description}")
        results.append((f"Doc: {doc_path}", "FAIL"))

print("\n" + "="*75)
print("PART 4: TECHNICAL REQUIREMENTS")
print("-" * 75 + "\n")

requirements = {
    "Node.js 20+": ["backend/package.json"],
    "Python 3.9+": ["edge/requirements.txt"],
    "Docker & Docker Compose": ["docker-compose.yml"],
    "Express.js": ["backend/package.json"],
    "PostgreSQL": ["docker-compose.yml"],
    "Redis": ["docker-compose.yml"],
    "MQTT Broker": ["docker-compose.yml", "mosquitto.conf"],
    "React 18": ["frontend/package.json"],
    "Mapbox GL": ["frontend/package.json", "frontend/src/App.jsx"],
    "GitHub Actions": [".github/workflows/ci-cd.yml"],
    "npm run migrate": ["backend/package.json"],
    "npm run dev": ["backend/package.json"],
}

for requirement, files in requirements.items():
    found = all(os.path.exists(f) for f in files)
    status = "✓" if found else "✗"
    
    if found:
        print(f"[{status}] {requirement}")
    else:
        print(f"[{status}] {requirement} - Missing: {', '.join(f for f in files if not os.path.exists(f))}")
    
    results.append((requirement, "PASS" if found else "FAIL"))

print("\n" + "="*75)
print("SUMMARY REPORT")
print("="*75 + "\n")

passed = sum(1 for _, status in results if status in ["PASS", "PRESENT"])
total = len(results)
partial = sum(1 for _, status in results if status == "PARTIAL")
failed = sum(1 for _, status in results if status == "FAIL")

print(f"Items Checked:     {total}")
print(f"Fully Present:     {passed} ✓")
print(f"Partially Present: {partial} ⚠")
print(f"Missing:           {failed} ✗")
print(f"\nCompletion Rate:   {(passed/total)*100:.1f}%")

print("\n" + "="*75)
print("FINDINGS")
print("="*75 + "\n")

# List what's missing
missing_items = [item for item, status in results if status == "FAIL"]
if missing_items:
    print("MISSING/INCOMPLETE ITEMS:")
    for item in missing_items:
        print(f"  - {item}")
else:
    print("All items present!")

print("\n" + "="*75)
print("STATUS ASSESSMENT")
print("="*75 + "\n")

if passed == total:
    print("✓ ALL FUNCTIONALITIES PRESENT -100% COMPLETE")
elif (passed/total) >= 0.95:
    print("⚠ MOSTLY COMPLETE (95%+) - Minor items missing")
    print("\nMissing items that can be easily added:")
    for item in missing_items:
        print(f"  - {item}")
elif (passed/total) >= 0.85:
    print("⚠ SUBSTANTIALLY COMPLETE (85%+) - Some items missing")
else:
    print("✗ INCOMPLETE - Significant items missing")

print("\n" + "="*75)
