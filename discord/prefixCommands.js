// discord/prefixCommands.js — Prefix command handler for b! commands
const { EmbedBuilder } = require("discord.js");
const { BOOSTMON_ICON_URL } = require("../utils/helpers");

const PREFIX = "b!";

// Prefix command handlers
const prefixHandlers = {
  help: handleHelp,
  info: handleInfo,
  queue: handleQueue,
  streak: handleStreak,
  timers: handleTimers,
};

async function handleHelp(message, args) {
  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("📚 BoostMon Command Help")
    .setDescription("BoostMon uses **slash commands** (`/`). Here's how to get started:")
    .addFields(
      {
        name: "🎯 Timer Management",
        value: "/timer set, /timer add, /timer remove, /timer clear, /timer show",
        inline: false,
      },
      {
        name: "⏸️ Pause & Resume",
        value: "/timer pause user, /timer pause global, /timer resume user, /timer resume global",
        inline: false,
      },
      {
        name: "🏆 Streaks",
        value: "/streak status, /streak leaderboard",
        inline: false,
      },
      {
        name: "📋 Queue",
        value: "/queue add, /queue list, /queue status, /queue remove",
        inline: false,
      },
      {
        name: "⚙️ Setup",
        value: "/setup timer-roles, /setup streak-roles",
        inline: false,
      },
      {
        name: "💡 Prefix Commands",
        value: `${PREFIX} help, ${PREFIX} info, ${PREFIX} queue, ${PREFIX} streak, ${PREFIX} timers`,
        inline: false,
      }
    )
    .setFooter({ text: "Type / in chat to see all available slash commands" })
    .setTimestamp(new Date());

  return message.reply({ embeds: [embed] });
}

async function handleInfo(message, args) {
  const targetUser = message.mentions.users.first() || message.author;
  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle(`ℹ️ ${targetUser.username}'s Stats`)
    .setDescription("Use `/info [@user]` to view detailed stats including streaks, timers, and pause credits")
    .setFooter({ text: "Use the /info slash command for full details" })
    .setTimestamp(new Date());

  return message.reply({ embeds: [embed] });
}

async function handleQueue(message, args) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("📋 Queue Commands")
    .setDescription("Manage the boost queue using these slash commands:")
    .addFields(
      { name: "/queue add [note]", value: "Add yourself to the queue", inline: false },
      { name: "/queue remove", value: "Remove yourself from the queue", inline: false },
      { name: "/queue status", value: "Check your position in the queue", inline: false },
      { name: "/queue list [#channel]", value: "View the entire queue", inline: false }
    )
    .setFooter({ text: "Use slash commands for queue management" })
    .setTimestamp(new Date());

  return message.reply({ embeds: [embed] });
}

async function handleStreak(message, args) {
  const embed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("🏆 Streak Commands")
    .setDescription("Track your boost streaks using these slash commands:")
    .addFields(
      { name: "/streak status [@user]", value: "View your current streak", inline: false },
      { name: "/streak leaderboard", value: "View top performers in the server", inline: false },
      { name: "/streak admin grant-save @user", value: "Admin: Award streak save tokens", inline: false }
    )
    .setFooter({ text: "Use slash commands for streak management" })
    .setTimestamp(new Date());

  return message.reply({ embeds: [embed] });
}

async function handleTimers(message, args) {
  const embed = new EmbedBuilder()
    .setColor(0x1ABC9C)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("⏱️ Timer Commands")
    .setDescription("Manage timed roles using these slash commands:")
    .addFields(
      { name: "/timer set @user <minutes> @role", value: "Admin: Set exact timer", inline: false },
      { name: "/timer add @user <minutes> [@role]", value: "Admin: Add minutes to timer", inline: false },
      { name: "/timer remove @user <minutes> [@role]", value: "Admin: Remove minutes", inline: false },
      { name: "/timer show [@user] [@role]", value: "Anyone: Check remaining time", inline: false },
      { name: "/timer pause user @user <duration>", value: "Pause a user's timer (costs credits)", inline: false },
      { name: "/timer resume user @user", value: "Resume your own paused timer", inline: false }
    )
    .setFooter({ text: "Admin commands require Administrator permission" })
    .setTimestamp(new Date());

  return message.reply({ embeds: [embed] });
}

async function processPrefixCommand(message) {
  // Ignore bot messages and messages without prefix
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  // Extract command and arguments
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Get handler for command
  const handler = prefixHandlers[command];
  if (!handler) {
    // Unknown command — just send help
    return handleHelp(message, args);
  }

  try {
    await handler(message, args);
  } catch (err) {
    console.error(`[PREFIX-COMMAND] Error handling ${PREFIX}${command}:`, err);
    return message.reply({
      content: "❌ Error processing command. Try using slash commands instead!",
      ephemeral: true,
    }).catch(() => null);
  }
}

module.exports = {
  processPrefixCommand,
  PREFIX,
};
