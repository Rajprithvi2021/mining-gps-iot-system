# 🗺️ MAPBOX TOKEN SETUP - QUICK START

## What You Need

Mapbox API token for the interactive map to work.

Free tier: ✅ Sufficient for 500+ vehicles  
Cost: $0 (included in free tier)

---

## STEP 1: CREATE MAPBOX ACCOUNT

1. Go: https://account.mapbox.com
2. Sign up (free tier)
3. Verify email
4. Create account

---

## STEP 2: GET YOUR API TOKEN

1. Login: https://account.mapbox.com
2. Click "Tokens" (left sidebar)
3. Click "Create a token"
4. Settings:
   - **Name**: Skylark Mining GPS
   - **Scopes**: 
     - ✅ Maps: Mapbox GL JS
     - ✅ Vector Tiles API
   - **URL**: https://yourdomain.railway.app (or localhost)
5. Click "Create token"
6. **COPY** the token (pink highlight)

Token format: `pk.eyJ1IjoieYourusernameHere...`

---

## STEP 3: ADD TO LOCAL .env

### Create backend/.env

```bash
# In c:\Users\krash\OneDrive\Desktop\Skylark Drones\mining-gps-iot-system\backend

# Create .env file:
# (Copy from .env.example and update these lines)

MAPBOX_TOKEN=pk.eyJ1IjoieYourTokenHerexxxxxxx...

# Other variables:
DATABASE_URL=postgresql://skylark:password@localhost:5432/skylark_drones
REDIS_URL=redis://localhost:6379
MQTT_URL=mqtt://localhost:1883
JWT_SECRET=your_secret_key
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3001
```

### Create frontend/.env.local

```bash
# In c:\Users\krash\OneDrive\Desktop\Skylark Drones\mining-gps-iot-system\frontend

# Create .env.local file:

REACT_APP_MAPBOX_TOKEN=pk.eyJ1IjoieYourTokenHerexxxxxxx...
REACT_APP_API_URL=http://localhost:5000
```

---

## STEP 4: TEST LOCALLY

```bash
# Terminal 1: Start backend
cd c:\Users\krash\...\backend
npm install
npm start

# Terminal 2: Start frontend
cd c:\Users\krash\...\frontend
npm install
npm start

# Open browser: http://localhost:3001
# Go to MAP tab
# Should see Mapbox interactive map (not grey)
```

If map is grey or blank:
- Check browser console (F12)
- Verify token in .env.local
- Verify REACT_APP_MAPBOX_TOKEN is set

---

## STEP 5: VERIFY TOKEN WORKS

```powershell
# Test token validity
$token = "pk.eyJ1IsoGETYOURTOKENHERE..."
$response = curl "https://api.mapbox.com/tokens/v2/my-user-info" `
  -H "Authorization: Bearer $token"

# Should return: { "usage": "..." }
# If error: token might be invalid
```

---

## STEP 6: ADD TO RAILWAY (PRODUCTION)

Once deployed on Railway:

1. Go: Railway Dashboard
2. Click Backend project
3. Variables tab
4. Add:
   - **Key**: MAPBOX_TOKEN
   - **Value**: pk.eyJ1IsoYourTokenHere...

5. Click Frontend project
6. Variables tab
7. Add:
   - **Key**: REACT_APP_MAPBOX_TOKEN  
   - **Value**: pk.eyJ1IsoYourTokenHere...

8. Railway auto-redeploys
9. Wait 2-3 minutes
10. Visit frontend URL and verify map works

---

## CONFIGURABLE OPTIONS

In your code, token options available:

### MapContainer.jsx Usage

```javascript
// This is already in your code:
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/outdoors-v12', // Dark, light, etc.
  center: [48.8566, 2.3522],
  zoom: 3,
});
```

Available styles:
- `mapbox://styles/mapbox/streets-v12` - Well organized streets
- `mapbox://styles/mapbox/outdoors-v12` - Topography + features
- `mapbox://styles/mapbox/light-v11` - Light minimalist
- `mapbox://styles/mapbox/dark-v11` - Dark mode
- `mapbox://styles/mapbox/satellite-v9` - Satellite imagery

Change map style:
```javascript
// In your MapContainer.jsx:
style: 'mapbox://styles/mapbox/satellite-v9', // Change this
```

---

## QUOTA & LIMITS

Free tier includes:
- 50,000 map views/month
- Unlimited API calls (within fair use)
- Unlimited vector tiles
- Stable access

Your usage estimate:
- 500 vehicles
- 1 dashboard user
- Updates: 1 per second
- Monthly: ~30,000 requests

✅ Well within free tier

---

## SECURITY BEST PRACTICES

### Do's ✅
- Store token in .env files (NOT in code)
- Rotate token quarterly  
- Use different tokens for dev/prod
- Restrict token to specific domain

### Don'ts ❌
- Commit token to GitHub
- Share token in Slack/Email
- Use same token for multiple projects
- Expose in frontend code (too late, it's shown in browser)

---

## TROUBLESHOOTING

### Map not loading

**Error message**: "invalid access token"

**Fix**:
1. Verify token starts with `pk.`
2. Verify it's in correct .env file
3. Restart frontend server
4. Hard refresh browser (Ctrl+Shift+R)

### Map is creating but showing blank

**Error message**: No error, but grey/white map

**Fix**:
1. Check browser console for errors
2. Verify internet connection
3. Try different map style
4. Verify Mapbox account is active

### Token expired

**Error message**: "Token not found"

**Fix**:
1. Go: https://account.mapbox.com
2. Check if token still exists
3. If deleted, create new token
4. Update .env files
5. Redeploy on Railway

### Rate limiting

**Error message**: "Rate limit exceeded"

**Fix**:
1. Free tier allows sustained traffic
2. Current grid-based map is light usage
3. If adding 1000s of vehicles, upgrade to Premium

---

## VERIFY TOKEN WORKS END-TO-END

Quick checklist:

```
✅ Token created in Mapbox account
✅ Token starts with: pk.eyJ...
✅ Token added to backend/.env
✅ Token added to frontend/.env.local
✅ Backend running (npm start)
✅ Frontend running (npm start)
✅ http://localhost:3001 loads
✅ Map tab shows interactive map (not grey)
✅ Can click and drag map
✅ Can zoom in/out
✅ Vehicle markers appear on map
✅ Clicking vehicle shows popup
✅ Alerts display with icons
```

If all ✅: Your Mapbox is working!

---

## NEXT STEP

After Mapbox works:
→ Connect Raspberry Pi + GPS hardware (Task 4)

---

**Estimated Time**: 10 min setup + 5 min testing = 15 min total

**No coding changes needed!**
