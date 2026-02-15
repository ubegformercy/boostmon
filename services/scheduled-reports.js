// services/scheduled-reports.js — Automated rolestatus reports and autopurge execution
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../db");
const { BOOSTMON_ICON_URL, formatMs } = require("../utils/helpers");

async function executeScheduledRolestatus(guild, now) {
  try {
    const schedules = await db.getAllRolestatusSchedules(guild.id).catch(() => []);

    for (const schedule of schedules) {
      console.log(`[SCHEDULED-REPORT] Processing schedule: role=${schedule.role_id}, channel=${schedule.channel_id}, interval=${schedule.interval_minutes}m, purge_lines=${schedule.purge_lines}`);
      const channel = guild.channels.cache.get(schedule.channel_id);
      if (!channel) {
        console.warn(`[SCHEDULED-REPORT] Channel ${schedule.channel_id} not found in guild ${guild.id}`);
        continue;
      }

      if (!channel.isTextBased()) {
        console.warn(`[SCHEDULED-REPORT] Channel ${channel.name} is not text-based`);
        continue;
      }

      const me = await guild.members.fetchMe().catch(() => null);
      if (!me) {
        console.warn(`[SCHEDULED-REPORT] Could not fetch bot member in guild ${guild.id}`);
        continue;
      }

      const perms = channel.permissionsFor(me);
      if (!perms?.has(PermissionFlagsBits.SendMessages)) {
        console.error(`[SCHEDULED-REPORT] Missing SendMessages permission in channel ${channel.name} (${schedule.channel_id}) for guild ${guild.id}`);
        continue;
      }

      if (!perms?.has(PermissionFlagsBits.EmbedLinks)) {
        console.error(`[SCHEDULED-REPORT] Missing EmbedLinks permission in channel ${channel.name} (${schedule.channel_id}) for guild ${guild.id}`);
        continue;
      }

      const lastReportTime = schedule.last_report_at ? new Date(schedule.last_report_at).getTime() : 0;
      const timeSinceLastReport = now - lastReportTime;
      const intervalMs = schedule.interval_minutes * 60 * 1000;

      if (timeSinceLastReport < intervalMs) {
        continue;
      }

      try {
        const timersFromDb = await db.getTimersForRole(schedule.role_id).catch(() => []);

        if (timersFromDb.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(0x95A5A6)
            .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
            .setTitle("📋 Role Status Report")
            .setTimestamp(new Date())
            .addFields(
              { name: "Role", value: `<@&${schedule.role_id}>`, inline: true },
              { name: "Members", value: "0", inline: true },
              { name: "Status", value: "No members have active timers", inline: false }
            )
            .setFooter({ text: "BoostMon • Automated Report" });

          try {
            await channel.send({ embeds: [embed] });
            await db.updateRolestatusLastReport(guild.id, schedule.role_id, schedule.channel_id);
          } catch (err) {
            console.error(`[SCHEDULED-REPORT] Failed to send empty report to ${channel.name}: ${err.message}`);
          }
          continue;
        }

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

        if (timersList.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(0x95A5A6)
            .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
            .setTitle("📋 Role Status Report")
            .setTimestamp(new Date())
            .addFields(
              { name: "Role", value: `<@&${schedule.role_id}>`, inline: true },
              { name: "Members", value: "0", inline: true },
              { name: "Status", value: "Members with timers have left the server", inline: false }
            )
            .setFooter({ text: "BoostMon • Automated Report" });

          try {
            await channel.send({ embeds: [embed] });
            await db.updateRolestatusLastReport(guild.id, schedule.role_id, schedule.channel_id);
          } catch (err) {
            console.error(`[SCHEDULED-REPORT] Failed to send left-members report to ${channel.name}: ${err.message}`);
          }
          continue;
        }

        const sortOrder = await db.getReportSortOrder(guild.id).catch(() => 'descending');
        console.log(`[/rolestatus schedule] sortOrder: "${sortOrder}", typeof: ${typeof sortOrder}, timersList length: ${timersList.length}`);

        timersList.sort((a, b) => {
          let aMs = Number(a.timer.expires_at) - now;
          let bMs = Number(b.timer.expires_at) - now;

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

        for (const { member, timer } of timersList) {
          totalMembers++;

          let remainingMs = Number(timer.expires_at) - now;
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
          const registration = await db.getUserRegistration(guild.id, timer.user_id).catch(() => null);
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

        const roleName = (await guild.roles.fetch(schedule.role_id).catch(() => null))?.name || "Role Status";
        const leaderboardTitle = `【⭐】${roleName} Leaderboard【⭐】`;

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
              inline: false,
            }
          )
          .setFooter({ text: `BoostMon • Showing ${Math.min(membersList.length, 30)}/${totalMembers} members | Sort: ${sortOrder}` });

        if (schedule.last_message_id) {
          try {
            const oldMessage = await channel.messages.fetch(schedule.last_message_id).catch(() => null);
            if (oldMessage) {
              await oldMessage.delete().catch(() => null);
              console.log(`[SCHEDULED-REPORT] Deleted old message ${schedule.last_message_id} from ${channel.name}`);
            }
          } catch (err) {
            console.warn(`[SCHEDULED-REPORT] Could not delete old message: ${err.message}`);
          }
        }

        const purgeLines = Number(schedule.purge_lines) || 0;
        if (purgeLines > 0) {
          try {
            console.log(`[SCHEDULED-REPORT] Attempting to purge ${purgeLines} message(s) from ${channel.name}...`);
            const messages = await channel.messages.fetch({ limit: purgeLines });
            console.log(`[SCHEDULED-REPORT] Fetched ${messages.size} message(s) to purge`);
            if (messages && messages.size > 0) {
              await channel.bulkDelete(messages, true);
              console.log(`[SCHEDULED-REPORT] ✓ Successfully purged ${messages.size} message(s) from ${channel.name} before posting new report`);
            } else {
              console.log(`[SCHEDULED-REPORT] No messages found to purge in ${channel.name}`);
            }
          } catch (err) {
            console.error(`[SCHEDULED-REPORT] ✗ Could not purge messages from ${channel.name}: ${err.message}`);
            console.error(`[SCHEDULED-REPORT] Error code: ${err.code}`);
          }
        }

        let newMessage = null;
        try {
          const currentPerms = channel.permissionsFor(me);
          if (!currentPerms?.has(PermissionFlagsBits.SendMessages)) {
            console.error(`[SCHEDULED-REPORT] Permission check failed right before send in ${channel.name}: Missing SendMessages`);
            continue;
          }
          if (!currentPerms?.has(PermissionFlagsBits.EmbedLinks)) {
            console.error(`[SCHEDULED-REPORT] Permission check failed right before send in ${channel.name}: Missing EmbedLinks`);
            continue;
          }

          newMessage = await channel.send({ embeds: [embed] });
          console.log(`[SCHEDULED-REPORT] Sent new report to ${channel.name} in guild ${guild.name} (message ID: ${newMessage.id})`);
        } catch (err) {
          console.error(`[SCHEDULED-REPORT] Failed to send report to ${channel.name} in guild ${guild.name}: ${err.message}`);
          console.error(`[SCHEDULED-REPORT] Error code: ${err.code}, HTTP Status: ${err.status}`);
        }

        await db.updateRolestatusLastReport(guild.id, schedule.role_id, schedule.channel_id);
        if (newMessage) {
          await db.updateRolestatusLastMessageId(guild.id, schedule.role_id, schedule.channel_id, newMessage.id);
        }
      } catch (err) {
        console.error(`[SCHEDULED-REPORT] Error processing schedule for role ${schedule.role_id} in guild ${guild.name}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error("executeScheduledRolestatus error:", err);
  }
}

async function executeAutopurges(guild, now) {
  try {
    const settings = await db.getAllAutopurgeSettings(guild.id).catch(() => []);

    for (const setting of settings) {
      const channel = guild.channels.cache.get(setting.channel_id);
      if (!channel) continue;

      const lastPurgeTime = setting.last_purge_at ? new Date(setting.last_purge_at).getTime() : 0;
      const timeSinceLastPurge = now - lastPurgeTime;
      const intervalMs = setting.interval_seconds * 1000;

      if (timeSinceLastPurge < intervalMs) {
        continue;
      }

      try {
        const messages = await channel
          .messages.fetch({ limit: Math.min(setting.lines + 5, 100) })
          .catch(() => null);

        if (!messages || messages.size === 0) {
          await db.updateAutopurgeLastPurge(guild.id, setting.channel_id);
          continue;
        }

        let messagesToDelete = [];

        for (const msg of messages.values()) {
          if (messagesToDelete.length >= setting.lines) break;

          const isBot = msg.author.bot;
          const isUser = !msg.author.bot;

          let shouldDelete = false;
          if (setting.type === "bot" && isBot) shouldDelete = true;
          if (setting.type === "user" && isUser) shouldDelete = true;
          if (setting.type === "both") shouldDelete = true;

          if (msg.pinned) shouldDelete = false;

          const messageAge = now - msg.createdTimestamp;
          if (messageAge > 14 * 24 * 60 * 60 * 1000) shouldDelete = false;

          if (shouldDelete) {
            messagesToDelete.push(msg);
          }
        }

        if (messagesToDelete.length > 0) {
          await channel.bulkDelete(messagesToDelete, true).catch((err) => {
            console.warn(
              `[AUTOPURGE] Failed to bulk delete ${messagesToDelete.length} messages from ${channel.name}: ${err.message}`
            );
          });

          console.log(
            `[AUTOPURGE] Purged ${messagesToDelete.length} ${setting.type} message(s) from ${channel.name}`
          );
        }

        await db.updateAutopurgeLastPurge(guild.id, setting.channel_id);
      } catch (err) {
        console.error(`[AUTOPURGE] Error processing channel ${setting.channel_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("executeAutopurges error:", err);
  }
}

module.exports = { executeScheduledRolestatus, executeAutopurges };
