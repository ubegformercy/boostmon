// services/notifications.js — Warning and expiration DM/channel notifications
const { EmbedBuilder } = require("discord.js");
const { BOOSTMON_ICON_URL } = require("../utils/helpers");

async function sendWarningOrDm(guild, userId, roleId, leftMin, warnChannelId) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(roleId);
    const roleDisplay = role ? role.name : `<@&${roleId}>`;

    const embed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("⏰ Timer Warning")
      .setDescription(`Your **${roleDisplay}** role expires in **${leftMin}** minute(s)!`)
      .setTimestamp(new Date())
      .setFooter({ text: "BoostMon • Timer Warning" });

    if (warnChannelId) {
      const channel = guild.channels.cache.get(warnChannelId);
      if (channel && channel.isTextBased()) {
        await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
      } else {
        await member.send({ embeds: [embed] }).catch(() => null);
      }
    } else {
      await member.send({ embeds: [embed] }).catch(() => null);
    }
  } catch (err) {
    console.error("sendWarningOrDm error:", err.message);
  }
}

async function sendExpiredNoticeOrDm(guild, userId, roleId, warnChannelId) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(roleId);
    const roleDisplay = role ? role.name : `<@&${roleId}>`;

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("❌ Timer Expired")
      .setDescription(`Your **${roleDisplay}** role has been removed due to timer expiration.`)
      .setTimestamp(new Date())
      .setFooter({ text: "BoostMon • Timer Expired" });

    if (warnChannelId) {
      const channel = guild.channels.cache.get(warnChannelId);
      if (channel && channel.isTextBased()) {
        await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
      } else {
        await member.send({ embeds: [embed] }).catch(() => null);
      }
    } else {
      await member.send({ embeds: [embed] }).catch(() => null);
    }
  } catch (err) {
    console.error("sendExpiredNoticeOrDm error:", err.message);
  }
}

module.exports = { sendWarningOrDm, sendExpiredNoticeOrDm };
