// discord/handlers/boostserver.js — /setup boostserver subcommand group handler (stub)
const { PermissionFlagsBits } = require("discord.js");

// Stub: All boostserver subcommands respond with "not yet implemented"
// Permission: Admin OR boost server owner (to be enforced when logic is added)

const SUBCOMMAND_LABELS = {
  "create": "Create Boost Server",
  "info": "Boost Server Info",
  "owner-set": "Set Owner",
  "owner-view": "View Owner",
  "mods-add": "Add Moderator",
  "mods-remove": "Remove Moderator",
  "mods-list": "List Moderators",
  "link-set": "Set Link",
  "link-view": "View Link",
  "link-clear": "Clear Link",
  "status-set": "Set Status",
  "config-set": "Set Config",
  "archive": "Archive Server",
  "delete": "Delete Server",
};

module.exports = async function handleBoostServer(interaction) {
  const subcommand = interaction.options.getSubcommand();

  // Permission check: Admin or server owner
  // (Boost server owner check will be added when DB logic is implemented)
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) &&
    interaction.guild.ownerId !== interaction.user.id
  ) {
    return interaction.editReply({
      content: "⛔ Only **Server Owner** or users with **Administrator** permission can use this command.",
    });
  }

  const label = SUBCOMMAND_LABELS[subcommand] || subcommand;

  return interaction.editReply({
    content: `🚧 **${label}** — This command is registered but not yet implemented. Stay tuned!`,
  });
};
