// discord/handlers/addtime.js — /addtime command handler
const { EmbedBuilder } = require("discord.js");
const db = require("../../db");
const { canManageRole } = require("../../utils/permissions");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");
const { addMinutesForRole } = require("../../services/timer");

module.exports = async function handleAddtime(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const targetUser = interaction.options.getUser("user", true);
  const minutes = interaction.options.getInteger("minutes", true);
  const roleInput = interaction.options.getString("role"); // optional

  const guild = interaction.guild;
  const member = await guild.members.fetch(targetUser.id);

  // Parse role from input if provided
  let roleOption = null;
  if (roleInput) {
    // Try to extract role ID from mention format <@&123456>
    const mentionMatch = roleInput.match(/^<@&(\d+)>$/);
    if (mentionMatch) {
      roleOption = guild.roles.cache.get(mentionMatch[1]);
    } else if (/^\d+$/.test(roleInput)) {
      // Try as direct ID
      roleOption = guild.roles.cache.get(roleInput);
    } else {
      // Try to find by name
      roleOption = guild.roles.cache.find(r => r.name === roleInput || r.id === roleInput);
    }

    if (!roleOption) {
      return interaction.editReply({
        content: `❌ I couldn't find a role named **${roleInput}**. Make sure the role exists.`
      });
    }
  }

  // Check if timer roles are configured for this guild
  const hasAllowedRoles = await db.hasTimerAllowedRoles(guild.id);
  if (!hasAllowedRoles) {
    return interaction.editReply({
      content: "❌ No timer roles configured. Admin must use `/setup timer-roles` to add roles."
    });
  }

  const timers = await db.getTimersForUser(targetUser.id);
  const timedRoleIds = timers.map(t => t.role_id);

  let roleIdToEdit = null;

  if (roleOption) {
    roleIdToEdit = roleOption.id;
    // Check if this role is allowed
    const allowedRoles = await db.getTimerAllowedRoles(guild.id);
    const isRoleAllowed = allowedRoles.some(ar => ar.role_id === roleOption.id);
    if (!isRoleAllowed) {
      return interaction.editReply({
        content: `❌ The role **${roleOption.name}** is not configured for timer use. Admin must add it via \`/setup timer-roles\`.`
      });
    }
  } else {
    if (timedRoleIds.length === 1) {
      roleIdToEdit = timedRoleIds[0];
    } else if (timedRoleIds.length === 0) {
      return interaction.editReply({
        content: `${targetUser} has no active timed roles. Use /settime with a role first.`,
      });
    } else {
      return interaction.editReply({
        content: `${targetUser} has multiple timed roles. Please specify the role.`,
      });
    }
  }

  const role = guild.roles.cache.get(roleIdToEdit);
  if (!role) {
    return interaction.editReply({ content: "That role no longer exists in this server." });
  }

  const permCheck = await canManageRole(guild, role);
  if (!permCheck.ok) {
    return interaction.editReply({ content: permCheck.reason });
  }

  const expiresAt = await addMinutesForRole(targetUser.id, role.id, minutes, guild.id);

  if (!member.roles.cache.has(role.id)) {
    await member.roles.add(role.id);
  }

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
    .setColor(0x2ECC71) // 🟢 active timer
    .setAuthor({
      name: "BoostMon",
      iconURL: BOOSTMON_ICON_URL,
    })
    .setTitle("Timed Role Extended")
    .setTimestamp(new Date())
    .addFields(
      { name: "Command Run By", value: `${interaction.user}`, inline: true },
      { name: "Time Run", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      { name: "Target User", value: `${targetUser}`, inline: true },
      { name: "Role", value: `${role}`, inline: true },
      { name: "Time Added", value: `${minutes} minute(s)`, inline: true },
      {
        name: "New Expiry",
        value: `<t:${Math.floor(expiresAt / 1000)}:F>\n(<t:${Math.floor(expiresAt / 1000)}:R>)`,
        inline: true,
      }
    )
    .setFooter({ text: "BoostMon • Active Timer" });

  return interaction.editReply({ embeds: [embed] });
};
