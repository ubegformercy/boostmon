// discord/handlers/rolestatus.js — /rolestatus command handler
const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL, formatMs } = require("../../utils/helpers");

module.exports = async function handleRolestatus(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const subcommand = interaction.options.getSubcommand();
  const subcommandGroup = interaction.options.getSubcommandGroup();
  const guild = interaction.guild;

  // ===== ROLESTATUS VIEW =====
  if (subcommand === "view") {
    const roleOption = interaction.options.getRole("role", true);

    const timersFromDb = await db.getTimersForRole(roleOption.id).catch(() => []);

    if (timersFromDb.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
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
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
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

    const sortOrder = await db.getReportSortOrder(guild.id).catch(() => 'descending');
    console.log(`[/rolestatus view] sortOrder: "${sortOrder}", typeof: ${typeof sortOrder}, timersList length: ${timersList.length}`);

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

      let remainingMs = Number(timer.expires_at) - Date.now();
      if (timer.paused && timer.paused_remaining_ms) {
        remainingMs = Number(timer.paused_remaining_ms);
      }

      const isPaused = timer.paused;
      if (isPaused) pausedMembers++;
      else activeMembers++;

      let status;
      if (isPaused) {
        status = "⏸️ PAUSED";
      } else if (remainingMs <= 0) {
        status = "🔴 EXPIRED";
      } else if (remainingMs < 60 * 60 * 1000) {
        status = "🟡 EXPIRES SOON";
        expiringMembers++;
      } else {
        status = "🟢 ACTIVE";
      }

      const timeText = remainingMs > 0 ? formatMs(remainingMs) : "0s";
      const displayName = member.nickname || member.user.globalName || member.user.username;
      const inGameUsername = registration?.in_game_username || member.user.username;
      const rankMedal = memberCount === 0 ? '🥇' : memberCount === 1 ? '🥈' : memberCount === 2 ? '🥉' : '  ';
      const line = `${rankMedal} ${status} • ${timeText} • ${displayName} - (${inGameUsername})`;
      membersList.push(line);
      memberCount++;

      if (membersList.length >= 30) break;
    }

    const separator = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    const description = membersList.length > 0
      ? '\n' + membersList.join(`\n${separator}\n`)
      : "\nNo members have timers for this role";

    const leaderboardTitle = `【⭐】${roleOption.name} Leaderboard【⭐】`;

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(leaderboardTitle)
      .setDescription(description)
      .setTimestamp(new Date())
      .addFields(
        {
          name: "📊 Summary",
          value: `\`\`\`Total  |  Active  |  Expires Soon  |  Paused\n${String(totalMembers).padEnd(7)}|  ${String(activeMembers).padEnd(8)}|  ${String(expiringMembers).padEnd(14)}|  ${pausedMembers}\`\`\``,
          inline: false
        }
      )
      .setFooter({ text: `BoostMon • Showing ${Math.min(membersList.length, 30)} members | Sort: ${sortOrder}` });

    return interaction.editReply({ embeds: [embed] });
  }

  // ===== ROLESTATUS SCHEDULE SUBCOMMANDS =====
  if (subcommandGroup === "schedule") {
    const scheduleSubcommand = interaction.options.getSubcommand();

    if (scheduleSubcommand === "set") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply({
          content: "You need **Manage Messages** permission to set up automated reports.",
        });
      }

      const role = interaction.options.getRole("role", true);
      const channel = interaction.options.getChannel("channel", true);
      const interval = interaction.options.getInteger("interval", true);
      const purgeLines = interaction.options.getInteger("purge") || 0;

      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        return interaction.editReply({
          content: "Channel must be a text or announcement channel.",
        });
      }

      const me = await guild.members.fetchMe();
      const perms = channel.permissionsFor(me);

      if (!perms?.has(PermissionFlagsBits.SendMessages)) {
        return interaction.editReply({
          content: `I don't have permission to send messages in ${channel}.`,
        });
      }

      if (purgeLines > 0 && !perms?.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply({
          content: `I don't have permission to manage messages in ${channel}. Purge feature requires this permission.`,
        });
      }

      const schedule = await db.createRolestatusSchedule(guild.id, role.id, channel.id, interval, purgeLines);

      if (!schedule) {
        return interaction.editReply({
          content: "Failed to create schedule. Please try again.",
        });
      }

      const purgeDescription = purgeLines === 0
        ? "🟢 Disabled - all messages will be kept"
        : `🗑️ Will delete ${purgeLines} message(s) before each report`;

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("✅ Schedule Created")
        .setTimestamp(new Date())
        .addFields(
          { name: "Role", value: `${role.name}`, inline: true },
          { name: "Channel", value: `${channel.name}`, inline: true },
          { name: "Interval", value: `Every ${interval} minutes`, inline: true },
          { name: "Purge Configuration", value: purgeDescription, inline: false },
          { name: "Status", value: "🟢 Active - Reports will begin shortly", inline: false }
        )
        .setFooter({ text: "BoostMon • Scheduled Report Started" });

      return interaction.editReply({ embeds: [embed] });
    }

    if (scheduleSubcommand === "disable") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply({
          content: "You need **Manage Messages** permission to disable automated reports.",
        });
      }

      const role = interaction.options.getRole("role", true);

      const success = await db.disableRolestatusSchedule(guild.id, role.id);

      if (!success) {
        return interaction.editReply({
          content: `No active schedules found for ${role.name}.`,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("⛔ Schedule Disabled")
        .setTimestamp(new Date())
        .addFields(
          { name: "Role", value: `${role.name}`, inline: true },
          { name: "Status", value: "🔴 Inactive - Reports stopped", inline: true }
        )
        .setFooter({ text: "BoostMon • Scheduled Report Stopped" });

      return interaction.editReply({ embeds: [embed] });
    }

    if (scheduleSubcommand === "list") {
      const schedules = await db.getAllRolestatusSchedules(guild.id);

      if (schedules.length === 0) {
        return interaction.editReply({
          content: "No active role status schedules in this server.",
        });
      }

      const fields = [];
      for (const schedule of schedules) {
        try {
          const role = await guild.roles.fetch(schedule.role_id).catch(() => null);
          const channel = await guild.channels.fetch(schedule.channel_id).catch(() => null);

          if (role && channel) {
            fields.push({
              name: `${role.name}`,
              value: `📢 Posts to ${channel.name}\n⏱️ Every ${schedule.interval_minutes} min`,
              inline: false,
            });
          }
        } catch (err) {
          console.error("Error fetching schedule details:", err);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("📋 Active Role Status Schedules")
        .setTimestamp(new Date())
        .addFields(...fields)
        .setFooter({ text: `BoostMon • ${schedules.length} schedule(s) active` });

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
