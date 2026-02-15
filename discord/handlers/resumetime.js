// discord/handlers/resumetime.js — /resumetime command handler
const { EmbedBuilder } = require("discord.js");
const db = require("../../db");
const { canManageRole } = require("../../utils/permissions");
const { BOOSTMON_ICON_URL, formatMs } = require("../../utils/helpers");

module.exports = async function handleResumetime(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const targetUser = interaction.options.getUser("user", true);
  const roleOption = interaction.options.getRole("role", true); // REQUIRED

  const guild = interaction.guild;
  const member = await guild.members.fetch(targetUser.id);

  const timers = await db.getTimersForUser(targetUser.id);
  const timedRoleIds = timers.map(t => t.role_id);

  if (timedRoleIds.length === 0) {
    return interaction.editReply({ content: `${targetUser} has no active timed roles.` });
  }

  const roleIdToResume = roleOption.id;

  if (!timedRoleIds.includes(roleIdToResume)) {
    return interaction.editReply({
      content: `${targetUser} has no saved time for **${roleOption.name}**.`,
    });
  }

  const roleObj = guild.roles.cache.get(roleIdToResume);
  const roleName = roleObj?.name || "that role";

  const entry = await db.getTimerForRole(targetUser.id, roleIdToResume);

  if (!entry?.paused) {
    return interaction.editReply({
      content: `${targetUser}'s timer for **${roleName}** is not paused.`,
    });
  }

  if (!roleObj) {
    await db.clearRoleTimer(targetUser.id, roleIdToResume);
    return interaction.editReply({
      content: `That role no longer exists in this server, so I cleared the saved timer for ${targetUser}.`,
    });
  }

  const permCheck = await canManageRole(guild, roleObj);
  if (!permCheck.ok) {
    return interaction.editReply({ content: permCheck.reason });
  }

  const remainingMs = Math.max(0, Number(entry.paused_remaining_ms || 0));

  if (remainingMs <= 0) {
    await db.clearRoleTimer(targetUser.id, roleIdToResume);
    if (member.roles.cache.has(roleIdToResume)) {
      await member.roles.remove(roleIdToResume).catch(() => null);
    }
    return interaction.editReply({
      content: `No time remained to resume for ${targetUser} on **${roleName}**. Timer cleared and role removed.`,
    });
  }

  // Resume properly
  const newExpiresAt = await db.resumeTimer(targetUser.id, roleIdToResume);

  // Ensure role is on the member
  if (!member.roles.cache.has(roleIdToResume)) {
    await member.roles.add(roleIdToResume).catch(() => null);
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71) // green = active
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("Timed Role Resumed")
    .setTimestamp(new Date())
    .addFields(
      { name: "Command Run By", value: `${interaction.user}`, inline: true },
      { name: "Time Run", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      { name: "Target User", value: `${targetUser}`, inline: true },
      { name: "Role", value: `${roleObj}`, inline: true },
      { name: "Remaining", value: `**${formatMs(remainingMs)}**`, inline: true },
      {
        name: "New Expiry",
        value: `<t:${Math.floor(newExpiresAt / 1000)}:F>\n(<t:${Math.floor(newExpiresAt / 1000)}:R>)`,
        inline: true,
      }
    )
    .setFooter({ text: "BoostMon • Active Timer" });

  return interaction.editReply({ embeds: [embed] });
};
