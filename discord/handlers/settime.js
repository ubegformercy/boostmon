// discord/handlers/settime.js — /settime command handler
const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const db = require("../../db");
const { canManageRole } = require("../../utils/permissions");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");
const { setMinutesForRole } = require("../../services/timer");

module.exports = async function handleSettime(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const targetUser = interaction.options.getUser("user", true);
  const minutes = interaction.options.getInteger("minutes", true);
  const targetRole = interaction.options.getRole("role", true);
  const channelOpt = interaction.options.getChannel("channel"); // optional

  const guild = interaction.guild;

  // Check if timer roles are configured for this guild
  const hasAllowedRoles = await db.hasTimerAllowedRoles(guild.id);
  if (!hasAllowedRoles) {
    return interaction.editReply({
      content: "❌ No timer roles configured. Admin must use `/setup timer-roles` to add roles."
    });
  }

  // Check if the provided role is in the allowed list
  const allowedRoles = await db.getTimerAllowedRoles(guild.id);
  const isRoleAllowed = allowedRoles.some(ar => ar.role_id === targetRole.id);
  if (!isRoleAllowed) {
    return interaction.editReply({
      content: `❌ The role **${targetRole.name}** is not configured for timer use. Admin must add it via \`/setup timer-roles\`.`
    });
  }

  const role = guild.roles.cache.get(targetRole.id);
  if (!role) {
    return interaction.editReply({ content: "I couldn't find that role in this server." });
  }

  const permCheck = await canManageRole(guild, role);
  if (!permCheck.ok) {
    return interaction.editReply({ content: permCheck.reason });
  }

  // Validate channel if provided (and whether bot can send there)
  let warnChannelId = null;
  let warnModeText = "No channel selected. Automatic expiry warnings will be DMed to the user.";

  if (channelOpt) {
    const channel = await guild.channels.fetch(channelOpt.id).catch(() => null);

    if (
      channel &&
      (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
    ) {
      const me = await guild.members.fetchMe();
      const perms = channel.permissionsFor(me);

      const canView = perms?.has(PermissionFlagsBits.ViewChannel);
      const canSend = perms?.has(PermissionFlagsBits.SendMessages);

      if (canView && canSend) {
        warnChannelId = channel.id;
        warnModeText = `Expiry warnings will be posted in ${channel}.`;
      } else {
        warnModeText =
          `I can't post warnings in ${channel} (missing View Channel or Send Messages). ` +
          `Warnings will be DMed to the user instead.`;
      }
    } else {
      warnModeText = "That channel isn't a text/announcement channel. Warnings will be DMed to the user.";
    }
  }

  const member = await guild.members.fetch(targetUser.id);

  const expiresAt = await setMinutesForRole(targetUser.id, role.id, minutes, warnChannelId, guild.id);
  await member.roles.add(role.id);

  // Reset streak and start new one on settime
  await db.upsertUserStreak(guild.id, targetUser.id, {
    streak_start_at: new Date(),
    degradation_started_at: null,
    grace_period_until: null
  });

  // Remove from boost queue if they were in it
  const wasInQueue = await db.getQueueUser(targetUser.id, guild.id);
  if (wasInQueue) {
    await db.removeFromQueue(targetUser.id, guild.id);
    // Remove queue role if configured
    const queueRoleId = await db.getQueueRole(guild.id);
    if (queueRoleId) {
      await member.roles.remove(queueRoleId).catch(err =>
        console.warn(`Failed to remove queue role ${queueRoleId} from ${targetUser.id}:`, err.message)
      );
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71) // active timer
    .setTitle("Timed Role Activated")
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTimestamp(new Date())
    .addFields(
      { name: "Command Run By", value: `${interaction.user}`, inline: true },
      { name: "Time Run", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      { name: "Target User", value: `${targetUser}`, inline: true },
      { name: "Role Assigned", value: `${role}`, inline: true },
      { name: "Duration", value: `${minutes} minute(s)`, inline: true },
      {
        name: "Expires",
        value: `<t:${Math.floor(expiresAt / 1000)}:F>\n(<t:${Math.floor(expiresAt / 1000)}:R>)`,
        inline: true,
      },
      {
        name: "Warning Channel",
        value: warnChannelId ? `<#${warnChannelId}>` : "DMs",
        inline: true,
      },
      { name: "Notes", value: warnModeText, inline: false }
    )
    .setFooter({ text: "BoostMon • Active Timer", iconURL: BOOSTMON_ICON_URL });

  return interaction.editReply({ embeds: [embed] });
};
