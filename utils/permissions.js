// utils/permissions.js — Permission check helpers
const { PermissionFlagsBits } = require("discord.js");

async function canManageRole(guild, role) {
  const me = await guild.members.fetchMe();

  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { ok: false, reason: "I don't have Manage Roles permission." };
  }

  if (me.roles.highest.position <= role.position) {
    return {
      ok: false,
      reason: `I can't manage **${role.name}** because my highest role is not above it. Move my bot role higher than **${role.name}**.`,
    };
  }

  return { ok: true, me };
}

module.exports = { canManageRole };
