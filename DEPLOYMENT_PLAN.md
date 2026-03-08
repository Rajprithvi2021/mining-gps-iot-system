# Free Online Deployment Plan - Mining GPS IoT System

## Architecture (All Free Services)

```
GitHub Repository
    ↓
    ├─→ Frontend (React) → Vercel (FREE)
    │   URL: https://mining-gps-frontend.vercel.app
    │
    ├─→ Backend (Node.js + PostgreSQL) → Railway (FREE)
    │   URL: https://mining-gps-backend.up.railway.app
    │
    └─→ Database → Neon PostgreSQL (FREE)
        URL: postgresql://user:pass@ep-xxx.us-east-1.neon.tech/
```

---

## STEP 1: Prepare for Deployment (5 minutes)

### 1.1 Update Environment Files

**Frontend (.env):**
```bash
cd frontend
```

Create/Update `.env`:
```
REACT_APP_API_BASE_URL=https://mining-gps-backend.up.railway.app
REACT_APP_MAPBOX_TOKEN=pk.your_mapbox_token_here
```

**Backend (.env):**
```bash
cd ../backend
```

Create/Update `.env`:
```
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/mining_fleet
JWT_SECRET=your_secret_key_123
MQTT_BROKER=localhost
NODE_ENV=production
PORT=5000
```

### 1.2 Commit Everything to GitHub
```bash
cd ..
git add .
git commit -m "Deploy: Prepare for online deployment"
git push origin main
```

---

## STEP 2: Deploy Backend (Node.js + PostgreSQL)

### 2.1 Sign Up on Railway (2 minutes)

1. Go to **https://railway.app**
2. Click "Start Project"
3. Choose "GitHub" → Authorize
4. Select your repository: `mining-gps-iot-system`
5. Click "Deploy"

Railway will:
- Auto-detect Node.js
- Build and deploy backend
- Create PostgreSQL database automatically

### 2.2 Configure Railway (5 minutes)

1. In Railway Dashboard, go to **Variables** tab
2. Add these variables:
   ```
   DATABASE_URL = (Copy from Neon - see Step 3)
   JWT_SECRET = your_secret_key_123
   NODE_ENV = production
   PORT = 5000
   ```

3. Go to **Settings** → Copy your Railway URL:
   ```
   https://mining-gps-backend.up.railway.app
   ```

4. Click **Deploy** button

**Backend is now LIVE!** ✅

Test it:
```
https://mining-gps-backend.up.railway.app/api/v1/vehicles
```

---

## STEP 3: Setup Database (5 minutes)

### 3.1 Sign Up on Neon (Postgres)

1. Go to **https://neon.tech**
2. Click "Sign up" → "Sign up with GitHub"
3. Create new project
4. Copy your `DATABASE_URL`:
   ```
   postgresql://neon_user:password@ep-xxx-xxx.us-east-1.neon.tech/mining_fleet?sslmode=require
   ```

### 3.2 Add to Railway

1. Go back to Railway
2. Go to **Variables**
3. Paste the `DATABASE_URL` from Neon
4. Click "Deploy"

**Database is ready!** ✅

---

## STEP 4: Deploy Frontend (React)

### 4.1 Sign Up on Vercel (1 minute)

1. Go to **https://vercel.com**
2. Click "Sign Up" → "Continue with GitHub"
3. Import your repository: `mining-gps-iot-system`

### 4.2 Configure Vercel (3 minutes)

1. In Vercel dashboard:
   - Framework: **Next.js** (or leave blank)
   - Root Directory: **frontend**
   - Build Command: `npm run build`
   - Start Command: `npm start`

2. Add Environment Variables:
   ```
   REACT_APP_API_BASE_URL = https://mining-gps-backend.up.railway.app
   REACT_APP_MAPBOX_TOKEN = pk.your_mapbox_token_here
   ```

3. Click **Deploy**

Vercel will build and deploy automatically.

**Frontend is LIVE!** ✅

Your app is now at:
```
https://your-project.vercel.app
```

---

## STEP 5: Connect Everything (5 minutes)

### 5.1 Update Frontend Environment

1. In Vercel, go to **Settings** → **Environment Variables**
2. Update:
   ```
   REACT_APP_API_BASE_URL = https://mining-gps-backend.up.railway.app
   ```
3. Re-deploy: Click **Deployments** → **Redeploy**

### 5.2 Test the Connection

Visit your frontend:
```
https://your-project.vercel.app
```

You should see:
- ✅ Map loading
- ✅ Vehicle markers appearing
- ✅ Real-time updates flowing
- ✅ Dashboard KPIs updating

---

## STEP 6: Debug if Needed

### If Frontend Not Connecting to Backend

1. **Check CORS** - Add to backend (railway):
   ```javascript
   app.use(cors({
     origin: "https://your-project.vercel.app",
     credentials: true
   }));
   ```
   Then push to GitHub and Railway auto-redeploys

2. **Check API URL** - In Vercel logs:
   ```bash
   Vercel → Deployments → Recent Deployment → Logs
   ```

3. **Test Backend Directly**:
   ```
   https://mining-gps-backend.up.railway.app/api/v1/vehicles
   ```

---

## QUICK REFERENCE - URLs After Deployment

| Component | URL | Status |
|-----------|-----|--------|
| Frontend | `https://your-app.vercel.app` | 🟢 Active |
| Backend API | `https://mining-gps-backend.up.railway.app` | 🟢 Active |
| Database | Neon PostgreSQL | 🟢 Active |
| Map Feature | Works Live | 🟢 Active |
| Vehicle Tracking | Real-time | 🟢 Active |

---

## Cost Summary

| Service | Free Tier | Cost |
|---------|-----------|------|
| Vercel (Frontend) | Unlimited | $0 |
| Railway (Backend) | $5 credit/month | $0 |
| Neon (PostgreSQL) | 3GB database | $0 |
| **TOTAL** | Everything needed | **$0/month** ✅ |

---

## Troubleshooting

### Frontend shows blank page
- Check browser console (F12)
- Ensure `REACT_APP_API_BASE_URL` is correct
- Vercel → Redeploy

### API returns 500 error
- Check Railway logs: Dashboard → Logs tab
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is initialized

### Map not loading
- Check Mapbox token in `.env`
- Verify token is valid and not revoked
- Redeploy frontend

### Vehicles not appearing
- Check network tab in browser (F12)
- Verify `/api/v1/vehicles` returns data
- Check database has records

---

## Next Steps (Optional)

1. **Custom Domain** - Add your own domain (vercel.com/docs)
2. **MQTT Broker** - Use HiveMQ Cloud (free tier)
3. **Monitoring** - Railway built-in metrics
4. **CI/CD** - GitHub Actions (auto-deploy on push)

---

## Final Checklist

- [ ] GitHub repository pushed
- [ ] Railway project created and configured
- [ ] Neon PostgreSQL setup and `DATABASE_URL` copied
- [ ] Environment variables added to both services
- [ ] Vercel frontend deployed
- [ ] Frontend accessing backend successfully
- [ ] Map showing vehicle markers
- [ ] Vehicle clicks showing details
- [ ] KPIs updating in real-time

**Once all checked, your system is LIVE globally!** 🚀

---

## Support URLs

- **Railway Help**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **Neon PostgreSQL**: https://neon.tech/docs
- **Your GitHub Repo**: https://github.com/Rajprithvi2021/mining-gps-iot-system
