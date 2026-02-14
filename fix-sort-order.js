// Fix script to reset all report_sort_order to 'descending' as default
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixSortOrder() {
  try {
    console.log('🔄 Fixing report_sort_order to default descending...');
    
    const result = await pool.query(
      `UPDATE rolestatus_schedules 
       SET report_sort_order = 'descending' 
       WHERE report_sort_order IS NULL OR report_sort_order != 'descending'
       RETURNING id, guild_id, report_sort_order;`
    );
    
    console.log(`✅ Updated ${result.rows.length} schedule records to 'descending'`);
    result.rows.slice(0, 10).forEach(row => {
      console.log(`  - Guild ${row.guild_id}: ${row.report_sort_order}`);
    });
    
    if (result.rows.length > 10) {
      console.log(`  ... and ${result.rows.length - 10} more`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error fixing sort order:', err);
    process.exit(1);
  }
}

fixSortOrder();
