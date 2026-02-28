// discord/handlers/boostserver.js — /setup boostserver subcommand group handler
const { PermissionFlagsBits, EmbedBuilder, ChannelType, PermissionsBitField } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");

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
  const guild = interaction.guild;

  // Permission check: Admin or guild owner
  // (Boost server owner check will be added for per-server commands later)
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) &&
    guild.ownerId !== interaction.user.id
  ) {
    return interaction.editReply({
      content: "⛔ Only **Server Owner** or users with **Administrator** permission can use this command.",
    });
  }

  // ── CREATE ──
  if (subcommand === "create") {
    return handleCreate(interaction, guild);
  }

  // All other subcommands — stub
  const label = SUBCOMMAND_LABELS[subcommand] || subcommand;
  return interaction.editReply({
    content: `🚧 **${label}** — This command is registered but not yet implemented. Stay tuned!`,
  });
};

async function handleCreate(interaction, guild) {
  const owner = interaction.options.getUser("owner", true);
  const customName = interaction.options.getString("name");
  const gameName = interaction.options.getString("game_name");
  const maxPlayers = interaction.options.getInteger("max_players") ?? 24;
  const boostRate = interaction.options.getNumber("boost_rate") ?? 1.5;
  const durationMinutes = interaction.options.getInteger("duration_minutes") ?? 60;

  // Get the next server number for this guild
  const serverNumber = await db.getNextBoostServerNumber(guild.id);
  const serverLabel = customName || `Server ${serverNumber}`;
  const serverSlug = `server-${serverNumber}`;

  try {
    // 1. Create category
    const category = await guild.channels.create({
      name: `BOOST SERVER ${serverNumber}`,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageRoles,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
      ],
    });

    // 2. Create roles
    const ownerRole = await guild.roles.create({
      name: `PS Owner • ${serverSlug}`,
      mentionable: false,
      reason: `Boost server ${serverNumber} setup`,
    });

    const modRole = await guild.roles.create({
      name: `PS Mod • ${serverSlug}`,
      mentionable: false,
      reason: `Boost server ${serverNumber} setup`,
    });

    const boosterRole = await guild.roles.create({
      name: `PS Booster • ${serverSlug}`,
      mentionable: false,
      reason: `Boost server ${serverNumber} setup`,
    });

    // Common channel permission overwrites
    const channelOverwrites = [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: interaction.client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageMessages,
        ],
      },
      {
        id: ownerRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageMessages,
        ],
      },
      {
        id: modRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
        ],
      },
      {
        id: boosterRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
        ],
      },
    ];

    // 3. Create channels under category
    const mainChannel = await guild.channels.create({
      name: `🔥 ${serverSlug}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
    });

    const proofsChannel = await guild.channels.create({
      name: `👀 ${serverSlug}-proofs`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
    });

    const chatChannel = await guild.channels.create({
      name: `💬 ${serverSlug}-chat`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
    });

    // 4. Assign owner role to the specified owner
    const ownerMember = await guild.members.fetch(owner.id).catch(() => null);
    if (ownerMember) {
      await ownerMember.roles.add(ownerRole, `Boost server ${serverNumber} owner`).catch((err) => {
        console.error(`[BOOSTSERVER] Failed to assign owner role: ${err.message}`);
      });
    }

    // 5. Store in database
    const serverRecord = await db.createBoostServer({
      guild_id: guild.id,
      server_number: serverNumber,
      server_name: serverLabel,
      owner_id: owner.id,
      game_name: gameName,
      category_id: category.id,
      main_channel_id: mainChannel.id,
      proofs_channel_id: proofsChannel.id,
      chat_channel_id: chatChannel.id,
      owner_role_id: ownerRole.id,
      mod_role_id: modRole.id,
      booster_role_id: boosterRole.id,
      boost_rate: boostRate,
      duration_minutes: durationMinutes,
      max_players: maxPlayers,
      status: "active",
      ps_link: null,
    });

    if (!serverRecord) {
      return interaction.editReply({
        content: "❌ Failed to save boost server to the database. The channels and roles were created but may need manual cleanup.",
      });
    }

    // 6. Build confirmation embed
    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`✅ Boost Server ${serverNumber} Created`)
      .setDescription(`**${serverLabel}** has been set up and is ready to use.`)
      .addFields(
        { name: "Owner", value: `<@${owner.id}>`, inline: true },
        { name: "Status", value: "Active", inline: true },
        { name: "Max Players", value: `${maxPlayers}`, inline: true },
        { name: "Boost Rate", value: `${boostRate}x`, inline: true },
        { name: "Duration", value: `${durationMinutes} min`, inline: true },
        { name: "Game", value: gameName || "Not set", inline: true },
        { name: "Category", value: `${category.name}`, inline: false },
        { name: "Channels", value: `${mainChannel}\n${proofsChannel}\n${chatChannel}`, inline: false },
        { name: "Roles", value: `${ownerRole}\n${modRole}\n${boosterRole}`, inline: false },
      )
      .setTimestamp(new Date())
      .setFooter({ text: "BoostMon • Boost Server" });

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[BOOSTSERVER] Create error:", err);
    return interaction.editReply({
      content: `❌ Failed to create boost server: ${err.message}`,
    });
  }
}
