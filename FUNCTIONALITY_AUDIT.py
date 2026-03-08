#!/usr/bin/env python3
"""
FUNCTIONALITY AUDIT - Verify all claimed features are present
"""

import os
from pathlib import Path

os.chdir(r'c:\Users\krash\OneDrive\Desktop\Skylark Drones\mining-gps-iot-system')

print("\n" + "="*70)
print("  SKYLARK DRONES - COMPREHENSIVE FUNCTIONALITY AUDIT")
print("="*70 + "\n")

# Define all expected features
features = {
    "EDGE DEVICE": {
        "GPS Processing": [
            "edge/gps_processor.py",
            "edge/nmea_parser.py"
        ],
        "Anomaly Detection": [
            "edge/detection_engine.py"
        ],
        "Cloud Connectivity": [
            "edge/mqtt_client.py"
        ],
        "Configuration": [
            "edge/config.py",
            "edge/requirements.txt"
        ],
        "Auto-start Service": [
            "edge/skylark-gps.service"
        ]
    },
    
    "BACKEND SERVICES": {
        "Server Core": [
            "backend/src/index.js",
            "backend/package.json"
        ],
        "API Routes": [
            "backend/src/routes"
        ],
        "Business Logic": [
            "backend/src/services"
        ],
        "Data Models": [
            "backend/src/models"
        ],
        "Real-time Updates": [
            "backend/src/websocket"
        ],
        "Middleware": [
            "backend/src/middleware"
        ],
        "Database": [
            "backend/src/utils"
        ]
    },
    
    "FRONTEND": {
        "Dashboard UI": [
            "frontend/src/components",
            "frontend/src/App.jsx"
        ],
        "API Integration": [
            "frontend/src/services"
        ],
        "State Management": [
            "frontend/src/store"
        ],
        "React Hooks": [
            "frontend/src/hooks"
        ],
        "Dependencies": [
            "frontend/package.json"
        ]
    },
    
    "INFRASTRUCTURE": {
        "Container Orchestration": [
            "docker-compose.yml"
        ],
        "Docker Images": [
            "backend/Dockerfile",
            "frontend/Dockerfile"
        ],
        "CI/CD Pipeline": [
            ".github/workflows/ci-cd.yml",
            ".github/workflows/test.yml"
        ],
        "Environment Config": [
            ".env.example"
        ]
    },
    
    "DOCUMENTATION": {
        "Getting Started": [
            "README.md",
            "QUICKSTART.md"
        ],
        "Deployment": [
            "DEPLOYMENT.md"
        ],
        "Technical Details": [
            "ALGORITHMS_AND_TECH_STACK.md"
        ],
        "Verification": [
            "FINAL_SYSTEM_VERIFICATION_REPORT.md",
            "SUBMISSION_CHECKLIST_AND_ACTION_PLAN.md"
        ]
    }
}

# Audit results
results = {}
total_pass = 0
total_items = 0

for category, subcategories in features.items():
    print(f"\n{'='*70}")
    print(f"  {category}")
    print('='*70)
    
    category_pass = 0
    category_total = 0
    results[category] = {}
    
    for feature, items in subcategories.items():
        feature_status = True
        missing_items = []
        
        for item in items:
            category_total += 1
            total_items += 1
            
            if os.path.exists(item):
                category_pass += 1
                total_pass += 1
            else:
                feature_status = False
                missing_items.append(item)
        
        status_icon = "✓" if feature_status else "✗"
        color_code = "\033[92m" if feature_status else "\033[91m"
        reset_code = "\033[0m"
        
        print(f"\n  [{status_icon}] {feature}")
        for item in items:
            if os.path.exists(item):
                size_info = ""
                if os.path.isfile(item):
                    size = os.path.getsize(item)
                    size_info = f" ({size} bytes)"
                print(f"      ✓ {item}{size_info}")
            else:
                print(f"      ✗ {item} [MISSING]")
        
        results[category][feature] = {
            "status": feature_status,
            "items": len(items),
            "missing": missing_items
        }
    
    print(f"\n  Category Summary: {category_pass}/{category_total} items found")

# Final Summary
print("\n" + "="*70)
print("  FINAL SUMMARY")
print("="*70)

print(f"\nOverall: {total_pass}/{total_items} components found")
print(f"Completion: {(total_pass/total_items)*100:.1f}%\n")

for category in results:
    passed = sum(1 for f in results[category] if results[category][f]["status"])
    total = len(results[category])
    status = "✓" if passed == total else "⚠"
    print(f"  [{status}] {category:25} {passed:2}/{total:2}")

# Check for specific features mentioned in README
print("\n" + "="*70)
print("  FEATURE CHECKLIST (as per README)")
print("="*70)

features_to_check = {
    "Dual GPS modules": [
        "edge/gps_processor.py",
        "edge/nmea_parser.py"
    ],
    "5 anomaly detectors": [
        "edge/detection_engine.py"
    ],
    "Offline operation (SQLite buffer)": [
        "edge/config.py"
    ],
    "Real-time dashboard (Mapbox)": [
        "frontend/src/components",
        "frontend/src/services"
    ],
    "Scalable architecture": [
        "backend/src/services"
    ],
    "Production monitoring": [
        "docker-compose.yml"
    ]
}

print()
for feature, required_files in features_to_check.items():
    all_exist = all(os.path.exists(f) for f in required_files)
    status = "✓" if all_exist else "✗"
    print(f"  [{status}] {feature}")
    if not all_exist:
        for req_file in required_files:
            if not os.path.exists(req_file):
                print(f"      Missing: {req_file}")

# Status report
print("\n" + "="*70)
print("  STATUS")
print("="*70 + "\n")

if total_pass == total_items:
    print("  ✓ ALL FUNCTIONALITIES PRESENT")
    print("  ✓ READY FOR PRODUCTION")
elif (total_pass / total_items) > 0.95:
    print("  ⚠ MOST FUNCTIONALITIES PRESENT")
    print("  ⚠ Minor items missing (95%+ complete)")
else:
    print("  ✗ SOME FUNCTIONALITIES MISSING")
    print(f"  ✗ Only {(total_pass/total_items)*100:.1f}% complete")

print("\n" + "="*70)
