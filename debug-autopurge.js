require('dotenv').config();
const db = require('./db');

async function debugAutopurge() {
  try {
    // Connect to database
    const result = await db.pool.query(
      `SELECT id, guild_id, channel_id, type, lines, interval_seconds, enabled, created_at, updated_at 
       FROM autopurge_settings 
       ORDER BY guild_id, channel_id`
    );
    
    console.log('=== AUTOPURGE_SETTINGS TABLE ===');
    console.log(`Total entries: ${result.rows.length}\n`);
    
    if (result.rows.length === 0) {
      console.log('No entries found in autopurge_settings');
    } else {
      result.rows.forEach((row, idx) => {
        console.log(`Entry ${idx + 1}:`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Guild ID: ${row.guild_id}`);
        console.log(`  Channel ID: ${row.channel_id}`);
        console.log(`  Type: ${row.type}`);
        console.log(`  Lines: ${row.lines}`);
        console.log(`  Interval (seconds): ${row.interval_seconds}`);
        console.log(`  Enabled: ${row.enabled}`);
        console.log(`  Created: ${row.created_at}`);
        console.log(`  Updated: ${row.updated_at}`);
        console.log('');
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

debugAutopurge();
