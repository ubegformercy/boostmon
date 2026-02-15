// discord/handlers/pausetime.js — /pausetime command handler
const { EmbedBuilder } = require("discord.js");
const db = require("../../db");
const { canManageRole } = require("../../utils/permissions");
const { BOOSTMON_ICON_URL, formatMs } = require("../../utils/helpers");

module.exports = async function handlePausetime(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const targetUser = interaction.options.getUser("user", true);
  const roleOption = interaction.options.getRole("role"); // optional

  const guild = interaction.guild;
  const member = await guild.members.fetch(targetUser.id);

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
    const matching = timedRoleIds.find((rid) => member.roles.cache.has(rid));
    roleIdToPause = matching || timedRoleIds[0];
  }

  const roleObj = guild.roles.cache.get(roleIdToPause);
  const roleName = roleObj?.name || "that role";

  if (!roleObj) {
    return interaction.editReply({
      content: `That role no longer exists in this server, but a timer is stored for it. Use /cleartime to remove the stored timer.`,
    });
  }

  const permCheck = await canManageRole(guild, roleObj);
  if (!permCheck.ok) {
    return interaction.editReply({ content: permCheck.reason });
  }

  const entry = await db.getTimerForRole(targetUser.id, roleIdToPause);

  if (entry?.paused) {
    return interaction.editReply({
      content: `${targetUser}'s timer for **${roleName}** is already paused.`,
    });
  }

  const remainingMs = await db.pauseTimer(targetUser.id, roleIdToPause);

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F) // yellow = paused
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("Timed Role Paused")
    .setTimestamp(new Date())
    .addFields(
      { name: "Command Run By", value: `${interaction.user}`, inline: true },
      { name: "Time Run", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      { name: "Target User", value: `${targetUser}`, inline: true },
      { name: "Role", value: `${roleObj}`, inline: true },
      { name: "Remaining", value: `**${formatMs(remainingMs)}**`, inline: true }
    )
    .setFooter({ text: "BoostMon • Paused Timer" });

  return interaction.editReply({ embeds: [embed] });
};
