// discord/handlers/boostserver.js — /boostserver command handler
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
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  // Link commands must always be ephemeral — never leak ps_link
  const ephemeral = subcommand.startsWith("link-");
  await interaction.deferReply({ ephemeral }).catch(() => null);

  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  const isGuildOwner = guild.ownerId === interaction.user.id;

  // ── CREATE — Admin / Guild Owner only (no boost server exists yet) ──
  if (subcommand === "create") {
    if (!isAdmin && !isGuildOwner) {
      return interaction.editReply({
        content: "⛔ Only **Server Owner** or users with **Administrator** permission can create a boost server.",
      });
    }
    return handleCreate(interaction, guild);
  }

  // All other subcommands require a server selection — resolve it and
  // enforce: Admin OR Guild Owner OR that boost server's owner.
  const serverId = interaction.options.getString("server", true);
  const server = await db.getBoostServerById(serverId);

  if (!server || server.guild_id !== guild.id) {
    return interaction.editReply({ content: "❌ Boost server not found." });
  }

  const isServerOwner = server.owner_id === interaction.user.id;

  if (!isAdmin && !isGuildOwner && !isServerOwner) {
    return interaction.editReply({
      content: "⛔ Only **Admins** or the **Boost Server Owner** can manage this boost server.",
    });
  }

  // ── LINK SET / VIEW / CLEAR ──
  if (subcommand === "link-set" || subcommand === "link-view" || subcommand === "link-clear") {
    return handleLink(interaction, guild, server, subcommand);
  }

  // ── ARCHIVE ──
  if (subcommand === "archive") {
    return handleArchive(interaction, guild, server);
  }

  // ── DELETE ──
  if (subcommand === "delete") {
    return handleDelete(interaction, guild, server);
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
      // Attempt rollback: delete created channels and roles
      console.error("[BOOSTSERVER] DB save failed, attempting rollback...");
      await mainChannel.delete("Rollback: DB save failed").catch(() => null);
      await proofsChannel.delete("Rollback: DB save failed").catch(() => null);
      await chatChannel.delete("Rollback: DB save failed").catch(() => null);
      await category.delete("Rollback: DB save failed").catch(() => null);
      await ownerRole.delete("Rollback: DB save failed").catch(() => null);
      await modRole.delete("Rollback: DB save failed").catch(() => null);
      await boosterRole.delete("Rollback: DB save failed").catch(() => null);

      return interaction.editReply({
        content: "❌ Failed to save boost server to the database. Created channels and roles have been rolled back.",
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

// ── LINK SET / VIEW / CLEAR ──
async function handleLink(interaction, guild, server, subcommand) {
  // ── link-set ──
  if (subcommand === "link-set") {
    const link = interaction.options.getString("link", true);

    // Validate link contains the required parameter
    if (!link.includes("privateServerLinkCode=")) {
      return interaction.editReply({
        content: "❌ Invalid link. The URL must contain `privateServerLinkCode=`.\nExample: `https://www.roblox.com/games/123456?privateServerLinkCode=abc123`",
      });
    }

    const updated = await db.updateBoostServer(server.id, { ps_link: link });
    if (!updated) {
      return interaction.editReply({ content: "❌ Failed to save the link. Please try again." });
    }

    return interaction.editReply({
      content: `✅ Private server link for **${server.server_name}** (#${server.server_number}) has been saved.`,
    });
  }

  // ── link-view ──
  if (subcommand === "link-view") {
    if (!server.ps_link) {
      return interaction.editReply({
        content: `ℹ️ No private server link is set for **${server.server_name}** (#${server.server_number}).`,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`🔗 Private Server Link — ${server.server_name}`)
      .setDescription(server.ps_link)
      .setTimestamp(new Date())
      .setFooter({ text: "BoostMon • This message is only visible to you" });

    return interaction.editReply({ embeds: [embed] });
  }

  // ── link-clear ──
  if (subcommand === "link-clear") {
    const updated = await db.updateBoostServer(server.id, { ps_link: null });
    if (!updated) {
      return interaction.editReply({ content: "❌ Failed to clear the link. Please try again." });
    }

    return interaction.editReply({
      content: `✅ Private server link for **${server.server_name}** (#${server.server_number}) has been cleared.`,
    });
  }

  // Fallback — should not be reached
  return interaction.editReply({ content: "❌ Unknown link subcommand." });
}

// ── ARCHIVE ──
async function handleArchive(interaction, guild, server) {
  if (server.status === "archived") {
    return interaction.editReply({ content: "ℹ️ This boost server is already archived." });
  }

  const errors = [];

  try {
    // 1. Find or create the "ARCHIVED BOOST SERVERS" category
    let archiveCategory = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toUpperCase() === "ARCHIVED BOOST SERVERS"
    );

    if (!archiveCategory) {
      archiveCategory = await guild.channels.create({
        name: "ARCHIVED BOOST SERVERS",
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.SendMessages],
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
    }

    // 2. Lock and move channels under the archive category
    const channelIds = [server.main_channel_id, server.proofs_channel_id, server.chat_channel_id];

    for (const channelId of channelIds) {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel) {
        // Lock: deny SendMessages for @everyone
        await channel.permissionOverwrites.edit(guild.id, {
          SendMessages: false,
        }).catch((e) => errors.push(`Lock ${channel.name}: ${e.message}`));

        // Move under archive category
        await channel.setParent(archiveCategory.id, { lockPermissions: false })
          .catch((e) => errors.push(`Move ${channel.name}: ${e.message}`));
      }
    }

    // 3. Delete the original (now empty) category
    const oldCategory = await guild.channels.fetch(server.category_id).catch(() => null);
    if (oldCategory) {
      await oldCategory.delete(`Boost server ${server.server_number} archived`)
        .catch((e) => errors.push(`Delete category: ${e.message}`));
    }

    // 4. Delete roles
    const roleIds = [server.owner_role_id, server.mod_role_id, server.booster_role_id];
    for (const roleId of roleIds) {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        await role.delete(`Boost server ${server.server_number} archived`)
          .catch((e) => errors.push(`Delete role ${role.name}: ${e.message}`));
      }
    }

    // 5. Update DB: mark as archived
    await db.updateBoostServer(server.id, { status: "archived" });

    const embed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`📦 Boost Server ${server.server_number} Archived`)
      .setDescription(`**${server.server_name}** has been archived.`)
      .addFields(
        { name: "Channels", value: "Locked and moved to **ARCHIVED BOOST SERVERS**", inline: false },
        { name: "Roles", value: "Deleted (PS Owner, PS Mod, PS Booster)", inline: false },
        { name: "Status", value: "Archived", inline: true },
      )
      .setTimestamp(new Date())
      .setFooter({ text: "BoostMon • Boost Server" });

    if (errors.length > 0) {
      embed.addFields({ name: "⚠️ Warnings", value: errors.join("\n"), inline: false });
    }

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[BOOSTSERVER] Archive error:", err);
    return interaction.editReply({ content: `❌ Failed to archive boost server: ${err.message}` });
  }
}

// ── DELETE ──
async function handleDelete(interaction, guild, server) {
  const confirmText = interaction.options.getString("confirm", true);
  const expectedText = `DELETE server-${server.server_number}`;

  if (confirmText !== expectedText) {
    return interaction.editReply({
      content: `❌ Confirmation failed. You must type exactly:\n\`${expectedText}\``,
    });
  }

  const errors = [];

  try {
    // 1. Delete child channels
    const channelIds = [server.main_channel_id, server.proofs_channel_id, server.chat_channel_id];
    for (const channelId of channelIds) {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel) {
        await channel.delete(`Boost server ${server.server_number} deleted`)
          .catch((e) => errors.push(`Delete channel ${channel.name}: ${e.message}`));
      }
    }

    // 2. Delete category
    const category = await guild.channels.fetch(server.category_id).catch(() => null);
    if (category) {
      // If category still has other children (shouldn't, but be safe), move them out first
      if (category.children?.cache?.size > 0) {
        for (const [, child] of category.children.cache) {
          await child.setParent(null).catch(() => null);
        }
      }
      await category.delete(`Boost server ${server.server_number} deleted`)
        .catch((e) => errors.push(`Delete category: ${e.message}`));
    }

    // 3. Delete roles
    const roleIds = [server.owner_role_id, server.mod_role_id, server.booster_role_id];
    for (const roleId of roleIds) {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        await role.delete(`Boost server ${server.server_number} deleted`)
          .catch((e) => errors.push(`Delete role ${role.name}: ${e.message}`));
      }
    }

    // 4. Remove from DB
    const deleted = await db.deleteBoostServer(server.id);
    if (!deleted) {
      errors.push("Failed to remove record from database");
    }

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`🗑️ Boost Server ${server.server_number} Deleted`)
      .setDescription(`**${server.server_name}** has been permanently deleted.`)
      .addFields(
        { name: "Channels", value: "Deleted", inline: true },
        { name: "Roles", value: "Deleted", inline: true },
        { name: "Database", value: deleted ? "Removed" : "⚠️ Failed", inline: true },
      )
      .setTimestamp(new Date())
      .setFooter({ text: "BoostMon • Boost Server" });

    if (errors.length > 0) {
      embed.addFields({ name: "⚠️ Warnings", value: errors.join("\n"), inline: false });
    }

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[BOOSTSERVER] Delete error:", err);
    return interaction.editReply({ content: `❌ Failed to delete boost server: ${err.message}` });
  }
}
