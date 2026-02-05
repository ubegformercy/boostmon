require('dotenv').config();
const { Pool } = require('pg');

// Set a timeout for the entire operation
const timeout = setTimeout(() => {
  console.error('Database operation timed out after 15 seconds');
  process.exit(1);
}, 15000);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});

(async () => {
  try {
    console.log('\n=== Guild Members Cache Verification ===\n');
    
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'guild_members_cache'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Table guild_members_cache DOES NOT EXIST');
      await pool.end();
      process.exit(1);
    }
    
    console.log('✅ Table exists\n');
    
    // Get summary statistics
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total_members,
        COUNT(user_id) as with_id,
        COUNT(username) as with_username,
        COUNT(display_name) as with_display_name
      FROM guild_members_cache;
    `);
    
    const stats = summary.rows[0];
    const total = parseInt(stats.total_members);
    
    console.log(`Total members cached: ${total}`);
    console.log(`With Discord ID: ${stats.with_id}`);
    console.log(`With Username: ${stats.with_username}`);
    console.log(`With Display Name: ${stats.with_display_name}\n`);
    
    if (total === 0) {
      console.log('⚠️  Cache is EMPTY! Need to force sync.\n');
    } else {
      // Check for NULL values
      const nullCheck = await pool.query(`
        SELECT COUNT(*) as null_count
        FROM guild_members_cache 
        WHERE user_id IS NULL OR username IS NULL OR display_name IS NULL;
      `);
      
      const nullCount = parseInt(nullCheck.rows[0].null_count);
      if (nullCount > 0) {
        console.log(`⚠️  Found ${nullCount} records with NULL values in critical fields\n`);
        
        // Show details
        const details = await pool.query(`
          SELECT user_id, username, display_name 
          FROM guild_members_cache 
          WHERE user_id IS NULL OR username IS NULL OR display_name IS NULL
          LIMIT 5;
        `);
        
        console.log('Sample NULL records:');
        details.rows.forEach(r => {
          console.log(`  ID: ${r.user_id}, Username: ${r.username}, Display: ${r.display_name}`);
        });
      } else {
        console.log('✅ All members have Discord ID, Username, and Display Name (no NULLs)\n');
      }
      
      // Show sample records
      const samples = await pool.query(`
        SELECT user_id, username, display_name, guild_id 
        FROM guild_members_cache 
        LIMIT 3;
      `);
      
      console.log('Sample records:');
      samples.rows.forEach((r, i) => {
        console.log(`  ${i+1}. ID: ${r.user_id}, User: ${r.username}, Display: ${r.display_name}, Guild: ${r.guild_id}`);
      });
    }
    
    await pool.end();
    clearTimeout(timeout);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    clearTimeout(timeout);
    process.exit(1);
  }
})();
