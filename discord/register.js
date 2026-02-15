// discord/register.js — Slash command registration with Discord REST API
const { REST, Routes } = require("discord.js");
const { getCommands } = require("./commands");

async function registerCommands({ TOKEN, CLIENT_ID, GUILD_ID }) {
  if (!CLIENT_ID) {
    console.log("Missing DISCORD_CLIENT_ID; skipping command registration.");
    return;
  }

  const commands = getCommands().map((c) => c.toJSON());
  console.log("Registering command names:", commands.map((c) => c.name).join(", "));

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    // Use global commands for multi-server support, or guild commands if GUILD_ID is set
    const commandRoute = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    const routeType = GUILD_ID ? `guild (${GUILD_ID})` : "global (all servers)";
    console.log(`🔄 Cleaning up old commands...`);

    // First, fetch all existing commands and delete any duplicates or old versions
    try {
      const existingCommands = await rest.get(commandRoute);

      if (existingCommands && Array.isArray(existingCommands)) {
        console.log(`Found ${existingCommands.length} existing commands`);

        const desiredCommandNames = new Set(commands.map(c => c.name));
        const commandMap = new Map();
        const toDelete = [];

        existingCommands.forEach(cmd => {
          if (desiredCommandNames.has(cmd.name)) {
            if (commandMap.has(cmd.name)) {
              toDelete.push({ id: cmd.id, name: cmd.name });
            } else {
              commandMap.set(cmd.name, cmd.id);
            }
          } else {
            toDelete.push({ id: cmd.id, name: cmd.name });
          }
        });

        if (toDelete.length > 0) {
          console.log(`🗑️  Deleting ${toDelete.length} duplicate/old commands...`);
          for (const cmd of toDelete) {
            try {
              await rest.delete(`${commandRoute}/${cmd.id}`);
              console.log(`   ✓ Deleted /${cmd.name} (ID: ${cmd.id})`);
            } catch (err) {
              console.warn(`   ✗ Failed to delete /${cmd.name}: ${err.message}`);
            }
          }
        } else {
          console.log(`✓ No duplicates found`);
        }
      }
    } catch (err) {
      console.warn(`Could not clean up old commands: ${err.message}`);
    }

    console.log(`🔄 Registering ${commands.length} commands as: ${routeType}`);

    if (!GUILD_ID) {
      console.log("ℹ️  Global commands registered. This may take 15-60 minutes to sync across Discord.");
    }

    const result = await rest.put(commandRoute, { body: commands });

    console.log("✅ Slash commands registered. Discord now has:", result.map((c) => c.name).join(", "));
  } catch (err) {
    console.error("❌ Failed to register slash commands:", err);
  }
}

module.exports = { registerCommands };
