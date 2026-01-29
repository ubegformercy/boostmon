const express = require("express");
const path = require("path");
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const indexRouter = require("./routes/index");

console.log("=== BoostMon app.js booted ===");
console.log("DISCORD_TOKEN present:", Boolean(process.env.DISCORD_TOKEN));
console.log("DISCORD_CLIENT_ID present:", Boolean(process.env.DISCORD_CLIENT_ID));
console.log("DISCORD_GUILD_ID present:", Boolean(process.env.DISCORD_GUILD_ID));

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

// ---------------- Storage ----------------
// Data format:
// {
//   "<userId>": {
//     "roles": {
//       "<roleId>": { "expiresAt": 1234567890 }
//     }
//   }
// }
const DATA_PATH = path.resolve(__dirname, "data.json");

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeData(obj) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2), "utf8");
}

// remaining time tracked as "expiresAt" (ms epoch)
function addMinutesForRole(userId, roleId, minutes) {
  const data = readData();
  const now = Date.now();

  if (!data[userId]) data[userId] = { roles: {} };
  if (!data[userId].roles) data[userId].roles = {};

  const current = data[userId].roles[roleId]?.expiresAt ?? 0;
  const base = current > now ? current : now;
  const expiresAt = base + minutes * 60 * 1000;

  data[userId].roles[roleId] = { expiresAt };
  writeData(data);

  return expiresAt;
}

function getTimeLeftMsForRole(userId, roleId) {
  const data = readData();
  const expiresAt = data[userId]?.roles?.[roleId]?.expiresAt ?? 0;
  return Math.max(0, expiresAt - Date.now());
}

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

function friendlyDiscordError(err) {
  const rawMsg = err?.rawError?.message || err?.message || "Unknown error";
  const code = err?.code ? ` (code ${err.code})` : "";
  const status = err?.status ? ` (HTTP ${err.status})` : "";
  return `${rawMsg}${code}${status}`;
}

// ---------------- Discord Bot ----------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("clientReady", async () => {
  console.log(`BoostMon logged in as ${client.user.tag}`);

  if (!CLIENT_ID || !GUILD_ID) {
    console.log("Missing DISCORD_CLIENT_ID or DISCORD_GUILD_ID; skipping command registration.");
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName("addtime")
      .setDescription("Add minutes to a user's timed role and assign the role.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption((o) =>
        o.setName("user").setDescription("User to add time to").setRequired(true)
      )
      .addIntegerOption((o) =>
        o
          .setName("minutes")
          .setDescription("Minutes to add")
          .setRequired(true)
          .setMinValue(1)
      )
      .addRoleOption((o) =>
        o.setName("role").setDescription("Role to grant").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("timeleft")
      .setDescription("Show remaining timed role time for a user (and optional role).")
      .addUserOption((o) =>
        o.setName("user").setDescription("User to check (default: you)").setRequired(false)
      )
      .addRoleOption((o) =>
        o.setName("role").setDescription("Role to check (optional)").setRequired(false)
      ),
  ].map((c) => c.toJSON());

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("Slash commands registered.");
  } catch (err) {
    console.error("Failed to register slash commands:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "addtime") {
      if (!interaction.guild) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      }

      const targetUser = interaction.options.getUser("user", true);
      const minutes = interaction.options.getInteger("minutes", true);
      const targetRole = interaction.options.getRole("role", true);

      const guild = interaction.guild;

      // Fetch bot member
      const me = await guild.members.fetchMe();

      // Permission check
      if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({
          content: "I don't have the **Manage Roles** permission in this server.",
          ephemeral: true,
        });
      }

      // Ensure role exists in this guild (it will, but keep it safe)
      const role = guild.roles.cache.get(targetRole.id);
      if (!role) {
        return interaction.reply({
          content: "I couldn't find that role in this server.",
          ephemeral: true,
        });
      }

      // Hierarchy check
      if (me.roles.highest.position <= role.position) {
        return interaction.reply({
          content:
            `I can't assign **${role.name}** because my highest role is not above it.\n` +
            `Move my bot role higher than **${role.name}** in the server role list.`,
          ephemeral: true,
        });
      }

      const member = await guild.members.fetch(targetUser.id);

      // Save expiry per user+role
      const expiresAt = addMinutesForRole(targetUser.id, role.id, minutes);

      // Assign role
      await member.roles.add(role.id);

      return interaction.reply({
        content:
          `Added **${minutes} minutes** to ${targetUser} for **${role.name}** and assigned the role.\n` +
          `New expiry: <t:${Math.floor(expiresAt / 1000)}:F> (in <t:${Math.floor(expiresAt / 1000)}:R>).`,
        ephemeral: false,
      });
    }

    if (interaction.commandName === "timeleft") {
      const targetUser = interaction.options.getUser("user") ?? interaction.user;
      const role = interaction.options.getRole("role"); // optional

      // If a role is provided, show time for that role only
      if (role) {
        const left = getTimeLeftMsForRole(targetUser.id, role.id);
        if (left <= 0) {
          return interaction.reply({ content: `${targetUser} has **0 time left** for **${role.name}**.`, ephemeral: true });
        }
        return interaction.reply({
          content: `${targetUser} has **${formatMs(left)}** remaining for **${role.name}** (expires <t:${Math.floor((Date.now() + left) / 1000)}:R>).`,
          ephemeral: true,
        });
      }

      // No role provided: just a helpful message for now
      return interaction.reply({
        content:
          `Please include a role to check.\nExample: \`/timeleft user: ${targetUser.username} role: @server1\``,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error("Command error:", err);

    const msg =
      "Error running command.\n" +
      "Details: " +
      friendlyDiscordError(err);

    try {
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ content: msg, ephemeral: true });
      }
      return interaction.reply({ content: msg, ephemeral: true });
    } catch (e) {
      console.error("Failed to send error to Discord:", e);
    }
  }
});

client.on("error", (err) => console.error("Discord client error:", err));
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));

client.login(TOKEN).catch((err) => console.error("Login failed:", err));

// ---------------- Express Web Server ----------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  console.info(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.static(path.resolve(__dirname, "public")));
app.use("/", indexRouter);

app.use((req, res) => {
  res.status(404).sendFile(path.resolve(__dirname, "views", "404.html"));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Internal Server Error");
});

app.listen(PORT, () => {
  console.log(`Server listening: http://localhost:${PORT}`);
});
