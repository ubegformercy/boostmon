#!/usr/bin/env node

/**
 * Update all NULL guild_id entries to 1464047532978995305
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateGuildId() {
  try {
    console.log('=== Update guild_id for all NULL entries ===\n');

    // Get count of NULL entries before
    const before = await pool.query(
      `SELECT COUNT(*) as cnt FROM role_timers WHERE guild_id IS NULL`
    );
    console.log(`Timers with NULL guild_id: ${before.rows[0].cnt}`);

    // Update all NULL entries
    const result = await pool.query(
      `UPDATE role_timers SET guild_id = $1 WHERE guild_id IS NULL`,
      ['1464047532978995305']
    );
    console.log(`✓ Updated: ${result.rowCount} timers\n`);

    // Verify
    const verify = await pool.query(
      `SELECT COUNT(*) as cnt FROM role_timers WHERE guild_id = $1`,
      ['1464047532978995305']
    );
    console.log(`Total timers for guild 1464047532978995305: ${verify.rows[0].cnt}`);

    // Check other guilds
    const other = await pool.query(
      `SELECT COUNT(*) as cnt FROM role_timers WHERE guild_id IS NULL`
    );
    console.log(`Remaining NULL guild_id entries: ${other.rows[0].cnt}`);

    console.log('\n✓ Update complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

updateGuildId();
