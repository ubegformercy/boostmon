// services/commandViews.js — Shared command view/business logic for selected commands
const { EmbedBuilder } = require("discord.js");
const db = require("../db");
const { BOOSTMON_ICON_URL } = require("../utils/helpers");

async function buildTimerShowRolePayload({ guild, roleOption, buildTimersLeaderboardForUsers }) {
  const hasAllowedRoles = await db.hasTimerAllowedRoles(guild.id);
  if (hasAllowedRoles) {
    const allowedRoles = await db.getTimerAllowedRoles(guild.id);
    const isRoleAllowed = allowedRoles.some((allowedRole) => allowedRole.role_id === roleOption.id);
    if (!isRoleAllowed) {
      return {
        content: `❌ The role **${roleOption.name}** is not configured for timer use. Admin must add it via \`/setup timer-roles\`.`,
      };
    }
  }

  const timersFromDbRaw = await db.getTimersForRole(roleOption.id).catch(() => []);
  const timersFromDb = Array.isArray(timersFromDbRaw) ? timersFromDbRaw : [];

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

    return { embeds: [embed] };
  }

  const leaderboard = await buildTimersLeaderboardForUsers(guild, timersFromDb, {
    title: `【⭐】${roleOption.name} Leaderboard【⭐】`,
    maxEntries: 30,
  });

  if (leaderboard.status === "empty_no_members") {
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

    return { embeds: [embed] };
  }

  return { embeds: [leaderboard.embed] };
}

async function buildBoostServerLeadersPayload({ guild, server, buildTimersLeaderboardForUsers }) {
  await guild.members.fetch().catch(() => null);

  const roleIds = [server.role_owner_id, server.role_mod_id, server.role_member_id].filter(Boolean);
  const boostServerUserIds = new Set();

  for (const member of guild.members.cache.values()) {
    if (roleIds.some((roleId) => member.roles?.cache?.has(roleId))) {
      boostServerUserIds.add(member.user.id);
    }
  }

  if (boostServerUserIds.size === 0) {
    return {
      content: "No active timers for this boost server.",
      embeds: [],
    };
  }

  const allGuildTimersRaw = await db.getAllGuildTimers(guild.id);
  const allGuildTimers = Array.isArray(allGuildTimersRaw) ? allGuildTimersRaw : [];
  const timersForBoostServer = allGuildTimers.filter((timer) => boostServerUserIds.has(timer.user_id));

  if (timersForBoostServer.length === 0) {
    return {
      content: "No active timers for this boost server.",
      embeds: [],
    };
  }

  const leaderboard = await buildTimersLeaderboardForUsers(guild, timersForBoostServer, {
    title: `【⭐】${server.display_name} Leaders【⭐】`,
    maxEntries: 25,
  });

  if (leaderboard.status !== "ok") {
    return {
      content: "No active timers for this boost server.",
      embeds: [],
    };
  }

  return {
    content: null,
    embeds: [leaderboard.embed],
  };
}

module.exports = {
  buildTimerShowRolePayload,
  buildBoostServerLeadersPayload,
};
