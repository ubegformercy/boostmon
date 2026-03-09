// discord/prefixRouter.js — Internal prefix router using existing slash handlers
const db = require("../db");
const { buildTimerShowRolePayload } = require("../services/commandViews");
const timerHandler = require("./handlers/timer");
const boostserverHandler = require("./handlers/boostserver");
const urlHandler = require("./handlers/url");
const infoHandler = require("./handlers/info");
const autopurgeHandler = require("./handlers/autopurge");
const queueHandler = require("./handlers/boostqueue");
const streakHandler = require("./handlers/streak");
const pingHandler = require("./handlers/ping");

const PREFIX = "b! ";
const USAGE_HINT = [
  "Usage:",
  "b! timer show <role|@user>",
  "b! boostserver leaders <server>",
  "b! url get",
  "b! info [@user]",
  "b! autopurge status",
  "b! ping",
  "b! queue list",
  "b! streak leaderboard",
  "b! streak status [@user]",
].join("\n");
const TIMER_SHOW_USAGE = "Usage: b! timer show <role|@user>";
const LEADERS_USAGE = "Usage: b! boostserver leaders <server>";
const URL_GET_USAGE = "Usage: b! url get";
const AUTOPURGE_STATUS_USAGE = "Usage: b! autopurge status";
const QUEUE_LIST_USAGE = "Usage: b! queue list";
const STREAK_LEADERBOARD_USAGE = "Usage: b! streak leaderboard";
const STREAK_STATUS_USAGE = "Usage: b! streak status [@user]";
const INFO_USAGE = "Usage: b! info [@user]";
const PING_USAGE = "Usage: b! ping";

function sanitizeReplyPayload(payload) {
  if (typeof payload === "string") {
    return { content: payload };
  }

  const safe = { ...(payload || {}) };
  delete safe.ephemeral;

  if (safe.content === null || safe.content === undefined) {
    delete safe.content;
  }

  return safe;
}

function buildPrefixInteraction(message, config = {}) {
  const optionsConfig = config.options || {};
  let sentReply = null;

  const interaction = {
    client: message.client,
    guild: message.guild,
    guildId: message.guild?.id,
    channel: message.channel,
    user: message.author,
    member: message.member,
    memberPermissions: message.member?.permissions || null,
    createdTimestamp: message.createdTimestamp,
    deferred: false,
    replied: false,
    commandName: config.commandName || null,
    options: {
      getSubcommand(required = true) {
        const value = optionsConfig.subcommand || null;
        if (!value && required) throw new Error("Missing subcommand");
        return value;
      },
      getSubcommandGroup(required = false) {
        const value = optionsConfig.subcommandGroup || null;
        if (!value && required) throw new Error("Missing subcommand group");
        return value;
      },
      getString(name, required = false) {
        const strings = optionsConfig.strings || {};
        const value = Object.prototype.hasOwnProperty.call(strings, name) ? strings[name] : null;
        if ((value === null || value === undefined) && required) throw new Error(`Missing string option: ${name}`);
        return value;
      },
      getUser(name, required = false) {
        const users = optionsConfig.users || {};
        const value = Object.prototype.hasOwnProperty.call(users, name) ? users[name] : null;
        if (!value && required) throw new Error(`Missing user option: ${name}`);
        return value;
      },
      getRole(name, required = false) {
        const roles = optionsConfig.roles || {};
        const value = Object.prototype.hasOwnProperty.call(roles, name) ? roles[name] : null;
        if (!value && required) throw new Error(`Missing role option: ${name}`);
        return value;
      },
      getChannel(name, required = false) {
        const channels = optionsConfig.channels || {};
        const value = Object.prototype.hasOwnProperty.call(channels, name) ? channels[name] : null;
        if (!value && required) throw new Error(`Missing channel option: ${name}`);
        return value;
      },
      getBoolean(name, required = false) {
        const booleans = optionsConfig.booleans || {};
        const value = Object.prototype.hasOwnProperty.call(booleans, name) ? booleans[name] : null;
        if (value === null && required) throw new Error(`Missing boolean option: ${name}`);
        return value;
      },
      getInteger(name, required = false) {
        const integers = optionsConfig.integers || {};
        const value = Object.prototype.hasOwnProperty.call(integers, name) ? integers[name] : null;
        if (value === null && required) throw new Error(`Missing integer option: ${name}`);
        return value;
      },
    },
    async deferReply() {
      interaction.deferred = true;
      return null;
    },
    async reply(payload) {
      const safePayload = sanitizeReplyPayload(payload);
      const sent = await message.reply(safePayload);
      interaction.replied = true;
      sentReply = sent;
      return sent;
    },
    async editReply(payload) {
      const safePayload = sanitizeReplyPayload(payload);
      if (sentReply) {
        return sentReply.edit(safePayload);
      }
      const sent = await message.reply(safePayload);
      interaction.replied = true;
      sentReply = sent;
      return sent;
    },
    async followUp(payload) {
      const safePayload = sanitizeReplyPayload(payload);
      return message.reply(safePayload);
    },
  };

  return interaction;
}

function splitHead(text) {
  const match = (text || "").match(/^(\S+)(?:\s+([\s\S]*))?$/);
  return {
    head: match?.[1] || "",
    tail: (match?.[2] || "").trim(),
  };
}

async function resolveMentionedUser(guild, text) {
  const mentionMatch = (text || "").trim().match(/^<@!?(\d+)>$/);
  if (!mentionMatch) return null;
  const member = await guild.members.fetch(mentionMatch[1]).catch(() => null);
  return member?.user || null;
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

  const mentionedUser = await resolveMentionedUser(message.guild, argText);
  if (mentionedUser) {
    const interaction = buildPrefixInteraction(message, {
      commandName: "timer",
      options: {
        subcommand: "show",
        users: { user: mentionedUser },
      },
    });
    return timerHandler(interaction);
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

  const interaction = buildPrefixInteraction(message, {
    commandName: "boostserver",
    options: {
      subcommand: "leaders",
      strings: { server: String(server.id) },
    },
  });
  return boostserverHandler(interaction);
}

async function handleUrlGetPrefix(message, argText) {
  if (argText) return message.reply({ content: URL_GET_USAGE });
  const interaction = buildPrefixInteraction(message, {
    commandName: "url",
    options: { subcommand: "get" },
  });
  return urlHandler(interaction);
}

async function handleInfoPrefix(message, argText) {
  let targetUser = null;
  if (argText) {
    targetUser = await resolveMentionedUser(message.guild, argText);
    if (!targetUser) {
      return message.reply({ content: INFO_USAGE });
    }
  }

  const interaction = buildPrefixInteraction(message, {
    commandName: "info",
    options: {
      users: targetUser ? { user: targetUser } : {},
    },
  });
  return infoHandler(interaction);
}

async function handleAutopurgeStatusPrefix(message, argText) {
  if (argText) return message.reply({ content: AUTOPURGE_STATUS_USAGE });
  const interaction = buildPrefixInteraction(message, {
    commandName: "autopurge",
    options: { subcommand: "status" },
  });
  return autopurgeHandler(interaction);
}

async function handlePingPrefix(message, argText) {
  if (argText) return message.reply({ content: PING_USAGE });
  const interaction = buildPrefixInteraction(message, {
    commandName: "ping",
  });
  return pingHandler(interaction);
}

async function handleQueueListPrefix(message, argText) {
  if (argText) return message.reply({ content: QUEUE_LIST_USAGE });
  const interaction = buildPrefixInteraction(message, {
    commandName: "queue",
    options: { subcommand: "list" },
  });
  return queueHandler(interaction, { client: message.client });
}

async function handleStreakLeaderboardPrefix(message, argText) {
  if (argText) return message.reply({ content: STREAK_LEADERBOARD_USAGE });
  const interaction = buildPrefixInteraction(message, {
    commandName: "streak",
    options: { subcommand: "leaderboard" },
  });
  return streakHandler(interaction);
}

async function handleStreakStatusPrefix(message, argText) {
  let targetUser = null;
  if (argText) {
    targetUser = await resolveMentionedUser(message.guild, argText);
    if (!targetUser) {
      return message.reply({ content: STREAK_STATUS_USAGE });
    }
  }

  const interaction = buildPrefixInteraction(message, {
    commandName: "streak",
    options: {
      subcommand: "status",
      users: targetUser ? { user: targetUser } : {},
    },
  });
  return streakHandler(interaction);
}

const ROUTES = {
  timer: {
    show: handleTimerShowPrefix,
  },
  boostserver: {
    leaders: handleBoostserverLeadersPrefix,
  },
  url: {
    get: handleUrlGetPrefix,
  },
  autopurge: {
    status: handleAutopurgeStatusPrefix,
  },
  queue: {
    list: handleQueueListPrefix,
  },
  streak: {
    leaderboard: handleStreakLeaderboardPrefix,
    status: handleStreakStatusPrefix,
  },
  info: {
    __direct: handleInfoPrefix,
  },
  ping: {
    __direct: handlePingPrefix,
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

  const { head: commandRaw, tail: restAfterCommand } = splitHead(body);
  const command = commandRaw.toLowerCase();

  const commandRoutes = ROUTES[command];
  if (!commandRoutes) {
    await message.reply({ content: USAGE_HINT }).catch(() => null);
    return;
  }

  const directHandler = commandRoutes.__direct;
  if (directHandler) {
    try {
      await directHandler(message, restAfterCommand);
    } catch (err) {
      console.error("[PREFIX-ROUTER] Error:", err);
      await message.reply({ content: "❌ Could not run prefix command. Please try again." }).catch(() => null);
    }
    return;
  }

  const { head: subcommandRaw, tail: argText } = splitHead(restAfterCommand);
  const subcommand = subcommandRaw.toLowerCase();

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
