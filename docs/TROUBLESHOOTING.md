# Troubleshooting Guide

## Common Issues & Solutions

### Edge Device (Raspberry Pi)

#### GPS Not Detecting Satellites

**Symptoms**:
- `gps_processor.py` runs but no GPS fix
- Satellite count stuck at 0
- Location shows 0.0, 0.0

**Diagnosis**:
```bash
# Check if GPS module is transmitting
cat /dev/ttyUSB0 | head -20

# Check if systemd service is running
sudo systemctl status skylark-gps.service

# Check logs
sudo journalctl -u skylark-gps.service -n 50
```

**Solutions**:
1. **Move antenna outside** - GPS needs clear sky view
   - Cold start can take 5-10 minutes
   - Assisted GPS (A-GPS) speeds this up

2. **Check antenna connector** - Ensure antenna is firmly seated
   - Try different antenna (active vs passive)
   - Check for antenna damage

3. **Verify power supply** - Weak power causes detection failure
   ```bash
   # Check voltage at GPIO
   vcgencmd measure_volts
   # Should show close to 5V
   ```

4. **Update GPS module firmware** - Use u-center software on Windows
   - Download from u-blox website
   - USB adapter → u-center → Tools → Firmware Update

5. **Test with known location** - Verify from specific coordinates
   - Indoor test usually fails, move outside
   - Open area better than urban canyon

---

#### MQTT Connection Failures

**Symptoms**:
- Error: `Connection refused on 1.2.3.4:8883`
- Logs show `MQTT_CONNECT_UNAUTHORIZED`
- Data not syncing to cloud

**Diagnosis**:
```bash
# Test MQTT connectivity
mosquitto_sub -h localhost -p 8883 -t "/#" --cafile /etc/mosquitto/ca.crt

# Check certificates
ls -la /home/pi/skylark/certs/
# Should have: ca.crt, client.crt, client.key
```

**Solutions**:
1. **Verify Mosquitto broker is running**
   ```bash
   sudo systemctl status mosquitto
   sudo systemctl restart mosquitto
   ```

2. **Check certificate paths** - Ensure relative paths work
   ```python
   # In mqtt_client.py, verify absolute paths:
   ca_certs = "/home/pi/skylark/certs/ca.crt"
   certfile = "/home/pi/skylark/certs/client.crt"
   keyfile = "/home/pi/skylark/certs/client.key"
   ```

3. **Verify TLS certificates** - Check expiration dates
   ```bash
   openssl x509 -in /etc/mosquitto/ca.crt -noout -dates
   ```

4. **Test with plaintext MQTT** (debugging only)
   ```python
   # Temporarily disable TLS in mqtt_client.py:
   # client.tls_set() → commented out
   # Port = 1883 (not 8883)
   ```

5. **Check firewall** - Port 8883 may be blocked
   ```bash
   sudo ufw allow 8883/tcp
   sudo ufw status
   ```

---

#### SQLite Database Locked

**Symptoms**:
- Error: `sqlite3.OperationalError: database is locked`
- GPS data not writing to local buffer
- Multiple instances running simultaneously

**Diagnosis**:
```bash
# Find processes accessing GPS processor
ps aux | grep gps_processor

# Check if multiple instances are running
pgrep -fa gps_processor.py
```

**Solutions**:
1. **Kill all instances**
   ```bash
   pkill -f gps_processor.py
   sleep 2
   sudo systemctl start skylark-gps.service
   ```

2. **Check SQLite integrity**
   ```bash
   sqlite3 /home/pi/skylark/gps_buffer.db "PRAGMA integrity_check;"
   ```

3. **Repair corrupted database**
   ```bash
   cp /home/pi/skylark/gps_buffer.db /home/pi/skylark/gps_buffer.db.bak
   sqlite3 /home/pi/skylark/gps_buffer.db ".recover" | sqlite3 /home/pi/skylark/gps_buffer_recovered.db
   ```

4. **Enable WAL mode** - Prevents locking issues
   ```bash
   sqlite3 /home/pi/skylark/gps_buffer.db "PRAGMA journal_mode=WAL;"
   ```

---

#### High Power Consumption

**Symptoms**:
- Raspberry Pi getting too hot (> 80°C)
- Frequent crashes or unexpected reboots
- Short battery life (< 4 hours)

**Diagnosis**:
```bash
# Check CPU temperature
vcgencmd measure_temp

# Monitor power draw
watch -n 1 'grep Amps /proc/cmdline'

# Check running processes
top -b -n 1 | head -20
```

**Solutions**:
1. **Disable unnecessary services**
   ```bash
   sudo systemctl disable rgb-led.service
   sudo systemctl disable bluetooth.service
   sudo systemctl disable ssh.service
   ```

2. **Reduce GPS polling frequency** - In config.py:
   ```python
   GPS_POLL_INTERVAL = 2.0  # Increase from 1.0 seconds
   ```

3. **Enable CPU frequency scaling**
   ```bash
   echo "powersave" | sudo tee /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
   ```

4. **Use proper power supply** - 3A @ 5V minimum
   - Cheap USB cables have too much voltage drop
   - Use short, thick gauge wire

---

### Backend Service

#### Database Connection Failures

**Symptoms**:
- Error: `Error: connect ECONNREFUSED 127.0.0.1:5432`
- Backend starts but no data persistence
- All API requests return 500

**Diagnosis**:
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -U skylark_user -d skylark_iot -h localhost
```

**Solutions**:
1. **Start PostgreSQL service**
   ```bash
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

2. **Check database credentials** - In `.env`:
   ```bash
   DB_USER=skylark_user
   DB_PASSWORD=YourSecurePassword123
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=skylark_iot
   ```

3. **Reset user password**
   ```bash
   sudo -i -u postgres psql
   ALTER USER skylark_user WITH PASSWORD 'NewPassword123';
   \q
   ```

4. **Recreate database** - If corrupted
   ```bash
   sudo -i -u postgres
   dropdb skylark_iot
   createdb skylark_iot
   psql skylark_iot < /app/backend/scripts/000_init_schema.sql
   ```

---

#### Redis Connection Issues

**Symptoms**:
- Warning: `Cannot connect to Redis on port 6379`
- Cache not working (reads much slower)
- Vehicle data updates very slow

**Diagnosis**:
```bash
# Check Redis status
redis-cli ping
# Should return: PONG

# Check memory usage
redis-cli info memory
```

**Solutions**:
1. **Start Redis service**
   ```bash
   sudo systemctl start redis-server
   sudo systemctl enable redis-server
   ```

2. **Test connection in Node**
   ```bash
   node -e "const redis = require('redis'); const client = redis.createClient(); client.ping(console.log);"
   ```

3. **Clear cache if corrupted**
   ```bash
   redis-cli FLUSHALL
   ```

---

#### WebSocket Connection Drops

**Symptoms**:
- Frontend disconnects after 30 seconds
- Real-time updates stop mid-session
- Browser console shows socket errors

**Diagnosis**:
```bash
# Check server logs
tail -f /var/log/skylark/backend.log | grep -i socket

# Verify port is open
netstat -tulpn | grep 3001
```

**Solutions**:
1. **Add reconnection logic** - In backend/src/websocket/handler.js:
   ```javascript
   socket.on('disconnect', () => {
       console.log('Client disconnected:', socket.id);
       // Auto-cleanup
       clearInterval(updateIntervals.get(socket.id));
       updateIntervals.delete(socket.id);
   });
   ```

2. **Increase timeout values** - In index.js:
   ```javascript
   const io = require('socket.io')(server, {
       transports: ['websocket', 'polling'],
       pingInterval: 25000,
       pingTimeout: 60000
   });
   ```

3. **Check firewall** - Port 3001 may be blocked
   ```bash
   sudo ufw allow 3001/tcp
   ```

---

### Frontend Application

#### Map Not Loading

**Symptoms**:
- Blank gray rectangle where map should be
- Console shows `Mapbox GL error: Invalid accessToken`
- Markers don't appear

**Diagnosis**:
```bash
# Check browser console (F12)
# Look for CORS errors, invalid token

# Verify token in .env.local:
cat .env.local | grep REACT_APP_MAPBOX
```

**Solutions**:
1. **Get valid Mapbox token** - From https://account.mapbox.com/
   - Create new access token
   - Ensure token has map:read scope

2. **Set environment variable** - In .env.local:
   ```
   REACT_APP_MAPBOX_TOKEN=pk_..."
   ```

3. **Clear browser cache** - Hard refresh (Ctrl+Shift+Delete)
   - Remove local storage
   - Clear application data

4. **Verify CORS** - Backend must allow Mapbox requests
   ```javascript
   // In backend middleware:
   app.use(cors({
       origin: ['http://localhost:3000', 'https://yourdomain.com']
   }));
   ```

---

#### API Requests Failing

**Symptoms**:
- Network errors in browser console
- Features unable to load vehicle list
- "Failed to fetch data" messages

**Diagnosis**:
```bash
# Test API endpoint directly
curl -X GET http://localhost:3001/api/vehicles
# Should return JSON array

# Check backend logs
docker logs skylark-backend
```

**Solutions**:
1. **Verify backend is running**
   ```bash
   docker ps | grep skylark-backend
   # or
   npm start  # In backend directory
   ```

2. **Check API URL** - In frontend/src/services/api.js:
   ```javascript
   const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
   ```

3. **Enable CORS** - If frontend on different port
   ```javascript
   const cors = require('cors');
   app.use(cors());
   ```

4. **Validate response format** - Some endpoints return different structures
   ```bash
   curl -X GET http://localhost:3001/api/vehicles | jq .
   ```

---

#### Real-time Updates Not Working

**Symptoms**:
- Map doesn't update vehicle positions
- Alerts don't appear in real-time
- Must refresh page to see new data

**Diagnosis**:
```bash
# Check WebSocket connection in browser console:
# Look for "Connection established" or similar

# Verify server is broadcasting:
# Check backend logs for "Broadcasting update" messages
```

**Solutions**:
1. **Verify WebSocket server is running** - On port 3001
   ```bash
   netstat -tulpn | grep 3001
   ```

2. **Check listener registration** - In frontend/src/services/websocket.js:
   ```javascript
   socket.on('vehicle_update', handleVehicleUpdate);
   socket.on('alert_new', handleNewAlert);
   ```

3. **Check server broadcasting** - In backend/src/websocket/handler.js:
   ```javascript
   io.emit('vehicle_update', vehicleData);
   ```

---

## Performance Troubleshooting

### System is Slow

**Check resource usage**:
```bash
# CPU usage
top

# Memory usage
free -h

# Disk usage
du -sh /var/lib/postgresql/*
```

**Optimization**:
1. Increase PostgreSQL connection pool size
2. Enable query caching in Redis
3. Add database indexes
4. Compress old time-series data in TimescaleDB

---

### High Latency (> 1 second)

**Check network**:
```bash
# Ping backend from edge device
ping backend-ip

# Check network bandwidth
iftop
```

**Optimize**:
1. Use gzip compression in Express
2. Reduce JSON payload sizes
3. Enable HTTP/2
4. Use CDN for static assets

---

## Support & Resources

**Logs to check**:
- Edge: `/var/log/skylark/edge.log`
- Backend: `/var/log/skylark/backend.log`
- Frontend: Browser DevTools Console
- Docker: `docker logs <container-name>`

**Useful commands**:
```bash
# Full system health check
cd mining-gps-iot-system
python3 verify_system.py

# Run diagnostics
python3 DETAILED_AUDIT.py

# Test connectivity
docker-compose exec backend curl http://localhost:3001/health
```

**Contact Support**:
- GitHub Issues: [Project Repository]
- Email: support@skylarktechdrones.com
- Documentation: See QUICKSTART.md for 5-minute setup

---

## Known Limitations

| Issue | Workaround | Status |
|-------|-----------|--------|
| GPS accuracy in dense forests | Use assisted GPS mode | Open |
| MQTT connection drops when pi sleeps | Disable sleep mode | Open |
| React map lag with 1000+ vehicles | Implement clustering | Planned |
| PostgreSQL slow queries after 6 months | Run VACUUM ANALYZE | Maintenance |

---

Last Updated: March 7, 2024
