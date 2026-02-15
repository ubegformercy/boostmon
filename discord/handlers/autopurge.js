// discord/handlers/autopurge.js — /autopurge command handler
const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");

module.exports = async function handleAutopurge(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  if (subcommand === "set") {
    const channel = interaction.options.getChannel("channel", true);
    const type = interaction.options.getString("type", true);
    const lines = interaction.options.getInteger("lines", true);
    const interval = interaction.options.getInteger("interval", true);

    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
      return interaction.editReply({ content: "Channel must be a text or announcement channel." });
    }

    const me = await guild.members.fetchMe();
    const perms = channel.permissionsFor(me);

    if (!perms?.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.editReply({
        content: `I don't have **Manage Messages** permission in ${channel}. I need this to delete messages.`,
      });
    }

    const intervalSeconds = interval * 60;
    const setting = await db.setAutopurgeSetting(guild.id, channel.id, type, lines, intervalSeconds);

    if (!setting) {
      return interaction.editReply({ content: "Failed to save autopurge setting. Try again later." });
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("✅ Auto-Purge Enabled")
      .setTimestamp(new Date())
      .addFields(
        { name: "Channel", value: `${channel}`, inline: true },
        { name: "Message Type", value: `${type === "bot" ? "🤖 Bot Only" : type === "user" ? "👤 User Only" : "🔀 Both"}`, inline: true },
        { name: "Lines per Purge", value: `${lines}`, inline: true },
        { name: "Interval", value: `${interval} minute(s)`, inline: true },
        { name: "Next Purge", value: `In ~${interval} minute(s)`, inline: true }
      )
      .setFooter({ text: "BoostMon • Auto-Purge Active" });

    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === "disable") {
    const channel = interaction.options.getChannel("channel", true);

    const setting = await db.getAutopurgeSetting(guild.id, channel.id);
    if (!setting) {
      return interaction.editReply({
        content: `No auto-purge setting found for ${channel}.`,
      });
    }

    const disabled = await db.disableAutopurgeSetting(guild.id, channel.id);
    if (!disabled) {
      return interaction.editReply({ content: "Failed to disable auto-purge. Try again later." });
    }

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("❌ Auto-Purge Disabled")
      .setTimestamp(new Date())
      .addFields({ name: "Channel", value: `${channel}`, inline: true })
      .setFooter({ text: "BoostMon • Auto-Purge Disabled" });

    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === "status") {
    const settings = await db.getAllAutopurgeSettings(guild.id).catch(() => []);

    if (settings.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("Auto-Purge Status")
        .setTimestamp(new Date())
        .addFields({ name: "Settings", value: "No active auto-purge settings in this server", inline: false })
        .setFooter({ text: "BoostMon" });
      return interaction.editReply({ embeds: [embed] });
    }

    const fields = [];
    for (const setting of settings) {
      const ch = guild.channels.cache.get(setting.channel_id);
      const channelName = ch ? ch.toString() : `<#${setting.channel_id}>`;
      const typeEmoji = setting.type === "bot" ? "🤖" : setting.type === "user" ? "👤" : "🔀";
      const intervalMins = Math.floor(setting.interval_seconds / 60);
      const lastPurge = setting.last_purge_at
        ? `<t:${Math.floor(new Date(setting.last_purge_at).getTime() / 1000)}:R>`
        : "Never";

      fields.push({
        name: `${typeEmoji} ${channelName}`,
        value: `**Lines:** ${setting.lines} | **Interval:** ${intervalMins}m | **Last Purge:** ${lastPurge}`,
        inline: false,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("Auto-Purge Status")
      .setTimestamp(new Date())
      .addFields(...fields)
      .addFields({ name: "━━━━━━━━━━━━━━━", value: `Total: ${settings.length}`, inline: false })
      .setFooter({ text: "BoostMon • Active Settings" });

    return interaction.editReply({ embeds: [embed] });
  }
};
