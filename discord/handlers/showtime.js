// discord/handlers/showtime.js — /showtime command handler
const { EmbedBuilder } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL, formatMs } = require("../../utils/helpers");
const { getFirstTimedRoleId } = require("../../services/timer");

module.exports = async function handleShowtime(interaction) {
  await interaction.deferReply().catch(() => null);

  const userOption = interaction.options.getUser("user"); // nullable
  const roleOption = interaction.options.getRole("role"); // nullable

  // If only role is provided (no user), show all users with that role (like /rolestatus view)
  if (roleOption && !userOption) {
    if (!interaction.guild) {
      return interaction.editReply({ content: "This command can only be used in a server." });
    }

    const guild = interaction.guild;
    const timersFromDb = await db.getTimersForRole(roleOption.id).catch(() => []);

    if (timersFromDb.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6) // grey
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("Role Status")
        .setTimestamp(new Date())
        .addFields(
          { name: "Role", value: `${roleOption.name}`, inline: true },
          { name: "Members", value: "0", inline: true },
          { name: "Status", value: "No members have timers for this role", inline: false }
        )
        .setFooter({ text: "BoostMon • Role Status" });
      return interaction.editReply({ embeds: [embed] });
    }

    // Fetch only the members that have timers for this role
    const timersList = [];
    for (const timer of timersFromDb) {
      try {
        const member = await guild.members.fetch(timer.user_id).catch(() => null);
        if (member) {
          timersList.push({ member, timer });
        }
      } catch (err) {
        console.error(`Failed to fetch member ${timer.user_id}:`, err);
      }
    }

    // If no members found, they may have left the server
    if (timersList.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6) // grey
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("Role Status")
        .setTimestamp(new Date())
        .addFields(
          { name: "Role", value: `${roleOption.name}`, inline: true },
          { name: "Members", value: "0", inline: true },
          { name: "Status", value: "Members with timers have left the server", inline: false }
        )
        .setFooter({ text: "BoostMon • Role Status" });
      return interaction.editReply({ embeds: [embed] });
    }

    // Sort by time remaining (ascending - expires soonest first)
    timersList.sort((a, b) => {
      let aMs = Number(a.timer.expires_at) - Date.now();
      let bMs = Number(b.timer.expires_at) - Date.now();

      if (a.timer.paused && a.timer.paused_remaining_ms) {
        aMs = Number(a.timer.paused_remaining_ms);
      }
      if (b.timer.paused && b.timer.paused_remaining_ms) {
        bMs = Number(b.timer.paused_remaining_ms);
      }

      return aMs - bMs;
    });

    // Build field list
    const fields = [];
    let totalMembers = 0;
    let activeMembers = 0;
    let pausedMembers = 0;

    for (const { member, timer } of timersList) {
      totalMembers++;
      const isPaused = timer.paused;
      if (isPaused) pausedMembers++;
      else activeMembers++;

      let remainingMs = Number(timer.expires_at) - Date.now();
      if (isPaused && timer.paused_remaining_ms) {
        remainingMs = Number(timer.paused_remaining_ms);
      }

      const status = isPaused ? "⏸️ PAUSED" : remainingMs <= 0 ? "🔴 EXPIRED" : "🟢 ACTIVE";
      const timeText = remainingMs > 0 ? formatMs(remainingMs) : "0s";

      // Limit to 20 members per embed (leave room for summary field)
      if (fields.length < 20) {
        fields.push({
          name: `${member.user.username}`,
          value: `${status} • ${timeText}`,
          inline: false
        });
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71) // green
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`${roleOption.name} - Status Report`)
      .setTimestamp(new Date())
      .addFields(...fields)
      .addFields(
        { name: "━━━━━━━━━━━━━━━", value: "Summary", inline: false },
        { name: "Total Members", value: `${totalMembers}`, inline: true },
        { name: "Active ⏱️", value: `${activeMembers}`, inline: true },
        { name: "Paused ⏸️", value: `${pausedMembers}`, inline: true }
      )
      .setFooter({ text: `BoostMon • Showing ${Math.min(timersList.length, 20)} members` });

    return interaction.editReply({ embeds: [embed] });
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
};
