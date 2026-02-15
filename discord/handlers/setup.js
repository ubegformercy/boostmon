// discord/handlers/setup.js — /setup command handler
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
  const role = interaction.options.getRole("role");

  if (subcommand === "grant") {
    if (!role) {
      return interaction.editReply({ content: "Please specify a role." });
    }

    const result = await db.grantDashboardAccess(guild.id, role.id, interaction.user.id);

    if (!result) {
      return interaction.editReply({
        content: `⚠️ Failed to grant access (role may already have access)`
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("✅ Dashboard Access Granted")
      .setTimestamp(new Date())
      .addFields(
        { name: "Role", value: `${role}`, inline: true },
        { name: "Granted By", value: `${interaction.user}`, inline: true },
        { name: "Status", value: "Members with this role can now access the dashboard", inline: false }
      )
      .setFooter({ text: "BoostMon • Setup" });

    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === "revoke") {
    if (!role) {
      return interaction.editReply({ content: "Please specify a role." });
    }

    const result = await db.revokeDashboardAccess(guild.id, role.id);

    if (!result) {
      return interaction.editReply({
        content: `⚠️ Failed to revoke access (role may not have dashboard access)`
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("❌ Dashboard Access Revoked")
      .setTimestamp(new Date())
      .addFields(
        { name: "Role", value: `${role}`, inline: true },
        { name: "Revoked By", value: `${interaction.user}`, inline: true },
        { name: "Status", value: "Members with this role can no longer access the dashboard", inline: false }
      )
      .setFooter({ text: "BoostMon • Setup" });

    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === "list") {
    const accessRoles = await db.getDashboardAccessRoles(guild.id);
    const restrictMode = await db.isRestrictModeActive(guild.id);

    if (accessRoles.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("Dashboard Access Roles")
        .setTimestamp(new Date())
        .addFields({
          name: "Mode",
          value: restrictMode ? "🔒 **RESTRICTED** - Only whitelisted roles have access" : "🔓 **NORMAL** - Owner + Admins + granted roles",
          inline: false
        })
        .addFields({
          name: "Status",
          value: "**Default Access:** Server Owner + Admins only\n**Custom Roles:** None configured",
          inline: false
        })
        .setFooter({ text: "BoostMon • Setup" });

      return interaction.editReply({ embeds: [embed] });
    }

    const fields = [];
    for (const access of accessRoles) {
      const grantRole = guild.roles.cache.get(access.role_id);
      const roleName = grantRole ? `${grantRole}` : `<@&${access.role_id}>`;
      const grantedBy = access.created_by ? `<@${access.created_by}>` : "Unknown";
      const createdAt = new Date(access.created_at).toLocaleString();

      fields.push({
        name: `${roleName}`,
        value: `Granted by ${grantedBy} on ${createdAt}`,
        inline: false
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("Dashboard Access Roles")
      .setTimestamp(new Date())
      .addFields({
        name: "Mode",
        value: restrictMode ? "🔒 **RESTRICTED** - Only whitelisted roles have access" : "🔓 **NORMAL** - Owner + Admins + granted roles",
        inline: false
      })
      .addFields({ name: "Default Access", value: "Server Owner (always have access)", inline: false })
      .addFields(...fields)
      .addFields({ name: "Total Whitelisted Roles", value: `${accessRoles.length}`, inline: false })
      .setFooter({ text: "BoostMon • Setup" });

    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === "restrict") {
    if (!role) {
      return interaction.editReply({ content: "Please specify a role to whitelist." });
    }

    const result = await db.setDashboardRestrictMode(guild.id, role.id, interaction.user.id);

    if (!result) {
      return interaction.editReply({
        content: `⚠️ Failed to enable restrict mode`
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("🔒 Restrict Mode Enabled")
      .setTimestamp(new Date())
      .addFields(
        { name: "Mode", value: "**RESTRICTED** - Only whitelisted roles have dashboard access", inline: false },
        { name: "Whitelisted Role", value: `${role}`, inline: true },
        { name: "Enabled By", value: `${interaction.user}`, inline: true },
        { name: "Note", value: "Server Owner always has access. All other users need a whitelisted role.", inline: false }
      )
      .setFooter({ text: "BoostMon • Setup" });

    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === "unrestrict") {
    const result = await db.removeDashboardRestrictMode(guild.id);

    if (!result) {
      return interaction.editReply({
        content: `⚠️ Failed to disable restrict mode`
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("🔓 Restrict Mode Disabled")
      .setTimestamp(new Date())
      .addFields(
        { name: "Mode", value: "**NORMAL** - Admins and granted roles have access", inline: false },
        { name: "Disabled By", value: `${interaction.user}`, inline: true },
        { name: "Note", value: "Server Owner + Admins automatically have access. Custom granted roles also have access.", inline: false }
      )
      .setFooter({ text: "BoostMon • Setup" });

    return interaction.editReply({ embeds: [embed] });
  }

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
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.editReply({ content: "⛔ Only administrators can use this command.", ephemeral: true });
    }

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
};
