// discord/handlers/showtime.js — /showtime command handler
const { EmbedBuilder } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL, formatMs, formatPauseDuration } = require("../../utils/helpers");
const { getFirstTimedRoleId } = require("../../services/timer");
const { buildTimerShowRolePayload } = require("../../services/commandViews");

async function buildTimersLeaderboardForUsers(guild, timersFromDb, options = {}) {
  const {
    title,
    maxEntries = 30,
  } = options;

  if (!Array.isArray(timersFromDb) || timersFromDb.length === 0) {
    return { status: "empty_no_timers", embed: null };
  }

  const timersList = [];
  for (const timer of timersFromDb) {
    try {
      const member = await guild.members.fetch(timer.user_id).catch(() => null);
      if (member) {
        const registration = await db.getUserRegistration(guild.id, timer.user_id).catch(() => null);
        timersList.push({ member, timer, registration });
      }
    } catch (err) {
      console.error(`Failed to fetch member ${timer.user_id}:`, err);
    }
  }

  if (timersList.length === 0) {
    return { status: "empty_no_members", embed: null };
  }

  const sortOrder = await db.getReportSortOrder(guild.id).catch(() => 'descending');

  timersList.sort((a, b) => {
    let aMs = Number(a.timer.expires_at) - Date.now();
    let bMs = Number(b.timer.expires_at) - Date.now();

    if (a.timer.paused && a.timer.paused_remaining_ms) {
      aMs = Number(a.timer.paused_remaining_ms);
    }
    if (b.timer.paused && b.timer.paused_remaining_ms) {
      bMs = Number(b.timer.paused_remaining_ms);
    }

    if (sortOrder === 'ascending') {
      return aMs - bMs;
    } else {
      return bMs - aMs;
    }
  });

  let membersList = [];
  let totalMembers = 0;
  let activeMembers = 0;
  let pausedMembers = 0;
  let expiringMembers = 0;
  let memberCount = 0;

  for (const { member, timer, registration } of timersList) {
    totalMembers++;

    let timerRemainingMs = Math.max(0, Number(timer.expires_at) - Date.now());
    if (timer.paused && timer.paused_remaining_ms) {
      timerRemainingMs = Math.max(0, Number(timer.paused_remaining_ms));
    }

    let pauseRemainingMs = 0;
    if (timer.paused && timer.pause_expires_at) {
      pauseRemainingMs = Math.max(0, Number(timer.pause_expires_at) - Date.now());
    }

    const isPaused = timer.paused;
    if (isPaused) pausedMembers++;
    else activeMembers++;

    let emoji;
    if (isPaused) {
      emoji = "⏸️";
    } else if (timerRemainingMs <= 0) {
      emoji = "🔴";
    } else if (timerRemainingMs < 60 * 60 * 1000) {
      emoji = "🔴";
      expiringMembers++;
    } else if (timerRemainingMs < 24 * 60 * 60 * 1000) {
      emoji = "🟡";
      expiringMembers++;
    } else {
      emoji = "🟢";
    }

    const timeText = formatMs(timerRemainingMs);
    const displayName = member.nickname || member.user.globalName || member.user.username;
    const inGameUsername = registration?.in_game_username || member.user.username;
    const rankMedal = memberCount === 0 ? '🥇' : memberCount === 1 ? '🥈' : memberCount === 2 ? '🥉' : '  ';

    let line;
    if (isPaused && pauseRemainingMs > 0) {
      const pauseDuration = formatPauseDuration(pauseRemainingMs);
      line = `${rankMedal} ${emoji} ${pauseDuration} • ${timeText} • ${displayName} - (${inGameUsername})`;
    } else if (isPaused) {
      line = `${rankMedal} ${emoji} [>0m] • ${timeText} • ${displayName} - (${inGameUsername})`;
    } else {
      line = `${rankMedal} ${emoji} • ${timeText} • ${displayName} - (${inGameUsername})`;
    }
    membersList.push(line);
    memberCount++;

    if (membersList.length >= maxEntries) break;
  }

  const separator = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const description = membersList.length > 0
    ? '\n' + membersList.join(`\n${separator}\n`)
    : "\nNo members have timers for this role";

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle(title || "Timer Leaderboard")
    .setDescription(description)
    .setTimestamp(new Date())
    .addFields(
      {
        name: "📊 Summary",
        value: `\`\`\`Total  |  Active  |  Expires Soon  |  Paused\n${String(totalMembers).padEnd(7)}|  ${String(activeMembers).padEnd(8)}|  ${String(expiringMembers).padEnd(14)}|  ${pausedMembers}\`\`\``,
        inline: false
      }
    )
    .setFooter({ text: `BoostMon • Showing ${Math.min(membersList.length, maxEntries)} members | Sort: ${sortOrder}` });

  return { status: "ok", embed };
}

async function handleShowtime(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const guild = interaction.guild;
  const userOption = interaction.options.getUser("user"); // nullable
  const roleInput = interaction.options.getString("role"); // nullable, now a string
  let roleOption = null;

  // Parse role from input if provided (could be role ID or mention)
  if (roleInput) {
    // Try to extract role ID from mention format <@&123456>
    const mentionMatch = roleInput.match(/^<@&(\d+)>$/);
    if (mentionMatch) {
      roleOption = guild.roles.cache.get(mentionMatch[1]);
    } else if (/^\d+$/.test(roleInput)) {
      // Try as direct ID
      roleOption = guild.roles.cache.get(roleInput);
    } else {
      // Try to find by name
      roleOption = guild.roles.cache.find(r => r.name === roleInput || r.id === roleInput);
    }

    if (!roleOption) {
      return interaction.editReply({
        content: `❌ I couldn't find a role named **${roleInput}**. Make sure the role exists.`
      });
    }
  }

  // If only role is provided (no user), show all users with that role (leaderboard view)
  if (roleOption && !userOption) {
    const payload = await buildTimerShowRolePayload({
      guild,
      roleOption,
      buildTimersLeaderboardForUsers,
    });
    return interaction.editReply(payload);
  }

  // If user is provided (with or without role), show that user's timer(s)
  const targetUser = userOption ?? interaction.user;
  const role = roleOption; // optional

  if (role) {
    const timer = await db.getTimerForRole(targetUser.id, role.id);
    if (!timer) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6) // grey
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("No Active Timer")
        .setTimestamp(new Date())
        .addFields(
          { name: "Target User", value: `${targetUser}`, inline: true },
          { name: "Role", value: `${role.name}`, inline: true },
          { name: "Time Remaining", value: "0 minutes", inline: true }
        )
        .setFooter({ text: "BoostMon • No Timer" });
      return interaction.editReply({ embeds: [embed] });
    }

    // Calculate remaining time
    let remainingMs = Number(timer.expires_at) - Date.now();
    const isPaused = timer.paused;
    if (isPaused && timer.paused_remaining_ms) {
      remainingMs = Number(timer.paused_remaining_ms);
    }

    if (remainingMs <= 0) {
      const embed = new EmbedBuilder()
        .setColor(0xE74C3C) // red
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("Timer Expired")
        .setTimestamp(new Date())
        .addFields(
          { name: "Target User", value: `${targetUser}`, inline: true },
          { name: "Role", value: `${role.name}`, inline: true },
          { name: "Time Remaining", value: "0 minutes (expired)", inline: true }
        )
        .setFooter({ text: "BoostMon • Expired" });
      return interaction.editReply({ embeds: [embed] });
    }

    const expiresAt = Date.now() + remainingMs;
    const statusColor = isPaused ? 0xF1C40F : 0x2ECC71;
    const statusTitle = isPaused ? "⏸️ Timer Paused" : "⏱️ Timer Active";
    const statusFooter = isPaused ? "BoostMon • Paused Timer" : "BoostMon • Active Timer";

    const embed = new EmbedBuilder()
      .setColor(statusColor)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(statusTitle)
      .setTimestamp(new Date())
      .addFields(
        { name: "Target User", value: `${targetUser}`, inline: true },
        { name: "Role", value: `${role.name}`, inline: true },
        { name: "Time Remaining", value: `**${isPaused && timer.paused_remaining_ms ? formatPauseDuration(timer.paused_remaining_ms) + '\n' : ''}${formatMs(remainingMs)}**`, inline: true },
        {
          name: "Expires",
          value: `<t:${Math.floor(expiresAt / 1000)}:F>\n(<t:${Math.floor(expiresAt / 1000)}:R>)`,
          inline: false
        }
      )
      .setFooter({ text: statusFooter });

    return interaction.editReply({ embeds: [embed] });
  }

  const currentRoleId = await getFirstTimedRoleId(targetUser.id);
  if (!currentRoleId) {
    const embed = new EmbedBuilder()
      .setColor(0x95A5A6) // grey
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("No Active Timers")
      .setTimestamp(new Date())
      .addFields(
        { name: "Target User", value: `${targetUser}`, inline: true },
        { name: "Status", value: "No timed roles found", inline: true }
      )
      .setFooter({ text: "BoostMon" });
    return interaction.editReply({ embeds: [embed] });
  }

  const timer = await db.getTimerForRole(targetUser.id, currentRoleId);
  const roleObj = interaction.guild?.roles?.cache?.get(currentRoleId);

  if (!timer) {
    const embed = new EmbedBuilder()
      .setColor(0x95A5A6) // grey
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("No Active Timer")
      .setTimestamp(new Date())
      .addFields(
        { name: "Target User", value: `${targetUser}`, inline: true },
        { name: "Status", value: "No timed role found", inline: true }
      )
      .setFooter({ text: "BoostMon" });
    return interaction.editReply({ embeds: [embed] });
  }

  let remainingMs = Number(timer.expires_at) - Date.now();
  const isPaused = timer.paused;
  if (isPaused && timer.paused_remaining_ms) {
    remainingMs = Number(timer.paused_remaining_ms);
  }

  if (remainingMs <= 0) {
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C) // red
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("Timer Expired")
      .setTimestamp(new Date())
      .addFields(
        { name: "Target User", value: `${targetUser}`, inline: true },
        { name: "Role", value: roleObj ? `${roleObj.name}` : "Unknown", inline: true },
        { name: "Time Remaining", value: "0 minutes (expired)", inline: true }
      )
      .setFooter({ text: "BoostMon • Expired" });
    return interaction.editReply({ embeds: [embed] });
  }

  const expiresAt = Date.now() + remainingMs;
  const statusColor = isPaused ? 0xF1C40F : 0x2ECC71;
  const statusTitle = isPaused ? "⏸️ Timer Paused" : "⏱️ Timer Active";
  const statusFooter = isPaused ? "BoostMon • Paused Timer" : "BoostMon • Active Timer";

  const embed = new EmbedBuilder()
    .setColor(statusColor)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle(statusTitle)
    .setTimestamp(new Date())
    .addFields(
      { name: "Target User", value: `${targetUser}`, inline: true },
      { name: "Role", value: roleObj ? `${roleObj.name}` : "Unknown", inline: true },
      { name: "Time Remaining", value: `**${formatMs(remainingMs)}**`, inline: true },
      {
        name: "Expires",
        value: `<t:${Math.floor(expiresAt / 1000)}:F>\n(<t:${Math.floor(expiresAt / 1000)}:R>)`,
        inline: false
      }
    )
    .setFooter({ text: statusFooter });

  return interaction.editReply({ embeds: [embed] });
}

module.exports = handleShowtime;
module.exports.buildTimersLeaderboardForUsers = buildTimersLeaderboardForUsers;
