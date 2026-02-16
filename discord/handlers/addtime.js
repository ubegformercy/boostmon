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
  const roleOption = interaction.options.getRole("role"); // optional

  const guild = interaction.guild;
  const member = await guild.members.fetch(targetUser.id);

  const timers = await db.getTimersForUser(targetUser.id);
  const timedRoleIds = timers.map(t => t.role_id);

  let roleIdToEdit = null;

  if (roleOption) {
    roleIdToEdit = roleOption.id;
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
