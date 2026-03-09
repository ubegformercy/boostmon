// discord/prefixCommands.js — Prefix command bridge for existing slash handlers
const db = require("../db");
const timerHandler = require("./handlers/timer");
const boostserverHandler = require("./handlers/boostserver");

const PREFIX = "b! ";

const USAGE_HINT = "Usage: b! timer show <role> | b! boostserver leaders <server>";
const UNSUPPORTED_HINT = `Unsupported prefix command. ${USAGE_HINT}`;

function sanitizeMessagePayload(payload) {
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

function buildPrefixInteraction(message, config) {
  const optionsConfig = config?.options || {};
  let sentReply = null;

  const interaction = {
    client: message.client,
    guild: message.guild,
    guildId: message.guild?.id,
    channel: message.channel,
    user: message.author,
    member: message.member,
    memberPermissions: message.member?.permissions || null,
    deferred: false,
    replied: false,
    commandName: config?.commandName || null,
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
        const value = Object.prototype.hasOwnProperty.call(optionsConfig.strings || {}, name)
          ? optionsConfig.strings[name]
          : null;
        if ((value === null || value === undefined) && required) throw new Error(`Missing string option: ${name}`);
        return value;
      },
      getUser(name, required = false) {
        const value = Object.prototype.hasOwnProperty.call(optionsConfig.users || {}, name)
          ? optionsConfig.users[name]
          : null;
        if (!value && required) throw new Error(`Missing user option: ${name}`);
        return value;
      },
      getRole() { return null; },
      getChannel() { return null; },
      getBoolean() { return null; },
      getInteger() { return null; },
    },
    async deferReply() {
      interaction.deferred = true;
      return null;
    },
    async reply(payload) {
      const safePayload = sanitizeMessagePayload(payload);
      const sent = await message.reply(safePayload);
      interaction.replied = true;
      sentReply = sent;
      return sent;
    },
    async editReply(payload) {
      const safePayload = sanitizeMessagePayload(payload);
      if (sentReply) {
        return sentReply.edit(safePayload);
      }
      const sent = await message.reply(safePayload);
      interaction.replied = true;
      sentReply = sent;
      return sent;
    },
    async followUp(payload) {
      const safePayload = sanitizeMessagePayload(payload);
      return message.reply(safePayload);
    },
  };

  return interaction;
}

async function resolveBoostServerIdFromArg(guildId, rawServerArg) {
  const servers = await db.getBoostServers(guildId);
  const input = (rawServerArg || "").trim();
  if (!input || !Array.isArray(servers) || servers.length === 0) return null;

  const byExactId = servers.find((server) => String(server.id) === input);
  if (byExactId) return String(byExactId.id);

  const indexMatch = input.match(/^#?(\d+)$/);
  if (indexMatch) {
    const requestedIndex = Number(indexMatch[1]);
    const byIndex = servers.find((server) => Number(server.server_index) === requestedIndex);
    if (byIndex) return String(byIndex.id);
  }

  const lowered = input.toLowerCase();
  const byExactName = servers.find((server) => (server.display_name || "").toLowerCase() === lowered);
  if (byExactName) return String(byExactName.id);

  const partialMatches = servers.filter((server) => (server.display_name || "").toLowerCase().includes(lowered));
  if (partialMatches.length === 1) {
    return String(partialMatches[0].id);
  }

  return null;
}

async function handlePrefixTimerShow(message, argText) {
  if (!argText) {
    return message.reply({ content: "Usage: b! timer show <role>" });
  }

  const interaction = buildPrefixInteraction(message, {
    commandName: "timer",
    options: {
      subcommand: "show",
      strings: { role: argText },
    },
  });

  return timerHandler(interaction);
}

async function handlePrefixBoostserverLeaders(message, argText) {
  if (!argText) {
    return message.reply({ content: "Usage: b! boostserver leaders <server>" });
  }

  const serverId = await resolveBoostServerIdFromArg(message.guild.id, argText);
  if (!serverId) {
    return message.reply({ content: "❌ Boost server not found. Usage: b! boostserver leaders <server>" });
  }

  const interaction = buildPrefixInteraction(message, {
    commandName: "boostserver",
    options: {
      subcommand: "leaders",
      strings: { server: serverId },
    },
  });

  return boostserverHandler(interaction);
}

async function processPrefixCommand(message) {
  if (!message || message.author?.bot) return;
  if (!message.content || !message.content.startsWith(PREFIX)) return;

  if (!message.guild) {
    // Keep behavior aligned with guild-only slash commands by ignoring DMs.
    return;
  }

  const body = message.content.slice(PREFIX.length).trim();
  if (!body) {
    await message.reply({ content: UNSUPPORTED_HINT }).catch(() => null);
    return;
  }

  const tokens = body.split(/\s+/);
  const command = (tokens.shift() || "").toLowerCase();
  const subcommand = (tokens.shift() || "").toLowerCase();
  const argText = tokens.join(" ").trim();

  try {
    if (command === "timer" && subcommand === "show") {
      await handlePrefixTimerShow(message, argText);
      return;
    }

    if (command === "boostserver" && subcommand === "leaders") {
      await handlePrefixBoostserverLeaders(message, argText);
      return;
    }

    await message.reply({ content: UNSUPPORTED_HINT }).catch(() => null);
  } catch (err) {
    console.error("[PREFIX] Command bridge error:", err);
    await message.reply({ content: "❌ Could not run prefix command. Please try again." }).catch(() => null);
  }
}

module.exports = {
  processPrefixCommand,
  PREFIX,
};
