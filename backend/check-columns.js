require('dotenv').config();
const pool = require('./src/utils/database');

async function checkColumns() {
  try {
    const alerts = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'alerts' ORDER BY ordinal_position");
    console.log('Alerts columns:', alerts.rows.map(r => r.column_name).join(', '));
    
    const dashboard = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'dashboard_metrics' ORDER BY ordinal_position");
    console.log('Dashboard columns:', dashboard.rows.map(r => r.column_name).join(', '));
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

checkColumns();
