#!/usr/bin/env node

/**
 * backfill-guild-id.js - Backfill guild_id for existing timers
 * 
 * This script looks at all timers with NULL guild_id and attempts to find
 * the guild by looking at the Discord bot's cache of guilds and their members.
 * 
 * Usage: node backfill-guild-id.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function backfillGuildId() {
  console.log('=== Backfill guild_id for Existing Timers ===\n');

  try {
    // Step 1: Get the bot client from the running app
    // For this we'll need to import the app context
    const client = require('./app').client;
    
    if (!client) {
      console.error('❌ ERROR: Could not get Discord client');
      console.error('Please ensure the app is running with: npm start');
      process.exit(1);
    }

    console.log('✓ Connected to Discord bot');

    // Step 2: Get all timers with NULL guild_id
    const result = await pool.query(
      `SELECT id, user_id, role_id, expires_at FROM role_timers WHERE guild_id IS NULL ORDER BY expires_at DESC`
    );
    
    const nullGuildTimers = result.rows;
    console.log(`✓ Found ${nullGuildTimers.length} timers with NULL guild_id\n`);

    if (nullGuildTimers.length === 0) {
      console.log('✓ All timers have guild_id set!');
      process.exit(0);
    }

    // Step 3: For each timer, find which guild has that user with that role
    let updated = 0;
    let failed = 0;

    for (const timer of nullGuildTimers) {
      try {
        let foundGuildId = null;

        // Check all guilds the bot is in
        for (const guild of client.guilds.cache.values()) {
          try {
            const member = await guild.members.fetch(timer.user_id).catch(() => null);
            
            if (member && member.roles.cache.has(timer.role_id)) {
              foundGuildId = guild.id;
              break;
            }
          } catch (e) {
            // Continue to next guild
          }
        }

        if (foundGuildId) {
          await pool.query(
            `UPDATE role_timers SET guild_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [foundGuildId, timer.id]
          );
          updated++;
          console.log(`✓ Timer ${timer.id} (user: ${timer.user_id}, role: ${timer.role_id}) → guild ${foundGuildId}`);
        } else {
          failed++;
          console.log(`✗ Timer ${timer.id} (user: ${timer.user_id}, role: ${timer.role_id}) → could not find guild`);
        }
      } catch (err) {
        failed++;
        console.error(`✗ Timer ${timer.id}: ${err.message}`);
      }
    }

    console.log(`\n=== Backfill Complete ===`);
    console.log(`Updated: ${updated}`);
    console.log(`Failed:  ${failed}`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR:', err);
    process.exit(1);
  }
}

backfillGuildId();
