// discord/handlers/pausetime.js — /timer pause command handler
const { EmbedBuilder } = require("discord.js");
const db = require("../../db");
const { canManageRole } = require("../../utils/permissions");
const { BOOSTMON_ICON_URL, formatMs, parseDuration } = require("../../utils/helpers");

module.exports = async function handlePausetime(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const guild = interaction.guild;
  const subcommand = interaction.options.getSubcommand(); // "global", "user", or "credit"

  // ── PAUSE CREDIT MANAGEMENT (Admin only - checked in timer.js) ──
  if (subcommand === "credit") {
    const targetUser = interaction.options.getUser("user", true);
    const action = interaction.options.getString("action", true); // "add" or "remove"
    const amount = interaction.options.getInteger("amount", true);

    let newBalance;
    if (action === "add") {
      newBalance = await db.addPauseCredits(targetUser.id, guild.id, amount);
    } else {
      newBalance = await db.removePauseCredits(targetUser.id, guild.id, amount);
    }

    if (newBalance === null) {
      return interaction.editReply({
        content: `❌ Failed to ${action} pause credits for ${targetUser}.`
      });
    }

    const actionText = action === "add" ? "Added" : "Removed";
    const embed = new EmbedBuilder()
      .setColor(action === "add" ? 0x2ECC71 : 0xE74C3C)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`💳 Pause Credits ${actionText}`)
      .setTimestamp(new Date())
      .addFields(
        { name: "Command Run By", value: `${interaction.user}`, inline: true },
        { name: "Target User", value: `${targetUser}`, inline: true },
        { name: "Action", value: `${action === "add" ? "➕ Added" : "➖ Removed"}`, inline: true },
        { name: "Amount", value: `**${amount}** minute(s)`, inline: true },
        { name: "New Balance", value: `**${newBalance}** minute(s)`, inline: true }
      )
      .setFooter({ text: "BoostMon • Pause Credit Management" });

    return interaction.editReply({ embeds: [embed] });
  }

  // Parse duration for global and user pause
  const durationInput = interaction.options.getString("duration", true);
  const durationMinutes = parseDuration(durationInput);
  
  if (durationMinutes === null) {
    return interaction.editReply({
      content: `❌ Invalid duration format: **${durationInput}**\n\nValid formats:\n• \`1440\` (minutes)\n• \`1d\`, \`24h\`, \`1440m\` (with units)\n• \`1d 12h\` (combined)\n\nRange: 1 minute to 1440 minutes (24 hours)`
    });
  }

  const roleOption = interaction.options.getRole("role", false); // optional

  // ── GLOBAL PAUSE (pause all or all with a specific role) ──
  if (subcommand === "global") {
    // Check if user is admin or owner (checked in timer.js, but adding defensive check)
    if (!interaction.memberPermissions?.has("Administrator") && guild.ownerId !== interaction.user.id) {
      return interaction.editReply({
        content: "❌ Only administrators and server owner can pause timers globally.",
      });
    }

    // Fetch all timers in guild
    const allTimers = await db.getGuildTimers(guild.id);

    if (allTimers.length === 0) {
      return interaction.editReply({ content: "There are no active timers in this server." });
    }

    let filteredTimers = allTimers;
    if (roleOption) {
      filteredTimers = allTimers.filter(t => t.role_id === roleOption.id);
      if (filteredTimers.length === 0) {
        return interaction.editReply({
          content: `No active timers found for **${roleOption.name}**.`,
        });
      }
    }

    // Pause all filtered timers with "global" type
    const pauseCount = filteredTimers.length;
    for (const timer of filteredTimers) {
      await db.pauseTimerWithType(timer.user_id, timer.role_id, "global", durationMinutes);
    }

    const roleInfo = roleOption ? ` for **${roleOption.name}**` : "";
    const durationInfo = ` for ${durationMinutes} minute(s)`;

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F) // yellow = paused
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("🌍 Global Pause Applied")
      .setTimestamp(new Date())
      .addFields(
        { name: "Command Run By", value: `${interaction.user}`, inline: true },
        { name: "Type", value: "Global Pause", inline: true },
        { name: "Timers Paused", value: `**${pauseCount}** timer(s)${roleInfo}`, inline: false },
        { name: "Duration", value: `**${durationInfo}**`, inline: false }
      )
            .setFooter({ text: "BoostMon • Paused Globally" });

    return interaction.editReply({ embeds: [embed] });
  }

  // ── USER PAUSE (pause specific user's timer(s)) ──
  if (subcommand === "user") {
    const targetUser = interaction.options.getUser("member", true); // required
    const issuerId = interaction.user.id; // Person running the command
    const removeOverride = interaction.options.getBoolean("remove", false); // admin-only option

    // Check if removeOverride is being used and restrict to admin/owner
    if (removeOverride) {
      const isAdmin = interaction.memberPermissions?.has("Administrator") || guild.ownerId === issuerId;
      if (!isAdmin) {
        return interaction.editReply({
          content: "❌ Only administrators and server owner can use the **remove** option to bypass pause credits."
        });
      }
    } else {
      // Normal flow: Check if issuer has enough pause credits
      const issuerCredits = await db.getPauseCredits(issuerId, guild.id);
      if (issuerCredits < durationMinutes) {
        return interaction.editReply({
          content: `❌ You don't have enough pause credits. You have **${issuerCredits}** minute(s) but need **${durationMinutes}** minute(s).`
        });
      }
    }

    let member;
    try {
      member = await guild.members.fetch(targetUser.id);
    } catch {
      return interaction.editReply({
        content: `Could not fetch ${targetUser} from this server.`,
      });
    }

    // Get timers for this user
    const timers = await db.getTimersForUser(targetUser.id);
    const timedRoleIds = timers.map(t => t.role_id);

    if (timedRoleIds.length === 0) {
      return interaction.editReply({ content: `${targetUser} has no active timed roles.` });
    }

    let roleIdToPause = null;

    if (roleOption) {
      roleIdToPause = roleOption.id;
      if (!timedRoleIds.includes(roleIdToPause)) {
        return interaction.editReply({
          content: `${targetUser} has no saved time for **${roleOption.name}**.`,
        });
      }
    } else {
      // Auto-select: prefer a role the member currently has, else first in list
      const matching = timedRoleIds.find((rid) => member.roles.cache.has(rid));
      roleIdToPause = matching || timedRoleIds[0];
    }

    const roleObj = guild.roles.cache.get(roleIdToPause);
    const roleName = roleObj?.name || "that role";

    if (!roleObj) {
      return interaction.editReply({
        content: `That role no longer exists in this server, but a timer is stored for it. Use /timer clear to remove the stored timer.`,
      });
    }

    const permCheck = await canManageRole(guild, roleObj);
    if (!permCheck.ok) {
      return interaction.editReply({ content: permCheck.reason });
    }

    // Handle remove override (admin only)
    if (removeOverride) {
      // Admin removing/changing pause
      const resumeResult = await db.resumeTimer(targetUser.id, roleIdToPause);
      if (!resumeResult) {
        return interaction.editReply({
          content: `Failed to remove pause for ${targetUser}'s **${roleName}** timer.`
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498DB) // blue = admin action
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("🔧 Pause Removed (Admin Override)")
        .setTimestamp(new Date())
        .addFields(
          { name: "Removed By", value: `${interaction.user}`, inline: true },
          { name: "Target User", value: `${targetUser}`, inline: true },
          { name: "Role", value: `${roleObj}`, inline: true },
          { name: "Action", value: `Pause forcefully removed by admin`, inline: false }
        )
        .setFooter({ text: "BoostMon • Admin Override" });

      return interaction.editReply({ embeds: [embed] });
    }

    // Normal pause with "user" type and get the pause result with remaining time
    const pauseResult = await db.pauseTimerWithType(targetUser.id, roleIdToPause, "user", durationMinutes);
    
    if (!pauseResult) {
      return interaction.editReply({
        content: `Failed to pause ${targetUser}'s timer for **${roleName}**. The timer may already be paused.`,
      });
    }

    // Deduct credits from issuer
    const issuerNewBalance = await db.removePauseCredits(issuerId, guild.id, durationMinutes);
    if (issuerNewBalance === null) {
      // Rollback the pause if credit deduction fails
      await db.resumeTimer(targetUser.id, roleIdToPause);
      return interaction.editReply({
        content: `Failed to deduct pause credits. Pause reverted.`
      });
    }

    // Frozen timer time (what's being paused)
    const frozenTimerMs = Number(pauseResult.timerRemainingMs || 0);
    // Total remaining pause countdown (from database)
    const totalPauseDurationMs = Math.max(0, Number(pauseResult.pauseExpiresAt || 0) - Date.now());

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F) // yellow = paused
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("⏸️ Timed Role Paused with Pause Credits")
      .setTimestamp(new Date())
      .addFields(
        { name: "Paused By", value: `${interaction.user}`, inline: true },
        { name: "Target User", value: `${targetUser}`, inline: true },
        { name: "Role", value: `${roleObj}`, inline: true },
        { name: "Credits Used", value: `**${durationMinutes}** minute(s)`, inline: true },
        { name: "Issuer's Remaining Credits", value: `**${issuerNewBalance}** minute(s)`, inline: true },
        { name: "Time Paused At", value: `<t:${Math.floor(Date.now() / 1000)}:t>`, inline: true },
        { name: "Pause Duration", value: `**${formatMs(totalPauseDurationMs)}**`, inline: true },
        { name: "Frozen Timer", value: `**${formatMs(frozenTimerMs)}**`, inline: true }
      )
      .setFooter({ text: "BoostMon • Paused with Credits" });

    return interaction.editReply({ embeds: [embed] });
  }

  return interaction.editReply({ content: `Unknown pause subcommand: ${subcommand}` });
};
