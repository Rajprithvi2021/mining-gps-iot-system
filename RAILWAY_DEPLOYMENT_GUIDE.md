# 🚂 RAILWAY DEPLOYMENT - EXACT SETUP GUIDE

## Prerequisites
- GitHub account with public repo
- Railway account (free: https://railway.app)
- GitHub code pushed to main branch

---

## PART 1: CREATE RAILWAY ACCOUNT & PROJECTS

### Step 1: Sign Up

1. Go: https://railway.app
2. Click "Start Free"
3. Sign up with: Email or GitHub account (GitHub recommended)
4. Verify email

### Step 2: Create Backend Project

Dashboard → New Project → From GitHub

1. Select repository: `skylark-drones`
2. Install Railway GitHub app if prompted
3. Select: `backend` directory to deploy
4. Click "Deploy"

**Wait**: 3-5 minutes for initial build

Check status:
- Green checkmark = deployed ✅
- Red X = error (check logs)

### Step 3: Create Frontend Project  

Same steps:
1. New Project → From GitHub
2. Repository: `skylark-drones`
3. Directory: `frontend`
4. Deploy

---

## PART 2: ADD ENVIRONMENT VARIABLES

### For Backend Service

On Railway Dashboard:
1. Click backend project
2. Click "Variables" tab
3. Add these variables:

```
DATABASE_URL             [COPY from PostgreSQL service]
REDIS_URL               [COPY from Redis service]
MQTT_BROKER_URL         mqtt://mosquitto:1883
JWT_SECRET              generate-random-string-here
MAPBOX_TOKEN            pk.eyJ1...your_token...
NODE_ENV                production
PORT                    8080
CORS_ORIGIN             https://your-frontend-url.railway.app
```

### For Frontend Service

1. Click frontend project
2. Click "Variables" tab
3. Add these variables:

```
REACT_APP_API_URL       https://your-backend-url.railway.app
REACT_APP_MAPBOX_TOKEN  pk.eyJ1...your_token...
CI                      true
```

---

## PART 3: ADD DATABASE & SERVICES

### PostgreSQL Database

1. New Service → Add from Marketplace
2. Search: "PostgreSQL"
3. Click "Add"
4. Wait for deploy (2-3 min)

After deployment:
1. Click PostgreSQL service
2. Copy entire DATABASE_URL
3. Paste into Backend variables (see Part 2)

### Redis Cache

1. New Service → Add from Marketplace
2. Search: "Redis"
3. Click "Add"
4. Wait for deploy

After deployment:
1. Click Redis service
2. Copy REDIS_URL
3. Paste into Backend variables

### Initialize Database

1. Click Backend service
2. Click "Deployments"
3. Click latest (active) deployment
4. Click "View Logs"
5. Should see database initialized

If not initialized:
```bash
# You'll need to run migration manually
# In next step
```

---

## PART 4: GET LIVE URLS

After services deployed:

### Backend URL

Railway Dashboard:
1. Click Backend project
2. Click "Settings"
3. Look for "Railway Domain" or "Public URL"
4. Copy: `https://your-backend-project-xxxx.railway.app`

### Frontend URL

Railway Dashboard:
1. Click Frontend project
2. Click "Settings"
3. Look for "Railway Domain" or "Public URL"
4. Copy: `https://your-frontend-project-xxxx.railway.app`

---

## PART 5: VERIFY DEPLOYMENT

### Test Backend

```powershell
# In PowerShell:
$backend_url = "https://your-backend-xxxx.railway.app"

# Check health
curl "$backend_url/api/v1/health"

# Expected output:
# {"status":"ok"}
```

If error:
- Check Railway logs for errors
- Verify all environment variables set
- Verify database is initialized

### Test Frontend

```powershell
# Open in browser:
https://your-frontend-xxxx.railway.app

# Expected:
# ✅ Page loads
# ✅ Map displays
# ✅ Can see vehicles (if backend connected)
# ✅ Can click menu items
```

If error:
- Check browser console (F12)
- Check Railway logs
- Verify REACT_APP_API_URL points to backend

---

## PART 6: UPDATE DOCUMENTATION

### Update README.md

Replace this section in your README:

```markdown
## 🚀 Live Deployment

**Status**: ✅ Production Ready

### Live URLs
- **Backend API**: https://your-backend-xxxx.railway.app
- **Frontend Dashboard**: https://your-frontend-xxxx.railway.app
- **Documentation**: See [docs/](docs/) folder

### Health Check

```bash
# Backend is operational
curl https://your-backend-xxxx.railway.app/api/v1/health

# Frontend is operational  
curl https://your-frontend-xxxx.railway.app
```

### First Time Access

1. Open: https://your-frontend-xxxx.railway.app
2. Wait for map to load (first load is slower)
3. Click on vehicles to see details
4. Go to different tabs to explore features

### Architecture

This system is deployed on Railway.app:
- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React 18 + Mapbox GL
- **Database**: PostgreSQL 16 (managed)
- **Cache**: Redis 7 (managed)
- **Uptime**: 99.99% SLA
```

---

## PART 7: AUTO-DEPLOY ON CODE PUSH

Railway automatically redeploys when you push to GitHub:

```powershell
# In VS Code terminal:

# Make a change to code
# For example, update README.md

# Commit and push
git add .
git commit -m "Update deployment URLs in README"
git push origin main

# Railway automatically:
# 1. Detects new push
# 2. Rebuilds code
# 3. Deploys new version
# 4. No downtime!

# Check status on Railway Dashboard
# Should show "Building..." then "Active" with new timestamp
```

---

## TROUBLESHOOTING

### Backend not starting

**Error**: "ModuleNotFoundError: No module named 'express'"

**Solution**:
```
1. Check backend/package.json exists
2. Check npm install ran (should see package-lock.json)
3. Check Railway logs for error details
4. In Railway: Redeploy (click Redeploy button)
```

### Frontend build fails

**Error**: "Cannot find module 'react'"

**Solution**:
```
1. Check frontend/package.json exists
2. Check CI=true environment variable
3. In Railway: Redeploy services
4. Check build logs for specific error
```

### Database not initializing

**Error**: "connect ECONNREFUSED"

**Solution**:
```
1. Verify DATABASE_URL is correct
2. Verify PostgreSQL service is running (green checkmark)
3. Manually run: backend/scripts/init-db.js
   (through Railway SSH or local connection)
4. Add database initialization to backend startup
```

### Mapbox not showing

**Error**: Map is blank or grey

**Solution**:
```
1. Verify REACT_APP_MAPBOX_TOKEN is set
2. Verify token starts with: pk.eyJ...
3. In browser console (F12):
   - Check for Mapbox errors
   - Verify API key is valid
4. Get new token if needed:
   https://account.mapbox.com/auth/signin/
```

---

## COST CONSIDERATIONS

Railway Free Tier:
- ✅ 5GB storage
- ✅ 100 hours/month runtime  
- ✅ 1-2 services worth
- ✅ Enough for demo/assignment

After submission, can upgrade to:
- Hobby: $5/month
- Pro: $20/month
- Dedicated: As needed

---

## NEXT STEPS

1. ✅ Complete: Deploy backend + frontend
2. ✅ Complete: Add databases
3. ✅ Complete: Get live URLs
4. 🔄 TODO: Test data flow from edge device
5. 🔄 TODO: Verify Mapbox displays vehicles

**After deployment works →  Start Task 4 (Hardware Connection)**

---

## HELPFUL LINKS

- Railway Docs: https://docs.railway.app
- PostgreSQL Integration: https://docs.railway.app/databases/postgresql
- Environment Variables: https://docs.railway.app/develop/variables
- Troubleshooting: https://docs.railway.app/help/troubleshooting

---

**Estimated Time**: 30 min setup + 15 min debug = 45 min total

**But you can start right now! No code changes needed.**
