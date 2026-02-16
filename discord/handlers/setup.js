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

    if (!role) {
      // Clear the queue role
      await db.setQueueRole(guild.id, null);
      return interaction.editReply({ content: "✅ Queue role has been **cleared**. Users will no longer receive a role when added to the queue." });
    }

    // Check if the bot can manage this role
    const botMember = await guild.members.fetch(interaction.client.user.id).catch(() => null);
    if (botMember && botMember.roles.highest.position <= role.position) {
      return interaction.editReply({
        content: `⛔ I cannot assign the role ${role} because it is higher than or equal to my highest role. Please move my role above it in Server Settings → Roles.`
      });
    }

    await db.setQueueRole(guild.id, role.id);

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("✅ Queue Role Configured")
      .setTimestamp(new Date())
      .addFields(
        { name: "Role", value: `${role}`, inline: true },
        { name: "Effect", value: "Users will be assigned this role when added to the boost queue, and it will be removed when they leave.", inline: false }
      )
      .setFooter({ text: "BoostMon • Setup" });

    return interaction.editReply({ embeds: [embed] });
  }
};
