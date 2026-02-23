// discord/handlers/cleartime.js — /cleartime command handler
const db = require("../../db");
const { canManageRole } = require("../../utils/permissions");

module.exports = async function handleCleartime(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const targetUser = interaction.options.getUser("user", true);
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

  const timers = await db.getTimersForUser(targetUser.id);
  const timedRoleIds = timers.map(t => t.role_id);

  if (timedRoleIds.length === 0) {
    return interaction.editReply({ content: `${targetUser} has no active timed roles.` });
  }

  // Pick role to clear
  let roleIdToClear = null;

  if (roleOption) {
    roleIdToClear = roleOption.id;
    if (!timedRoleIds.includes(roleIdToClear)) {
      return interaction.editReply({
        content: `${targetUser} has no saved time for **${roleOption.name}**.`,
      });
    }
  } else {
    // "first found role" behavior: prefer one they currently have, else first stored
    const matching = timedRoleIds.find((rid) => member.roles.cache.has(rid));
    roleIdToClear = matching || timedRoleIds[0];
  }

  const roleObj = guild.roles.cache.get(roleIdToClear);
  if (!roleObj) {
    // Role deleted, but timer exists. Clear timer anyway.
    await db.clearRoleTimer(targetUser.id, roleIdToClear);
    return interaction.editReply({
      content: `Cleared saved time for ${targetUser}. (Role no longer exists in this server.)`,
    });
  }

  const permCheck = await canManageRole(guild, roleObj);
  if (!permCheck.ok) {
    return interaction.editReply({ content: permCheck.reason });
  }

  await db.clearRoleTimer(targetUser.id, roleIdToClear);

  if (member.roles.cache.has(roleIdToClear)) {
    await member.roles.remove(roleIdToClear);
  }

  return interaction.editReply({
    content: `Cleared saved time for ${targetUser} on **${roleObj.name}** and removed the role.`,
  });
};
