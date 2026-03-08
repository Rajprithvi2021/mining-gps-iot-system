# 🚀 GITHUB SETUP - COPY & PASTE COMMANDS

## Prerequisites
- Windows terminal (PowerShell) open
- Git installed (https://git-scm.com/download/win)

## Step 1: Initialize Git in Your Project

```powershell
# Navigate to project root
cd "c:\Users\krash\OneDrive\Desktop\Skylark Drones\mining-gps-iot-system"

# Initialize git if not already done
git init

# Check git status
git status
```

## Step 2: Create .gitignore (if doesn't exist)

```powershell
# Create .gitignore file
@"
# Dependencies
node_modules/
__pycache__/
*.pyc
*.pyo
venv/
env/

# Environment variables
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
nohup.out

# Build outputs
dist/
build/
.next/
out/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Optional
.cache/
temp/
tmp/
"@ | Out-File -FilePath .gitignore -Encoding UTF8
```

## Step 3: Add All Code to Git

```powershell
# Add all files
git add .

# Check what will be committed
git status

# First commit
git config user.name "Your Name Here"
git config user.email "your.email@example.com"

git commit -m "Initial commit: Complete Mining GPS IoT System

- Edge detection code (Raspberry Pi)
- Backend API (Node.js + Express)
- Frontend dashboard (React + Mapbox)
- PostgreSQL database schema
- Docker compose configuration
- Full documentation"

# Verify commit
git log --oneline
```

## Step 4: Create GitHub Repository

1. Go to: https://github.com/new
2. Fill in:
   - **Repository name**: skylark-drones
   - **Description**: GPS-based IoT mining fleet management system with real-time route deviation detection
   - **Visibility**: PUBLIC (must be public for job submission)
   - **Add README**: No (you already have one)
   - **Add .gitignore**: No (you already have one)
   
3. Click "Create repository"

## Step 5: Connect Local Git to GitHub

```powershell
# Get this from GitHub page after creation
# Example (REPLACE with your actual username):

git remote add origin https://github.com/YOUR_USERNAME/skylark-drones.git

# Verify remote added
git remote -v

# Push to GitHub
git branch -M main
git push -u origin main

# Verify it's live
# Go to: https://github.com/YOUR_USERNAME/skylark-drones
```

## Result
Your code is now public on GitHub! 
Anyone can see it at: https://github.com/YOUR_USERNAME/skylark-drones

---

# 📋 WHAT TO COMMIT

```
Repository Structure After Commit:

skylark-drones/
├── edge/                          ✅ Python scripts
│   ├── gps_processor.py
│   ├── nmea_parser.py
│   ├── detection_engine.py
│   ├── mqtt_client.py
│   ├── requirements.txt
│   └── test_edge_device.py
│
├── backend/                       ✅ Node.js API
│   ├── src/
│   ├── scripts/
│   ├── package.json
│   ├── .env.example
│   └── railway.json
│
├── frontend/                      ✅ React Dashboard
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── .env.example
│   └── railway.json
│
├── docs/                          ✅ Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── HARDWARE.md
│
├── docker-compose.yml             ✅ Local dev
├── README.md                      ✅ Main docs
├── ASSIGNMENT_AUDIT.md            ✅ Your checklist
├── CURRENT_STATUS_DETAILED.md     ✅ Status update
├── STEP_BY_STEP_COMPLETION_GUIDE.md ✅ This guide
└── .gitignore                     ✅ Don't commit secrets
```

---

# ✅ VERIFICATION

After push, verify:

1. Check GitHub page refreshed: https://github.com/YOUR_USERNAME/skylark-drones
2. Files visible in browser
3. README.md displays properly
4. .env files NOT visible (secrets safe)

---

# 🆘 TROUBLESHOOTING

**Error: "fatal: not a git repository"**
```powershell
cd "c:\Users\krash\OneDrive\Desktop\Skylark Drones\mining-gps-iot-system"
git init
git add .
git commit -m "Initial commit"
```

**Error: "Permission denied (publickey)"**
```powershell
# Generate SSH key
ssh-keygen -t rsa -b 4096

# Add to GitHub:
# Settings → SSH and GPG keys → New SSH key
# Paste key from: $PROFILE (for PowerShell)
```

**Error: "Branch main does not exist"**
```powershell
git branch -M main
git push -u origin main
```

---

# Next Step
Once code is on GitHub:
→ TASK 2: Deploy to Railway
