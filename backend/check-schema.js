const pool = require('./src/utils/database');

async function checkSchema() {
  try {
    // Check alerts columns
    const alertCols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='alerts' ORDER BY ordinal_position
    `);
    console.log('Alerts columns:', alertCols.rows.map(r => r.column_name).join(', '));
    
    // Check dashboard_metrics columns
    const dashCols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='dashboard_metrics' ORDER BY ordinal_position
    `);
    console.log('Dashboard columns:', dashCols.rows.map(r => r.column_name).join(', '));
    
    // Check vehicles table
    const vehicleCols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='vehicles' ORDER BY ordinal_position
    `);
    console.log('Vehicles columns:', vehicleCols.rows.map(r => r.column_name).join(', '));
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

checkSchema();
