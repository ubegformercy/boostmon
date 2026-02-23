// check-timer-roles.js — Debug script to inspect timer_allowed_roles table
require("dotenv").config();
const db = require("./db");

async function checkTimerRoles() {
  try {
    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL not set");
      process.exit(1);
    }

    await db.initDatabase();

    // Get all timer roles from database
    const result = await db.pool.query(`
      SELECT guild_id, role_id, role_name, created_at 
      FROM timer_allowed_roles 
      ORDER BY guild_id, created_at
    `);

    console.log("\n==========================================");
    console.log("TIMER ALLOWED ROLES TABLE");
    console.log("==========================================");
    
    if (result.rows.length === 0) {
      console.log("❌ No roles configured in the database");
    } else {
      console.log(`Found ${result.rows.length} role(s):\n`);
      
      const groupedByGuild = {};
      result.rows.forEach(row => {
        if (!groupedByGuild[row.guild_id]) {
          groupedByGuild[row.guild_id] = [];
        }
        groupedByGuild[row.guild_id].push(row);
      });

      Object.entries(groupedByGuild).forEach(([guildId, roles]) => {
        console.log(`Guild ID: ${guildId}`);
        roles.forEach(role => {
          console.log(`  • ${role.role_name} (${role.role_id})`);
        });
        console.log("");
      });
    }

    console.log("==========================================\n");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

checkTimerRoles();
