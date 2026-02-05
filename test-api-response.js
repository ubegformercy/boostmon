require('dotenv').config();
const db = require('./db.js');

(async () => {
  try {
    const members = await db.getGuildMembers('1464047532978995305');
    
    console.log('API Response Sample:');
    members.slice(0, 3).forEach((u, i) => {
      console.log(`${i+1}. id=${u.id}, name=${u.name}, displayName=${u.displayName}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
