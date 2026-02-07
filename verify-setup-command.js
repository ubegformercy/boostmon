#!/usr/bin/env node
/**
 * Quick verification script to check if /setup command is registered globally
 */
require('dotenv').config();

const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env');
  process.exit(1);
}

async function verifyCommand() {
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    
    // Determine if using guild or global commands
    let commandRoute;
    let routeType;
    
    if (GUILD_ID) {
      commandRoute = Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID);
      routeType = `guild (${GUILD_ID})`;
    } else {
      commandRoute = Routes.applicationCommands(CLIENT_ID);
      routeType = 'global (all servers)';
    }
    
    console.log(`📋 Fetching commands from: ${routeType}\n`);
    
    const commands = await rest.get(commandRoute);
    
    if (!Array.isArray(commands)) {
      console.error('❌ Unexpected response from Discord API');
      return;
    }
    
    console.log(`✅ Found ${commands.length} registered command(s):\n`);
    
    // Display all commands
    commands.forEach((cmd, index) => {
      console.log(`${index + 1}. /${cmd.name}`);
      if (cmd.description) {
        console.log(`   └─ ${cmd.description}`);
      }
    });
    
    // Check specifically for /setup
    const setupCmd = commands.find(c => c.name === 'setup');
    
    console.log('\n' + '═'.repeat(50));
    if (setupCmd) {
      console.log('✅ SUCCESS: /setup command IS registered!');
      console.log(`\n📌 Setup Command Details:`);
      console.log(`   • Name: ${setupCmd.name}`);
      console.log(`   • ID: ${setupCmd.id}`);
      console.log(`   • Description: ${setupCmd.description}`);
      console.log(`   • Type: ${setupCmd.type || 'CHAT_INPUT (1)'}`);
      
      // Check for subcommands
      if (setupCmd.options && setupCmd.options.length > 0) {
        console.log(`   • Subcommands: ${setupCmd.options.map(o => o.name).join(', ')}`);
      }
      
      console.log('\n💡 Next Steps:');
      console.log('   1. Open Discord and type "/" in a chat');
      console.log('   2. If /setup doesn\'t appear, try:');
      console.log('      • Refreshing Discord (Ctrl+R or Cmd+R)');
      console.log('      • Restarting Discord completely');
      console.log('      • Waiting 15-60 minutes for global sync');
    } else {
      console.log('❌ ERROR: /setup command NOT found!');
      console.log('\n🔧 Troubleshooting:');
      console.log('   • The command may not have registered properly');
      console.log('   • Check bot logs for registration errors');
      console.log('   • Try restarting the bot');
    }
    
  } catch (error) {
    console.error('❌ Error checking commands:', error.message);
    if (error.status === 401) {
      console.error('   → Invalid TOKEN or CLIENT_ID');
    } else if (error.status === 404) {
      console.error('   → Application or guild not found');
    }
  }
}

verifyCommand();
