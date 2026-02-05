require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

async function checkCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    
    const commandRoute = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);
    
    const routeType = GUILD_ID ? `guild (${GUILD_ID})` : "global";
    
    console.log(`\n=== CHECKING SLASH COMMANDS (${routeType}) ===\n`);
    
    const commands = await rest.get(commandRoute);
    
    console.log(`Total commands: ${commands.length}\n`);
    
    // Group by name to find duplicates
    const nameMap = {};
    commands.forEach(cmd => {
      if (!nameMap[cmd.name]) {
        nameMap[cmd.name] = [];
      }
      nameMap[cmd.name].push(cmd.id);
    });
    
    // Show command summary
    Object.keys(nameMap).sort().forEach(name => {
      const ids = nameMap[name];
      if (ids.length > 1) {
        console.log(`⚠️  DUPLICATE: /${name} (${ids.length} versions)`);
        ids.forEach((id, idx) => {
          console.log(`   ${idx + 1}. ID: ${id}`);
        });
      } else {
        console.log(`✅ /${name}`);
      }
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkCommands();
