#!/usr/bin/env node
/**
 * Test: Debug autopurge database state
 * Run this to see what's in the autopurge_settings table
 * Usage: node test-autopurge-db.js
 */

require('dotenv').config();
const db = require('./db');

async function debugAutopurge() {
  try {
    console.log('\n=== AUTOPURGE DEBUG ===\n');
    
    // Get all autopurge settings
    const result = await db.pool.query(
      `SELECT id, guild_id, channel_id, type, lines, interval_seconds, enabled, created_at, updated_at 
       FROM autopurge_settings 
       ORDER BY guild_id, channel_id`
    );
    
    console.log(`Total entries in autopurge_settings: ${result.rows.length}\n`);
    
    if (result.rows.length === 0) {
      console.log('✓ No entries found - table is clean');
    } else {
      result.rows.forEach((row, idx) => {
        console.log(`Entry ${idx + 1}:`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Guild ID: ${row.guild_id}`);
        console.log(`  Channel ID: ${row.channel_id}`);
        console.log(`  Type: ${row.type}`);
        console.log(`  Lines: ${row.lines}`);
        console.log(`  Interval: ${row.interval_seconds}s`);
        console.log(`  Enabled: ${row.enabled} ${!row.enabled ? '⚠️ DISABLED' : '✓'}`);
        console.log(`  Created: ${row.created_at}`);
        console.log(`  Updated: ${row.updated_at}`);
        console.log('');
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

debugAutopurge();
