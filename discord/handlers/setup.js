// discord/handlers/setup.js — /setup command handler (reports, streak-roles, streak-leaderboard-size)
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");

module.exports = async function handleSetup(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  // Only owner or admins can use this command
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) && interaction.guild.ownerId !== interaction.user.id) {
    return interaction.editReply({
      content: "⛔ Only **Server Owner** or users with **Administrator** permission can use this command.",
      ephemeral: true
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  if (subcommand === "reports") {
    const sortOrder = interaction.options.getString("filter", true);

    const result = await db.setReportSortOrder(guild.id, sortOrder);

    if (!result) {
      return interaction.editReply({
        content: `⚠️ No scheduled reports found for this server, or failed to update sorting.`
      });
    }

    const sortEmoji = sortOrder === 'ascending' ? '🔼' : '🔽';
    const sortDescription = sortOrder === 'ascending'
      ? 'Shortest boost times first (expiring soonest)'
      : 'Longest boost times first (top boosters at top)';

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`${sortEmoji} Leaderboard Sort Order Updated`)
      .setTimestamp(new Date())
      .addFields(
        { name: "Sort Order", value: `**${sortOrder.charAt(0).toUpperCase() + sortOrder.slice(1)}**`, inline: true },
        { name: "Display", value: sortDescription, inline: true },
        { name: "Effect", value: "All leaderboard reports will now display members in this order", inline: false }
      )
      .setFooter({ text: "BoostMon • Setup" });

    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === "streak-roles") {
    const days = interaction.options.getInteger("days", true);
    const streakRole = interaction.options.getRole("role", true);
    const action = interaction.options.getString("action") || "add";

    if (action === "remove") {
      const removed = await db.removeStreakRole(guild.id, days);
      return interaction.editReply({ content: removed ? `✅ Removed streak role for ${days} days.` : `❌ No streak role found for ${days} days.` });
    } else {
      await db.setStreakRole(guild.id, days, streakRole.id);
      return interaction.editReply({ content: `✅ Set streak role for ${days} days to ${streakRole}.` });
    }
  }

  if (subcommand === "streak-leaderboard-size") {
    const size = interaction.options.getInteger("size", true);
    await db.setStreakLeaderboardSize(guild.id, size);
    return interaction.editReply({ content: `✅ Streak leaderboard will now show **${size}** members.` });
  }

  if (subcommand === "queue-role") {
    const role = interaction.options.getRole("role");
    const channelOption = interaction.options.getChannel("channel");
    const intervalOption = interaction.options.getInteger("interval");

    if (!role && !channelOption && intervalOption === null) {
      // No options provided — show current settings
      const currentRole = await db.getQueueRole(guild.id);
      const notifySettings = await db.getQueueNotifySettings(guild.id);

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("📋 Queue Settings")
        .setTimestamp(new Date())
        .addFields(
          { name: "Queue Role", value: currentRole ? `<@&${currentRole}>` : "Not set", inline: true },
          { name: "Notification Channel", value: notifySettings?.queue_notify_channel_id ? `<#${notifySettings.queue_notify_channel_id}>` : "Not set", inline: true },
          { name: "Notification Interval", value: notifySettings?.queue_notify_interval_minutes > 0 ? `Every ${notifySettings.queue_notify_interval_minutes} minute(s)` : "Disabled", inline: true }
        )
        .setDescription("Use `/setup queue-role` with options to configure.\nPass `role` without a value to clear the queue role.\nSet `interval` to `0` to disable notifications.")
        .setFooter({ text: "BoostMon • Setup" });

      return interaction.editReply({ embeds: [embed] });
    }

    // Handle role setting/clearing
    if (role) {
      const botMember = await guild.members.fetch(interaction.client.user.id).catch(() => null);
      if (botMember && botMember.roles.highest.position <= role.position) {
        return interaction.editReply({
          content: `⛔ I cannot assign the role ${role} because it is higher than or equal to my highest role. Please move my role above it in Server Settings → Roles.`
        });
      }
      await db.setQueueRole(guild.id, role.id);
    }

    // Handle notification channel + interval
    if (channelOption || intervalOption !== null) {
      const notifyChannelId = channelOption?.id || null;
      const notifyInterval = intervalOption ?? 0;

      // If interval is 0, disable notifications
      if (notifyInterval === 0) {
        await db.setQueueNotifySettings(guild.id, null, 0);
      } else if (notifyChannelId) {
        // Validate bot can send to the channel
        const channel = await guild.channels.fetch(notifyChannelId).catch(() => null);
        if (!channel || (channel.type !== 0 && channel.type !== 5)) { // GuildText = 0, GuildAnnouncement = 5
          return interaction.editReply({ content: "⛔ Please select a text or announcement channel." });
        }
        const me = await guild.members.fetchMe();
        const perms = channel.permissionsFor(me);
        if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms?.has(PermissionFlagsBits.SendMessages)) {
          return interaction.editReply({ content: `⛔ I don't have permission to send messages in ${channel}.` });
        }
        await db.setQueueNotifySettings(guild.id, notifyChannelId, notifyInterval);
      } else {
        // Interval provided but no channel — keep existing channel
        const existing = await db.getQueueNotifySettings(guild.id);
        if (!existing?.queue_notify_channel_id) {
          return interaction.editReply({ content: "⛔ You must specify a `channel` when enabling notifications for the first time." });
        }
        await db.setQueueNotifySettings(guild.id, existing.queue_notify_channel_id, notifyInterval);
      }
    }

    // Build confirmation embed
    const currentRole = await db.getQueueRole(guild.id);
    const notifySettings = await db.getQueueNotifySettings(guild.id);

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("✅ Queue Settings Updated")
      .setTimestamp(new Date())
      .addFields(
        { name: "Queue Role", value: currentRole ? `<@&${currentRole}>` : "Not set", inline: true },
        { name: "Notification Channel", value: notifySettings?.queue_notify_channel_id ? `<#${notifySettings.queue_notify_channel_id}>` : "Not set", inline: true },
        { name: "Notification Interval", value: notifySettings?.queue_notify_interval_minutes > 0 ? `Every ${notifySettings.queue_notify_interval_minutes} minute(s)` : "Disabled", inline: true }
      )
      .setFooter({ text: "BoostMon • Setup" });

    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === "timer-roles") {
    // Get current allowed roles from database
    const currentRoles = await db.getTimerAllowedRoles(guild.id);
    
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
    
    const modal = new ModalBuilder()
      .setCustomId("timer_roles_modal")
      .setTitle("Configure Timer Roles");
    
    // Add up to 5 text inputs (one for each role, leave blank if no more roles needed)
    for (let i = 1; i <= 5; i++) {
      const currentRole = currentRoles[i - 1];
      const textInput = new TextInputBuilder()
        .setCustomId(`timer_role_${i}`)
        .setLabel(`Role #${i}`)
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("Leave blank to remove this slot")
        .setMaxLength(100);
      
      if (currentRole) {
        textInput.setValue(`${currentRole.role_name} (${currentRole.role_id})`);
      }
      
      const actionRow = new ActionRowBuilder().addComponents(textInput);
      modal.addComponents(actionRow);
    }
    
    return await interaction.showModal(modal);
  }
};
