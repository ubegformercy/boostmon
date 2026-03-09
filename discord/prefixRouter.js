// discord/prefixRouter.js — Internal prefix router using shared command services
const db = require("../db");
const { buildTimerShowRolePayload, buildBoostServerLeadersPayload } = require("../services/commandViews");
const showtimeHandler = require("./handlers/showtime");
const boostserverHandler = require("./handlers/boostserver");

const PREFIX = "b! ";
const USAGE_HINT = "Usage: b! timer show <role> | b! boostserver leaders <server>";
const TIMER_SHOW_USAGE = "Usage: b! timer show <role>";
const LEADERS_USAGE = "Usage: b! boostserver leaders <server>";

function sanitizeReplyPayload(payload) {
  const safe = { ...(payload || {}) };
  if (safe.content === null || safe.content === undefined) {
    delete safe.content;
  }
  return safe;
}

function parseRoleInput(guild, roleInput) {
  if (!roleInput) return { role: null, error: "missing" };

  const mentionMatch = roleInput.match(/^<@&(\d+)>$/);
  if (mentionMatch) {
    return { role: guild.roles.cache.get(mentionMatch[1]) || null, error: null };
  }

  if (/^\d+$/.test(roleInput)) {
    return { role: guild.roles.cache.get(roleInput) || null, error: null };
  }

  const exactNameMatches = [...guild.roles.cache.values()].filter((role) => role.name === roleInput);
  if (exactNameMatches.length > 1) {
    return { role: null, error: "ambiguous" };
  }

  if (exactNameMatches.length === 1) {
    return { role: exactNameMatches[0], error: null };
  }

  return { role: null, error: "not_found" };
}

async function resolveBoostServerFromArg(guildId, rawServerArg) {
  const servers = await db.getBoostServers(guildId);
  let input = (rawServerArg || "").trim();
  if (!input || !Array.isArray(servers) || servers.length === 0) return { server: null, error: "not_found" };

  if (input.startsWith('"') && input.endsWith('"') && input.length >= 2) {
    input = input.slice(1, -1).trim();
  }
  if (!input) return { server: null, error: "not_found" };

  const activeServers = servers.filter((server) => server.status !== "deleted");
  const preferActive = (matches) => {
    if (!Array.isArray(matches) || matches.length === 0) return [];
    const activeMatches = matches.filter((server) => server.status !== "deleted");
    return activeMatches.length > 0 ? activeMatches : matches;
  };

  const byExactId = servers.find((server) => String(server.id) === input);
  if (byExactId) return { server: byExactId, error: null };

  const indexMatch = input.match(/^#?(\d+)$/);
  if (indexMatch) {
    const requestedIndex = Number(indexMatch[1]);
    const byIndex = servers.find((server) => Number(server.server_index) === requestedIndex);
    if (byIndex) return { server: byIndex, error: null };
  }

  const lowered = input.toLowerCase();
  const exactNameMatches = preferActive(servers.filter((server) => (server.display_name || "").toLowerCase() === lowered));
  if (exactNameMatches.length === 1) {
    return { server: exactNameMatches[0], error: null };
  }
  if (exactNameMatches.length > 1) {
    return { server: null, error: "ambiguous" };
  }

  const partialMatches = preferActive(activeServers.filter((server) => (server.display_name || "").toLowerCase().includes(lowered)));
  if (partialMatches.length === 1) {
    return { server: partialMatches[0], error: null };
  }

  if (partialMatches.length > 1) {
    return { server: null, error: "ambiguous" };
  }

  return { server: null, error: "not_found" };
}

async function handleTimerShowPrefix(message, argText) {
  if (!argText) {
    return message.reply({ content: TIMER_SHOW_USAGE });
  }

  const { role: roleOption, error: roleError } = parseRoleInput(message.guild, argText);
  if (roleError === "ambiguous") {
    return message.reply({ content: `❌ Ambiguous role. Please use a role mention. ${TIMER_SHOW_USAGE}` });
  }

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
    return message.reply({ content: LEADERS_USAGE });
  }

  const { server, error: serverError } = await resolveBoostServerFromArg(message.guild.id, argText);
  if (serverError === "ambiguous") {
    return message.reply({ content: `❌ Ambiguous server name. Please be more specific or use quotes. ${LEADERS_USAGE}` });
  }

  if (!server) {
    return message.reply({ content: `❌ Boost server not found. ${LEADERS_USAGE}` });
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
    components: [boostserverHandler.buildLeadersRefreshRow(server.id)],
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

  const body = message.content.slice(PREFIX.length).replace(/\s+/g, " ").trim();
  if (!body) {
    await message.reply({ content: USAGE_HINT }).catch(() => null);
    return;
  }

  const parsed = body.match(/^(\S+)\s+(\S+)(?:\s+([\s\S]*))?$/);
  const command = (parsed?.[1] || "").toLowerCase();
  const subcommand = (parsed?.[2] || "").toLowerCase();
  const argText = (parsed?.[3] || "").trim();

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
