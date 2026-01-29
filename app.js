// app.js

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

// ---------------- Boot logs ----------------
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

function ensureUserRoleBucket(data, userId) {
  if (!data[userId]) data[userId] = { roles: {} };
  if (!data[userId].roles) data[userId].roles = {};
}

// Add minutes to a specific role timer (user+role)
function addMinutesForRole(userId, roleId, minutes) {
  const data = readData();
  const now = Date.now();

  ensureUserRoleBucket(data, userId);

  const current = data[userId].roles[roleId]?.expiresAt ?? 0;
  const base = current > now ? current : now;
  const expiresAt = base + minutes * 60 * 1000;

  data[userId].roles[roleId] = { expiresAt };
  writeData(data);

  return expiresAt;
}

// Remove minutes from a role timer (user+role)
// Returns:
// - 0 if expired/removed
// - new expiresAt timestamp if still active
// - null if no timer existed
function removeMinutesForRole(userId, roleId, minutes) {
  const data = readData();
  if (!data[userId]?.roles?.[roleId]) return null;

  const now = Date.now();
  const current = data[userId].roles[roleId].expiresAt;
  const newExpiry = current - minutes * 60 * 1000;

  if (newExpiry <= now) {
    delete data[userId].roles[roleId];
    if (Object.keys(data[userId].roles).length === 0) {
      delete data[userId];
    }
    writeData(data);
    return 0;
  }

  data[userId].roles[roleId].expiresAt = newExpiry;
  writeData(data);
  return newExpiry;
}

function getTimeLeftMsForRole(userId, roleId) {
  const data = readData();
  const expiresAt = data[userId]?.roles?.[roleId]?.expiresAt ?? 0;
  return Math.max(0, expiresAt - Date.now());
}

function getCurrentTimedRoleId(userId) {
  const data = readData();
  const roles = data[userId]?.roles;
  if (!roles) return null;
  const ids = Object.keys(roles);
  if (ids.length === 0) return null;
  return ids[0];
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

  if (!TOKEN) {
    console.error("Missing DISCORD_TOKEN. Bot cannot start.");
    return;
  }
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
      .setName("removetime")
      .setDescription("Remove minutes from a user's timed role.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption((o) =>
        o.setName("user").setDescription("User to modify").setRequired(true)
      )
      .addIntegerOption((o) =>
        o
          .setName("minutes")
          .setDescription("Minutes to remove")
          .setRequired(true)
          .setMinValue(1)
      )
      .addRoleOption((o) =>
        o.setName("role").setDescription("Role to remove time from (optional)").setRequired(false)
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
    // ---------- /addtime ----------
    if (interaction.commandName === "addtime") {
      if (!interaction.guild) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      }

      const targetUser = interaction.options.getUser("user", true);
      const minutes = interaction.options.getInteger("minutes", true);
      const targetRole = interaction.options.getRole("role", true);

      const guild = interaction.guild;

      const role = guild.roles.cache.get(targetRole.id);
      if (!role) {
        return interaction.reply({ content: "I couldn't find that role in this server.", ephemeral: true });
      }

      const me = await guild.members.fetchMe();
      if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: "I don't have **Manage Roles** permission.", ephemeral: true });
      }
      if (me.roles.highest.position <= role.position) {
        return interaction.reply({
          content:
            `I can't assign **${role.name}** because my highest role is not above it.\n` +
            `Move my bot role higher than **${role.name}** in the server role list.`,
          ephemeral: true,
        });
      }

      const member = await guild.members.fetch(targetUser.id);

      const expiresAt = addMinutesForRole(targetUser.id, role.id, minutes);
      await member.roles.add(role.id);

      return interaction.reply({
        content:
          `Added **${minutes} minutes** to ${targetUser} for **${role.name}** and assigned the role.\n` +
          `New expiry: <t:${Math.floor(expiresAt / 1000)}:F> (in <t:${Math.floor(expiresAt / 1000)}:R>).`,
        ephemeral: false,
      });
    }

    // ---------- /removetime ----------
    if (interaction.commandName === "removetime") {
      if (!interaction.guild) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      }

      const targetUser = interaction.options.getUser("user", true);
      const minutes = interaction.options.getInteger("minutes", true);
      const roleOption = interaction.options.getRole("role"); // optional

      const guild = interaction.guild;
      const member = await guild.members.fetch(targetUser.id);
      const me = await guild.members.fetchMe();

      if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: "I don't have **Manage Roles** permission.", ephemeral: true });
      }

      const data = readData();
      const timers = data[targetUser.id]?.roles || {};
      const timedRoleIds = Object.keys(timers);

      if (timedRoleIds.length === 0) {
        return interaction.reply({ content: `${targetUser} has no active timed roles.`, ephemeral: true });
      }

      // Decide which roleId we are subtracting from
      let roleIdToEdit = null;

      if (roleOption) {
        // Explicit targeting: subtract ONLY from this role timer
        roleIdToEdit = roleOption.id;

        if (!timers[roleIdToEdit]) {
          return interaction.reply({
            content: `${targetUser} has no saved time for **${roleOption.name}**.`,
            ephemeral: true,
          });
        }
      } else {
        // No role provided: pick a timed role the user currently has in Discord, if unambiguous
        const matching = timedRoleIds.filter((rid) => member.roles.cache.has(rid));

        if (matching.length === 1) {
          roleIdToEdit = matching[0];
        } else if (matching.length === 0) {
          if (timedRoleIds.length === 1) {
            roleIdToEdit = timedRoleIds[0];
          } else {
            return interaction.reply({
              content:
                `${targetUser} has multiple timed roles stored.\n` +
                `Please specify which role to remove time from using the **role** option.`,
              ephemeral: true,
            });
          }
        } else {
          const names = matching
            .map((rid) => guild.roles.cache.get(rid)?.name || rid)
            .slice(0, 10)
            .join(", ");

          return interaction.reply({
            content:
              `${targetUser} currently has multiple timed roles. Please specify the **role** to remove time from.\n` +
              `Possible: ${names}`,
            ephemeral: true,
          });
        }
      }

      const roleObj = guild.roles.cache.get(roleIdToEdit);
      if (!roleObj) {
        return interaction.reply({ content: "That role no longer exists in this server.", ephemeral: true });
      }

      // Bot hierarchy check
      if (me.roles.highest.position <= roleObj.position) {
        return interaction.reply({
          content:
            `I can't manage **${roleObj.name}** because my highest role is not above it.\n` +
            `Move my bot role higher than **${roleObj.name}** in the server role list.`,
          ephemeral: true,
        });
      }

      const result = removeMinutesForRole(targetUser.id, roleIdToEdit, minutes);

      if (result === null) {
        return interaction.reply({ content: `${targetUser} has no saved time for **${roleObj.name}**.`, ephemeral: true });
      }

      // If expired -> remove role
      if (result === 0) {
        await member.roles.remove(roleIdToEdit);
        return interaction.reply({
          content:
            `Removed **${minutes} minutes** from ${targetUser} for **${roleObj.name}**.\n` +
            `Time expired — **${roleObj.name}** has been removed.`,
          ephemeral: false,
        });
      }

      // Still has time
      const leftMs = Math.max(0, result - Date.now());
      return interaction.reply({
        content:
          `Removed **${minutes} minutes** from ${targetUser} for **${roleObj.name}**.\n` +
          `Remaining: **${formatMs(leftMs)}** (expires <t:${Math.floor(result / 1000)}:R>).`,
        ephemeral: false,
      });
    }

    // ---------- /timeleft ----------
    if (interaction.commandName === "timeleft") {
      const targetUser = interaction.options.getUser("user") ?? interaction.user;
      const role = interaction.options.getRole("role"); // optional

      // If role is given, show that role
      if (role) {
        const left = getTimeLeftMsForRole(targetUser.id, role.id);
        if (left <= 0) {
          return interaction.reply({
            content: `${targetUser} has **0 time left** for **${role.name}**.`,
            ephemeral: true,
          });
        }
        return interaction.reply({
          content: `${targetUser} has **${formatMs(left)}** remaining for **${role.name}** (expires <t:${Math.floor((Date.now() + left) / 1000)}:R>).`,
          ephemeral: true,
        });
      }

      // If no role is given, show the "first stored role" (simple default)
      const currentRoleId = getCurrentTimedRoleId(targetUser.id);
      if (!currentRoleId) {
        return interaction.reply({ content: `${targetUser} has **0 time left**.`, ephemeral: true });
      }

      const left = getTimeLeftMsForRole(targetUser.id, currentRoleId);
      const roleObj = interaction.guild?.roles?.cache?.get(currentRoleId);

      if (left <= 0) {
        return interaction.reply({ content: `${targetUser} has **0 time left**.`, ephemeral: true });
      }

      return interaction.reply({
        content:
          `${targetUser} has **${formatMs(left)}** remaining` +
          (roleObj ? ` for **${roleObj.name}**` : "") +
          ` (expires <t:${Math.floor((Date.now() + left) / 1000)}:R>).`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error("Command error:", err);

    const msg = "Error running command.\nDetails: " + friendlyDiscordError(err);

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

// ---------------- Expiry cleanup (Discord-side role removal) ----------------
async function cleanupExpiredRoles() {
  try {
    if (!GUILD_ID) return;
    if (!client.isReady()) return;

    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return;

    const me = await guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return;

    const data = readData();
    const now = Date.now();
    let changed = false;

    for (const userId of Object.keys(data)) {
      const roles = data[userId]?.roles || {};

      for (const roleId of Object.keys(roles)) {
        const expiresAt = roles[roleId]?.expiresAt ?? 0;

        if (expiresAt > 0 && expiresAt <= now) {
          // Remove role in Discord (best-effort)
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            const roleObj = guild.roles.cache.get(roleId);
            if (roleObj && me.roles.highest.position > roleObj.position) {
              await member.roles.remove(roleId).catch(() => null);
            }
          }

          // Remove timer record
          delete data[userId].roles[roleId];
          changed = true;
        }
      }

      if (data[userId] && Object.keys(data[userId].roles || {}).length === 0) {
        delete data[userId];
        changed = true;
      }
    }

    if (changed) writeData(data);
  } catch (e) {
    console.error("cleanupExpiredRoles error:", e);
  }
}

// Run every 30 seconds
setInterval(() => {
  cleanupExpiredRoles();
}, 30_000);

// ---------------- Login ----------------
client.login(TOKEN).catch((err) => console.error("Login failed:", err));

// ---------------- Express Web Server ----------------
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: log request method and url
app.use((req, res, next) => {
  console.info(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Static files
app.use(express.static(path.resolve(__dirname, "public")));

// Main routes
app.use("/", indexRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.resolve(__dirname, "views", "404.html"));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Internal Server Error");
});

app.listen(PORT, () => {
  console.log(`Server listening: http://localhost:${PORT}`);
});
