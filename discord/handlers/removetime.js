// discord/handlers/removetime.js — /removetime command handler
const { EmbedBuilder } = require("discord.js");
const db = require("../../db");
const { canManageRole } = require("../../utils/permissions");
const { BOOSTMON_ICON_URL, formatMs } = require("../../utils/helpers");
const { removeMinutesForRole } = require("../../services/timer");

module.exports = async function handleRemovetime(interaction) {
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

  if (timedRoleIds.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x95A5A6) // grey
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("No Active Timed Roles")
      .setTimestamp(new Date())
      .addFields({ name: "Target User", value: `${targetUser}`, inline: true })
      .setFooter({ text: "BoostMon" });

    return interaction.editReply({ embeds: [embed] });
  }

  // Decide which role to edit
  let roleIdToEdit = null;

  if (roleOption) {
    roleIdToEdit = roleOption.id;

    if (!timedRoleIds.includes(roleIdToEdit)) {
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F) // yellow
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("No Saved Time For That Role")
        .setTimestamp(new Date())
        .addFields(
          { name: "Target User", value: `${targetUser}`, inline: true },
          { name: "Role", value: `${roleOption}`, inline: true }
        )
        .setFooter({ text: "BoostMon" });

      return interaction.editReply({ embeds: [embed] });
    }
  } else {
    const matching = timedRoleIds.filter((rid) => member.roles.cache.has(rid));

    if (matching.length === 1) {
      roleIdToEdit = matching[0];
    } else if (matching.length === 0) {
      if (timedRoleIds.length === 1) {
        roleIdToEdit = timedRoleIds[0];
      } else {
        const possible = timedRoleIds
          .map((rid) => guild.roles.cache.get(rid)?.name || rid)
          .slice(0, 15)
          .join(", ");

        const embed = new EmbedBuilder()
          .setColor(0xF1C40F) // yellow
          .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
          .setTitle("Please Specify a Role")
          .setTimestamp(new Date())
          .addFields(
            { name: "Target User", value: `${targetUser}`, inline: true },
            { name: "Time To Remove", value: `${minutes} minute(s)`, inline: true },
            { name: "Reason", value: "Multiple timed roles are stored but none clearly matches current roles.", inline: false },
            { name: "Possible Stored Roles", value: possible || "None", inline: false }
          )
          .setFooter({ text: "BoostMon • Select a Role" });

        return interaction.editReply({ embeds: [embed] });
      }
    } else {
      const possible = matching
        .map((rid) => guild.roles.cache.get(rid)?.name || rid)
        .slice(0, 15)
        .join(", ");

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F) // yellow
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("Please Specify a Role")
        .setTimestamp(new Date())
        .addFields(
          { name: "Target User", value: `${targetUser}`, inline: true },
          { name: "Time To Remove", value: `${minutes} minute(s)`, inline: true },
          { name: "Reason", value: "User currently has multiple timed roles.", inline: false },
          { name: "Possible Roles", value: possible || "None", inline: false }
        )
        .setFooter({ text: "BoostMon • Select a Role" });

      return interaction.editReply({ embeds: [embed] });
    }
  }

  const roleObj = guild.roles.cache.get(roleIdToEdit);
  if (!roleObj) {
    const embed = new EmbedBuilder()
      .setColor(0xE67E22) // orange
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("Role No Longer Exists")
      .setTimestamp(new Date())
      .addFields(
        { name: "Target User", value: `${targetUser}`, inline: true },
        { name: "Stored Role ID", value: `${roleIdToEdit}`, inline: true },
        { name: "Note", value: "That role was deleted from this server. Use /cleartime to remove the stored timer.", inline: false }
      )
      .setFooter({ text: "BoostMon" });

    return interaction.editReply({ embeds: [embed] });
  }

  const permCheck = await canManageRole(guild, roleObj);
  if (!permCheck.ok) {
    return interaction.editReply({ content: permCheck.reason });
  }

  const result = await removeMinutesForRole(targetUser.id, roleIdToEdit, minutes);

  if (result === null) {
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F) // yellow
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("No Saved Time For That Role")
      .setTimestamp(new Date())
      .addFields(
        { name: "Target User", value: `${targetUser}`, inline: true },
        { name: "Role", value: `${roleObj}`, inline: true }
      )
      .setFooter({ text: "BoostMon" });

    return interaction.editReply({ embeds: [embed] });
  }

  // result is either 0 (expired) or an expiresAt timestamp (ms)
  if (result === 0) {
    if (member.roles.cache.has(roleIdToEdit)) {
      await member.roles.remove(roleIdToEdit).catch(() => null);
    }

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C) // red
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("Timed Role Reduced (Expired)")
      .setTimestamp(new Date())
      .addFields(
        { name: "Command Run By", value: `${interaction.user}`, inline: true },
        { name: "Time Run", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: "Target User", value: `${targetUser}`, inline: true },
        { name: "Role", value: `${roleObj}`, inline: true },
        { name: "Time Removed", value: `${minutes} minute(s)`, inline: true },
        { name: "Result", value: "Time expired — role removed.", inline: true }
      )
      .setFooter({ text: "BoostMon • Timer Ended" });

    return interaction.editReply({ embeds: [embed] });
  }

  const leftMs = Math.max(0, result - Date.now());

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71) // green
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("Timed Role Reduced")
    .setTimestamp(new Date())
    .addFields(
      { name: "Command Run By", value: `${interaction.user}`, inline: true },
      { name: "Time Run", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      { name: "Target User", value: `${targetUser}`, inline: true },
      { name: "Role", value: `${roleObj}`, inline: true },
      { name: "Time Removed", value: `${minutes} minute(s)`, inline: true },
      { name: "Remaining", value: `**${formatMs(leftMs)}**`, inline: true },
      {
        name: "Expires",
        value: `<t:${Math.floor(result / 1000)}:F>\n(<t:${Math.floor(result / 1000)}:R>)`,
        inline: false,
      }
    )
    .setFooter({ text: "BoostMon • Active Timer" });

  return interaction.editReply({ embeds: [embed] });
};
