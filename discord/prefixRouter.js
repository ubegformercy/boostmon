// discord/prefixRouter.js — Internal prefix router using shared command services
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../db");
const { buildTimerShowRolePayload, buildBoostServerLeadersPayload } = require("../services/commandViews");
const showtimeHandler = require("./handlers/showtime");
const boostserverHandler = require("./handlers/boostserver");

const PREFIX = "b! ";
const USAGE_HINT = "Usage: b! timer show <role> | b! boostserver leaders <server>";

function sanitizeReplyPayload(payload) {
  const safe = { ...(payload || {}) };
  if (safe.content === null || safe.content === undefined) {
    delete safe.content;
  }
  return safe;
}

function parseRoleInput(guild, roleInput) {
  if (!roleInput) return null;

  const mentionMatch = roleInput.match(/^<@&(\d+)>$/);
  if (mentionMatch) {
    return guild.roles.cache.get(mentionMatch[1]) || null;
  }

  if (/^\d+$/.test(roleInput)) {
    return guild.roles.cache.get(roleInput) || null;
  }

  return guild.roles.cache.find((role) => role.name === roleInput || role.id === roleInput) || null;
}

async function resolveBoostServerFromArg(guildId, rawServerArg) {
  const servers = await db.getBoostServers(guildId);
  const input = (rawServerArg || "").trim();
  if (!input || !Array.isArray(servers) || servers.length === 0) return null;

  const byExactId = servers.find((server) => String(server.id) === input);
  if (byExactId) return byExactId;

  const indexMatch = input.match(/^#?(\d+)$/);
  if (indexMatch) {
    const requestedIndex = Number(indexMatch[1]);
    const byIndex = servers.find((server) => Number(server.server_index) === requestedIndex);
    if (byIndex) return byIndex;
  }

  const lowered = input.toLowerCase();
  const byExactName = servers.find((server) => (server.display_name || "").toLowerCase() === lowered);
  if (byExactName) return byExactName;

  const partialMatches = servers.filter((server) => (server.display_name || "").toLowerCase().includes(lowered));
  if (partialMatches.length === 1) {
    return partialMatches[0];
  }

  return null;
}

function buildLeadersRefreshRow(serverId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bsleaders_refresh:${serverId}`)
      .setLabel("Refresh")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Secondary)
  );
}

async function handleTimerShowPrefix(message, argText) {
  if (!argText) {
    return message.reply({ content: "Usage: b! timer show <role>" });
  }

  const roleOption = parseRoleInput(message.guild, argText);
  if (!roleOption) {
    return message.reply({
      content: `❌ I couldn't find a role named **${argText}**. Make sure the role exists.`,
    });
  }

  const payload = await buildTimerShowRolePayload({
    guild: message.guild,
    roleOption,
    buildTimersLeaderboardForUsers: showtimeHandler.buildTimersLeaderboardForUsers,
  });

  return message.reply(sanitizeReplyPayload(payload));
}

async function handleBoostserverLeadersPrefix(message, argText) {
  if (!argText) {
    return message.reply({ content: "Usage: b! boostserver leaders <server>" });
  }

  const server = await resolveBoostServerFromArg(message.guild.id, argText);
  if (!server) {
    return message.reply({ content: "❌ Boost server not found. Usage: b! boostserver leaders <server>" });
  }

  const canView = boostserverHandler.canViewBoostServerLeaders(
    {
      member: message.member,
      memberPermissions: message.member?.permissions,
      user: message.author,
    },
    message.guild,
    server
  );

  if (!canView) {
    return message.reply({ content: "Not authorized." });
  }

  const basePayload = await buildBoostServerLeadersPayload({
    guild: message.guild,
    server,
    buildTimersLeaderboardForUsers: showtimeHandler.buildTimersLeaderboardForUsers,
  });

  const payload = {
    ...basePayload,
    components: [buildLeadersRefreshRow(server.id)],
  };

  return message.reply(sanitizeReplyPayload(payload));
}

const ROUTES = {
  timer: {
    show: handleTimerShowPrefix,
  },
  boostserver: {
    leaders: handleBoostserverLeadersPrefix,
  },
};

async function routePrefixCommand(message) {
  if (!message || message.author?.bot) return;
  if (!message.content || !message.content.startsWith(PREFIX)) return;

  if (!message.guild) {
    return;
  }

  const body = message.content.slice(PREFIX.length).trim();
  if (!body) {
    await message.reply({ content: USAGE_HINT }).catch(() => null);
    return;
  }

  const tokens = body.split(/\s+/);
  const command = (tokens.shift() || "").toLowerCase();
  const subcommand = (tokens.shift() || "").toLowerCase();
  const argText = tokens.join(" ").trim();

  const commandRoutes = ROUTES[command];
  const routeHandler = commandRoutes ? commandRoutes[subcommand] : null;

  if (!routeHandler) {
    await message.reply({ content: USAGE_HINT }).catch(() => null);
    return;
  }

  try {
    await routeHandler(message, argText);
  } catch (err) {
    console.error("[PREFIX-ROUTER] Error:", err);
    await message.reply({ content: "❌ Could not run prefix command. Please try again." }).catch(() => null);
  }
}

module.exports = {
  routePrefixCommand,
  PREFIX,
};
