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
  "member-add": "Add Member",
  "member-remove": "Remove Member",
  "link-set": "Set Link",
  "link-view": "View Link",
  "link-clear": "Clear Link",
  "status-set": "Set Status",
  "config-set": "Set Config",
  "delete": "Delete Server",
};

module.exports = async function handleBoostServer(interaction) {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  // All responses are ephemeral
  await interaction.deferReply({ ephemeral: true }).catch(() => null);

  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  const isGuildOwner = guild.ownerId === interaction.user.id;

  // ── CREATE — Anyone may run this (self-service) ──
  if (subcommand === "create") {
    return handleCreate(interaction, guild);
  }

  // All other subcommands require a server selection
  const serverId = interaction.options.getString("server", true);
  const server = await db.getBoostServerById(serverId);

  if (!server || server.guild_id !== guild.id) {
    return interaction.editReply({ content: "❌ Boost server not found." });
  }

  // ── Permission matrix ──
  // Resolve caller's relationship to this boost server
  const member = interaction.member;
  const isServerOwner = server.owner_id === interaction.user.id;
  const hasManage = isAdmin || isGuildOwner || isServerOwner;

  // Subcommands open to anyone (no extra permission)
  const ANYONE_SUBS = new Set(["info", "mods-list", "owner-view"]);

  // Subcommands requiring management permission (PS Owner / Discord Owner / Admin)
  const MANAGE_SUBS = new Set([
    "delete", "link-set", "link-clear", "config-set",
    "mods-add", "mods-remove", "member-add", "member-remove",
    "owner-set", "status-set",
  ]);

  if (ANYONE_SUBS.has(subcommand)) {
    // No extra check needed
  } else if (subcommand === "link-view") {
    // Only members with PS Member, PS Mod, or PS Owner role — plus Admins
    const hasServerRole = member.roles?.cache?.has(server.owner_role_id)
      || member.roles?.cache?.has(server.mod_role_id)
      || member.roles?.cache?.has(server.booster_role_id)
      || (server.member_role_id && member.roles?.cache?.has(server.member_role_id));
    if (!isAdmin && !hasServerRole) {
      return interaction.editReply({
        content: "⛔ You must be a **member of this boost server** (PS Member, PS Mod, or PS Owner role) to view its link.",
      });
    }
  } else if (MANAGE_SUBS.has(subcommand)) {
    if (!hasManage) {
      return interaction.editReply({
        content: "⛔ Only the **PS Owner**, **Discord Server Owner**, or **Administrators** can use this command.",
      });
    }
  } else {
    // Unknown subcommand — require manage as a safe default
    if (!hasManage) {
      return interaction.editReply({
        content: "⛔ You do not have permission to use this command.",
      });
    }
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

  // ── MEMBER ADD / REMOVE ──
  if (subcommand === "member-add" || subcommand === "member-remove") {
    return handleMember(interaction, guild, server, subcommand);
  }

  // All other subcommands — stub
  const label = SUBCOMMAND_LABELS[subcommand] || subcommand;
  return interaction.editReply({
    content: `🚧 **${label}** — This command is registered but not yet implemented. Stay tuned!`,
  });
};

async function handleCreate(interaction, guild) {
  const name = interaction.options.getString("name", true).trim();
  const ownerId = interaction.user.id;

  // Validate name not blank
  if (!name) {
    return interaction.editReply({ content: "❌ Server name cannot be blank." });
  }

  // Restriction: member may only own ONE boost server
  const existingOwned = await db.getBoostServerByOwner(guild.id, ownerId);
  if (existingOwned) {
    return interaction.editReply({
      content: `❌ You already own a boost server: **${existingOwned.server_name}** (#${existingOwned.server_number}). Each member may only own one.`,
    });
  }

  // Restriction: duplicate server names (case-insensitive)
  const existingName = await db.getBoostServerByName(guild.id, name);
  if (existingName) {
    return interaction.editReply({
      content: `❌ A boost server named **${existingName.server_name}** already exists. Please choose a different name.`,
    });
  }

  // Get the next server index
  const serverIndex = await db.getNextBoostServerNumber(guild.id);

  // Track created resources for rollback
  const created = { channels: [], roles: [], category: null };

  try {
    // 1. Create category: #{index} — {Name}
    const category = await guild.channels.create({
      name: `#${serverIndex} — ${name}`,
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
    created.category = category;

    // 2. Create roles
    const ownerRole = await guild.roles.create({
      name: `PS Owner • ${name}`,
      mentionable: false,
      reason: `Boost server #${serverIndex} — ${name}`,
    });
    created.roles.push(ownerRole);

    const modRole = await guild.roles.create({
      name: `PS Mod • ${name}`,
      mentionable: false,
      reason: `Boost server #${serverIndex} — ${name}`,
    });
    created.roles.push(modRole);

    const memberRole = await guild.roles.create({
      name: `PS Member • ${name}`,
      mentionable: false,
      reason: `Boost server #${serverIndex} — ${name}`,
    });
    created.roles.push(memberRole);

    // Common channel permission overwrites (visible to owner, mod, member + bot)
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
        id: memberRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
        ],
      },
    ];

    // Owner-notes: private to owner + admins only
    const ownerNotesOverwrites = [
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
    ];

    // 3. Create 6 channels under category
    const announcementsChannel = await guild.channels.create({
      name: "【📢】・announcements",
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
    });
    created.channels.push(announcementsChannel);

    const giveawaysChannel = await guild.channels.create({
      name: "【🎁】・giveaways",
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
    });
    created.channels.push(giveawaysChannel);

    const eventsChannel = await guild.channels.create({
      name: "【🎉】・events",
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
    });
    created.channels.push(eventsChannel);

    const imagesChannel = await guild.channels.create({
      name: "【📸】・images",
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
    });
    created.channels.push(imagesChannel);

    const chatChannel = await guild.channels.create({
      name: "【💬】・chat",
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
    });
    created.channels.push(chatChannel);

    const ownerNotesChannel = await guild.channels.create({
      name: "【🔒】・owner-notes",
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: ownerNotesOverwrites,
    });
    created.channels.push(ownerNotesChannel);

    // 4. Assign PS Owner role to the creator
    const ownerMember = await guild.members.fetch(ownerId).catch(() => null);
    if (ownerMember) {
      await ownerMember.roles.add(ownerRole, `Boost server #${serverIndex} owner`).catch((err) => {
        console.error(`[BOOSTSERVER] Failed to assign owner role: ${err.message}`);
      });
    }

    // 5. Store metadata in database
    const serverRecord = await db.createBoostServer({
      guild_id: guild.id,
      server_number: serverIndex,
      server_name: name,
      owner_id: ownerId,
      category_id: category.id,
      announcements_channel_id: announcementsChannel.id,
      giveaways_channel_id: giveawaysChannel.id,
      events_channel_id: eventsChannel.id,
      images_channel_id: imagesChannel.id,
      chat_channel_id: chatChannel.id,
      owner_notes_channel_id: ownerNotesChannel.id,
      owner_role_id: ownerRole.id,
      mod_role_id: modRole.id,
      booster_role_id: memberRole.id,   // legacy column maps to member role
      member_role_id: memberRole.id,
      status: "active",
      ps_link: null,
    });

    if (!serverRecord) {
      // Rollback: delete all created resources
      console.error("[BOOSTSERVER] DB save failed, attempting rollback...");
      for (const ch of created.channels) await ch.delete("Rollback: DB save failed").catch(() => null);
      if (created.category) await created.category.delete("Rollback: DB save failed").catch(() => null);
      for (const r of created.roles) await r.delete("Rollback: DB save failed").catch(() => null);

      return interaction.editReply({
        content: "❌ Failed to save boost server to the database. Created channels and roles have been rolled back.",
      });
    }

    // 6. Post structured header in announcements channel and pin it
    const headerEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`${name}`)
      .setDescription(
        `Welcome to **${name}** — Boost Server #${serverIndex}\n\n` +
        `**Owner:** <@${ownerId}>\n` +
        `**Status:** Active\n\n` +
        `📢 <#${announcementsChannel.id}> — Server announcements\n` +
        `🎁 <#${giveawaysChannel.id}> — Giveaways\n` +
        `🎉 <#${eventsChannel.id}> — Events\n` +
        `📸 <#${imagesChannel.id}> — Images & screenshots\n` +
        `💬 <#${chatChannel.id}> — General chat\n` +
        `🔒 <#${ownerNotesChannel.id}> — Owner notes (private)`
      )
      .setTimestamp(new Date())
      .setFooter({ text: "BoostMon • Boost Server" });

    try {
      const headerMsg = await announcementsChannel.send({ embeds: [headerEmbed] });
      await headerMsg.pin().catch(() => null);
    } catch (err) {
      console.error(`[BOOSTSERVER] Failed to post/pin header: ${err.message}`);
    }

    // 7. Ephemeral confirmation to the user
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`✅ Boost Server Created`)
      .setDescription(`**${name}** (Server #${serverIndex}) has been set up and is ready to use.`)
      .addFields(
        { name: "Owner", value: `<@${ownerId}>`, inline: true },
        { name: "Status", value: "Active", inline: true },
        { name: "Category", value: `${category.name}`, inline: false },
        { name: "Channels", value:
          `${announcementsChannel}\n${giveawaysChannel}\n${eventsChannel}\n${imagesChannel}\n${chatChannel}\n${ownerNotesChannel}`,
          inline: false },
        { name: "Roles", value: `${ownerRole}\n${modRole}\n${memberRole}`, inline: false },
      )
      .setTimestamp(new Date())
      .setFooter({ text: "BoostMon • Boost Server" });

    return interaction.editReply({ embeds: [confirmEmbed] });
  } catch (err) {
    console.error("[BOOSTSERVER] Create error:", err);
    // Rollback on any error
    for (const ch of created.channels) await ch.delete("Rollback: error").catch(() => null);
    if (created.category) await created.category.delete("Rollback: error").catch(() => null);
    for (const r of created.roles) await r.delete("Rollback: error").catch(() => null);
    return interaction.editReply({
      content: `❌ Failed to create boost server: ${err.message}`,
    });
  }
}

// ── LINK SET / VIEW / CLEAR ──
// SECURITY: ps_link must NEVER be posted publicly, logged to console, or included in audit logs.
// All link responses are ephemeral (enforced by the top-level deferReply({ ephemeral: true })).
// Permission: link-set/link-clear = Management; link-view = Server role holders + Admins (enforced above).
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
    const channelIds = [
      server.announcements_channel_id, server.giveaways_channel_id,
      server.events_channel_id, server.images_channel_id,
      server.chat_channel_id, server.owner_notes_channel_id,
      server.main_channel_id, server.proofs_channel_id,
    ].filter(Boolean);
    const uniqueChannelIds = [...new Set(channelIds)];

    for (const channelId of uniqueChannelIds) {
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

    // 4. Delete roles (owner, mod, member)
    const roleIds = [
      server.owner_role_id, server.mod_role_id,
      server.booster_role_id, server.member_role_id,
    ].filter(Boolean);
    const uniqueRoleIds = [...new Set(roleIds)];
    for (const roleId of uniqueRoleIds) {
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

// ── MEMBER ADD / REMOVE ──
async function handleMember(interaction, guild, server, subcommand) {
  const targetUser = interaction.options.getUser("user", true);
  const memberRoleId = server.member_role_id || server.booster_role_id;

  if (!memberRoleId) {
    return interaction.editReply({
      content: "❌ No PS Member role found for this boost server. The server may need to be recreated.",
    });
  }

  const role = guild.roles.cache.get(memberRoleId);
  if (!role) {
    return interaction.editReply({
      content: "❌ The PS Member role no longer exists in this server. It may have been manually deleted.",
    });
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    return interaction.editReply({
      content: "❌ That user is not in this Discord server.",
    });
  }

  if (subcommand === "member-add") {
    if (targetMember.roles.cache.has(memberRoleId)) {
      return interaction.editReply({
        content: `ℹ️ **${targetUser.username}** already has the **${role.name}** role.`,
      });
    }

    await targetMember.roles.add(role, `Approved for boost server #${server.server_number}`);

    return interaction.editReply({
      content: `✅ **${targetUser.username}** has been approved and given the **${role.name}** role.\nThey can now access boost server channels and view the private server link.`,
    });
  }

  if (subcommand === "member-remove") {
    if (!targetMember.roles.cache.has(memberRoleId)) {
      return interaction.editReply({
        content: `ℹ️ **${targetUser.username}** does not have the **${role.name}** role.`,
      });
    }

    await targetMember.roles.remove(role, `Removed from boost server #${server.server_number}`);

    return interaction.editReply({
      content: `✅ **${targetUser.username}** has been removed from **${server.server_name}** and the **${role.name}** role has been revoked.\nThey will no longer see boost server channels or the private server link.`,
    });
  }

  return interaction.editReply({ content: "❌ Unknown member subcommand." });
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
    // 1. Delete child channels (all 6 new channels + legacy)
    const channelIds = [
      server.announcements_channel_id, server.giveaways_channel_id,
      server.events_channel_id, server.images_channel_id,
      server.chat_channel_id, server.owner_notes_channel_id,
      server.main_channel_id, server.proofs_channel_id,
    ].filter(Boolean);
    // Deduplicate in case legacy and new IDs overlap
    const uniqueChannelIds = [...new Set(channelIds)];
    for (const channelId of uniqueChannelIds) {
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

    // 3. Delete roles (owner, mod, booster/member)
    const roleIds = [
      server.owner_role_id, server.mod_role_id,
      server.booster_role_id, server.member_role_id,
    ].filter(Boolean);
    const uniqueRoleIds = [...new Set(roleIds)];
    for (const roleId of uniqueRoleIds) {
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
