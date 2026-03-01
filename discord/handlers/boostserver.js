// discord/handlers/boostserver.js — /boostserver command handler
const { PermissionFlagsBits, EmbedBuilder, ChannelType, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
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
  "ticket-setup": "Ticket Setup",
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
    "owner-set", "status-set", "ticket-setup",
  ]);

  if (ANYONE_SUBS.has(subcommand)) {
    // No extra check needed
  } else if (subcommand === "link-view") {
    // Only members with PS Member, PS Mod, or PS Owner role — plus Admins
    const hasServerRole = member.roles?.cache?.has(server.role_owner_id)
      || member.roles?.cache?.has(server.role_mod_id)
      || member.roles?.cache?.has(server.role_member_id);
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

  // ── TICKET SETUP ──
  if (subcommand === "ticket-setup") {
    return handleTicketSetup(interaction, guild, server);
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
      content: `❌ You already own a boost server: **${existingOwned.display_name}** (#${existingOwned.server_index}). Each member may only own one.`,
    });
  }

  // Restriction: duplicate server names (case-insensitive)
  const existingName = await db.getBoostServerByName(guild.id, name);
  if (existingName) {
    return interaction.editReply({
      content: `❌ A boost server named **${existingName.display_name}** already exists. Please choose a different name.`,
    });
  }

  // Get the next server index
  const serverIndex = await db.getNextServerIndex(guild.id);

  // Track created resources for rollback
  const created = { channels: [], roles: [], categories: [] };

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
            PermissionsBitField.Flags.SendMessages,
          ],
        },
      ],
    });
    created.categories.push(category);

    // 1b. Create tickets category: #X — {Name} Tickets
    const ticketsCategory = await guild.channels.create({
      name: `#${serverIndex} — ${name} Tickets`,
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
            PermissionsBitField.Flags.SendMessages,
          ],
        },
      ],
    });
    created.categories.push(ticketsCategory);

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

    // Mod-chat: private to owner + mods + bot only
    const modChatOverwrites = [
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

    const modChatChannel = await guild.channels.create({
      name: "【🔒】・mod-chat",
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: modChatOverwrites,
    });
    created.channels.push(modChatChannel);

    // 3b. Create booster-tickets panel channel (read-only for users, bot sends)
    const ticketPanelOverwrites = [
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
        allow: [PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.SendMessages],
      },
      {
        id: modRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.SendMessages],
      },
      {
        id: memberRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.SendMessages],
      },
    ];

    const ticketPanelChannel = await guild.channels.create({
      name: "【🚀】・booster-tickets",
      type: ChannelType.GuildText,
      parent: ticketsCategory.id,
      permissionOverwrites: ticketPanelOverwrites,
    });
    created.channels.push(ticketPanelChannel);

    // 4. Assign PS Owner role to the creator
    const ownerMember = await guild.members.fetch(ownerId).catch(() => null);
    if (ownerMember) {
      await ownerMember.roles.add(ownerRole, `Boost server #${serverIndex} owner`).catch((err) => {
        console.error(`[BOOSTSERVER] Failed to assign owner role: ${err.message}`);
      });
    }

    // 5. Store metadata in database
    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const serverRecord = await db.createBoostServer({
      guild_id: guild.id,
      server_index: serverIndex,
      display_name: name,
      slug,
      owner_id: ownerId,
      category_id: category.id,
      tickets_category_id: ticketsCategory.id,
      channel_announcements_id: announcementsChannel.id,
      channel_giveaways_id: giveawaysChannel.id,
      channel_events_id: eventsChannel.id,
      channel_images_id: imagesChannel.id,
      channel_chat_id: chatChannel.id,
      channel_mod_chat_id: modChatChannel.id,
      channel_ticket_panel_id: ticketPanelChannel.id,
      role_owner_id: ownerRole.id,
      role_mod_id: modRole.id,
      role_member_id: memberRole.id,
      status: "active",
      ps_link: null,
    });

    if (!serverRecord) {
      // Rollback: delete all created resources
      console.error("[BOOSTSERVER] DB save failed, attempting rollback...");
      for (const ch of created.channels) await ch.delete("Rollback: DB save failed").catch(() => null);
      for (const cat of created.categories) await cat.delete("Rollback: DB save failed").catch(() => null);
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
        `🔒 <#${modChatChannel.id}> — Mod chat (private)\n\n` +
        `🚀 <#${ticketPanelChannel.id}> — Booster tickets`
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
          `${announcementsChannel}\n${giveawaysChannel}\n${eventsChannel}\n${imagesChannel}\n${chatChannel}\n${modChatChannel}\n${ticketPanelChannel}`,
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
    for (const cat of created.categories) await cat.delete("Rollback: error").catch(() => null);
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
      content: `✅ Private server link for **${server.display_name}** (#${server.server_index}) has been saved.`,
    });
  }

  // ── link-view ──
  if (subcommand === "link-view") {
    if (!server.ps_link) {
      return interaction.editReply({
        content: `ℹ️ No private server link is set for **${server.display_name}** (#${server.server_index}).`,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`🔗 Private Server Link — ${server.display_name}`)
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
      content: `✅ Private server link for **${server.display_name}** (#${server.server_index}) has been cleared.`,
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
      server.channel_announcements_id, server.channel_giveaways_id,
      server.channel_events_id, server.channel_images_id,
      server.channel_chat_id, server.channel_mod_chat_id,
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
      await oldCategory.delete(`Boost server #${server.server_index} archived`)
        .catch((e) => errors.push(`Delete category: ${e.message}`));
    }

    // 4. Delete roles
    const roleIds = [
      server.role_owner_id, server.role_mod_id, server.role_member_id,
    ].filter(Boolean);
    const uniqueRoleIds = [...new Set(roleIds)];
    for (const roleId of uniqueRoleIds) {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        await role.delete(`Boost server #${server.server_index} archived`)
          .catch((e) => errors.push(`Delete role ${role.name}: ${e.message}`));
      }
    }

    // 5. Update DB: mark as archived
    await db.updateBoostServer(server.id, { status: "archived" });

    const embed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`📦 Boost Server #${server.server_index} Archived`)
      .setDescription(`**${server.display_name}** has been archived.`)
      .addFields(
        { name: "Channels", value: "Locked and moved to **ARCHIVED BOOST SERVERS**", inline: false },
        { name: "Roles", value: "Deleted (PS Owner, PS Mod, PS Member)", inline: false },
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
  const memberRoleId = server.role_member_id;

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

    await targetMember.roles.add(role, `Approved for boost server #${server.server_index}`);

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

    await targetMember.roles.remove(role, `Removed from boost server #${server.server_index}`);

    return interaction.editReply({
      content: `✅ **${targetUser.username}** has been removed from **${server.display_name}** and the **${role.name}** role has been revoked.\nThey will no longer see boost server channels or the private server link.`,
    });
  }

  return interaction.editReply({ content: "❌ Unknown member subcommand." });
}

// ── DELETE ──
async function handleDelete(interaction, guild, server) {
  const confirmText = interaction.options.getString("confirm", true);
  const expectedText = `DELETE ${server.display_name}`;

  if (confirmText !== expectedText) {
    return interaction.editReply({
      content: `❌ Confirmation failed. You must type exactly:\n\`${expectedText}\``,
    });
  }

  const errors = [];
  let channelsDeleted = 0;
  let rolesDeleted = 0;

  try {
    // 1. Delete tracked child channels
    const channelIds = [
      server.channel_announcements_id, server.channel_giveaways_id,
      server.channel_events_id, server.channel_images_id,
      server.channel_chat_id, server.channel_mod_chat_id,
      server.channel_ticket_panel_id,
    ].filter(Boolean);
    const uniqueChannelIds = new Set(channelIds);
    for (const channelId of uniqueChannelIds) {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel) {
        await channel.delete(`Boost server #${server.server_index} deleted`)
          .then(() => channelsDeleted++)
          .catch((e) => errors.push(`Channel ${channel.name}: ${e.message}`));
      }
    }

    // 2. Sweep any orphan channels still parented to the category
    const category = await guild.channels.fetch(server.category_id).catch(() => null);
    if (category) {
      const remainingChildren = category.children?.cache;
      if (remainingChildren?.size > 0) {
        for (const [, child] of remainingChildren) {
          if (!uniqueChannelIds.has(child.id)) {
            await child.delete(`Orphan cleanup — boost server #${server.server_index} deleted`)
              .then(() => channelsDeleted++)
              .catch((e) => errors.push(`Orphan channel ${child.name}: ${e.message}`));
          }
        }
      }
      // 3. Delete the category itself
      await category.delete(`Boost server #${server.server_index} deleted`)
        .catch((e) => errors.push(`Category: ${e.message}`));
    }

    // 3b. Delete tickets category if it exists
    if (server.tickets_category_id) {
      const ticketsCat = await guild.channels.fetch(server.tickets_category_id).catch(() => null);
      if (ticketsCat) {
        const ticketsChildren = ticketsCat.children?.cache;
        if (ticketsChildren?.size > 0) {
          for (const [, child] of ticketsChildren) {
            await child.delete(`Boost server #${server.server_index} deleted`)
              .then(() => channelsDeleted++)
              .catch((e) => errors.push(`Ticket channel ${child.name}: ${e.message}`));
          }
        }
        await ticketsCat.delete(`Boost server #${server.server_index} deleted`)
          .catch((e) => errors.push(`Tickets category: ${e.message}`));
      }
    }

    // 4. Delete roles — owner, mod, member (no orphaned roles)
    const roleIds = [
      server.role_owner_id, server.role_mod_id, server.role_member_id,
    ].filter(Boolean);
    const uniqueRoleIds = [...new Set(roleIds)];
    for (const roleId of uniqueRoleIds) {
      const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
      if (role) {
        await role.delete(`Boost server #${server.server_index} deleted`)
          .then(() => rolesDeleted++)
          .catch((e) => errors.push(`Role ${role.name}: ${e.message}`));
      }
    }

    // 5. Remove from DB (CASCADE deletes ticket_config and tickets)
    const dbRemoved = await db.deleteBoostServer(server.id);
    if (!dbRemoved) {
      errors.push("Failed to remove record from database");
    }

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`🗑️ Boost Server #${server.server_index} Deleted`)
      .setDescription(`**${server.display_name}** has been permanently deleted.`)
      .addFields(
        { name: "Channels", value: `${channelsDeleted} removed`, inline: true },
        { name: "Roles", value: `${rolesDeleted} removed`, inline: true },
        { name: "Database", value: dbRemoved ? "Removed" : "⚠️ Failed", inline: true },
      )
      .setTimestamp(new Date())
      .setFooter({ text: "BoostMon • Boost Server" });

    if (errors.length > 0) {
      embed.addFields({ name: "⚠️ Warnings", value: errors.map((e) => `• ${e}`).join("\n"), inline: false });
    }

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[BOOSTSERVER] Delete error:", err);
    return interaction.editReply({ content: `❌ Failed to delete boost server: ${err.message}` });
  }
}

// ── TICKET SETUP ──
async function handleTicketSetup(interaction, guild, server) {
  const title = interaction.options.getString("title", true).trim();
  const description = interaction.options.getString("description", true).trim();
  const categoriesRaw = interaction.options.getString("categories") || "";
  const pingMode = interaction.options.getString("ping") || "off";
  const notificationsChannel = interaction.options.getChannel("notifications_channel");

  // Parse categories (comma-separated, max 6); default to Boost Request, Questions
  let categories = categoriesRaw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (categoriesRaw && categories.length === 0) {
    return interaction.editReply({ content: "❌ Categories must be comma-separated labels (e.g. `General, Refund, Issue`)." });
  }

  if (categories.length === 0) {
    categories = ["Boost Request", "Questions"];
  }

  // --- Resolve ticket panel channel (with auto-discovery + repair) ---
  let panelChannel = null;
  let ticketsCategoryId = server.tickets_category_id;
  let panelChannelId = server.channel_ticket_panel_id;

  // Attempt 1: use stored channel_ticket_panel_id
  if (panelChannelId) {
    panelChannel = await guild.channels.fetch(panelChannelId).catch(() => null);
  }

  // Attempt 2: find panel channel inside stored tickets_category_id
  if (!panelChannel && ticketsCategoryId) {
    const ticketsCategory = await guild.channels.fetch(ticketsCategoryId).catch(() => null);
    if (ticketsCategory) {
      const children = guild.channels.cache.filter(ch => ch.parentId === ticketsCategory.id);
      panelChannel = children.find(ch => ch.name === "【🚀】・booster-tickets") || null;
    }
  }

  // Attempt 3: find tickets category by name pattern, then find panel inside it
  if (!panelChannel) {
    const expectedCatName = `#${server.server_index} — ${server.display_name} Tickets`;
    const ticketsCategory = guild.channels.cache.find(
      ch => ch.type === ChannelType.GuildCategory && ch.name === expectedCatName
    );
    if (ticketsCategory) {
      ticketsCategoryId = ticketsCategory.id;
      const children = guild.channels.cache.filter(ch => ch.parentId === ticketsCategory.id);
      panelChannel = children.find(ch => ch.name === "【🚀】・booster-tickets") || null;
    }
  }

  if (!panelChannel) {
    return interaction.editReply({
      content: "❌ Could not find the **【🚀】・booster-tickets** channel. Make sure the Tickets category and panel channel exist.",
    });
  }

  // Persist discovered IDs back to DB if they were missing
  const updates = {};
  if (ticketsCategoryId && ticketsCategoryId !== server.tickets_category_id) {
    updates.tickets_category_id = ticketsCategoryId;
  }
  if (panelChannel.id !== server.channel_ticket_panel_id) {
    updates.channel_ticket_panel_id = panelChannel.id;
  }
  if (Object.keys(updates).length > 0) {
    const updated = await db.updateBoostServer(server.id, updates);
    if (updated) {
      server = updated; // use refreshed record going forward
    }
  }

  try {
    // 1. Save config to DB
    const config = await db.upsertTicketConfig(server.id, {
      title,
      description,
      categories: categories.length > 0 ? categories : null,
      ping_mode: pingMode,
      notifications_channel_id: notificationsChannel?.id || null,
    });

    if (!config) {
      return interaction.editReply({ content: "❌ Failed to save ticket configuration." });
    }

    // 2. Build embed
    const panelEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(title)
      .setDescription(description)
      .setTimestamp(new Date())
      .setFooter({ text: `${server.display_name} • Ticket Panel` });

    // 3. Build dropdown with categories (always present — defaults applied above)
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`ticket_create:${server.id}`)
      .setPlaceholder("Select a category to open a ticket")
      .addOptions(
        categories.map((cat, i) => ({
          label: cat,
          value: `cat_${i}`,
          description: `Open a ${cat} ticket`,
        }))
      );

    const components = [new ActionRowBuilder().addComponents(selectMenu)];

    // 4. Find existing panel message and update, or send new
    let panelUpdated = false;
    let panelMessage = null;
    try {
      const messages = await panelChannel.messages.fetch({ limit: 20 });
      const existingPanel = messages.find(
        (m) => m.author.id === interaction.client.user.id && m.embeds.length > 0
          && m.embeds[0].footer?.text?.includes("Ticket Panel")
      );

      if (existingPanel) {
        panelMessage = await existingPanel.edit({ embeds: [panelEmbed], components });
        panelUpdated = true;
      }
    } catch (err) {
      console.warn("[BOOSTSERVER] Could not fetch/update existing panel:", err.message);
    }

    if (!panelUpdated) {
      panelMessage = await panelChannel.send({ embeds: [panelEmbed], components });
    }

    // Pin the panel message if not already pinned
    if (panelMessage && !panelMessage.pinned) {
      await panelMessage.pin().catch(() => null);
    }

    // 5. Confirm
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("✅ Ticket Panel Configured")
      .setDescription(
        `The ticket panel for **${server.display_name}** has been ${panelUpdated ? "updated" : "posted"} in <#${panelChannel.id}>.`
      )
      .addFields(
        { name: "Title", value: title, inline: true },
        { name: "Ping Mode", value: pingMode, inline: true },
        { name: "Categories", value: categories.length > 0 ? categories.join(", ") : "None (no dropdown)", inline: false },
      )
      .setTimestamp(new Date())
      .setFooter({ text: "BoostMon • Boost Server" });

    if (notificationsChannel) {
      confirmEmbed.addFields({ name: "Notifications", value: `<#${notificationsChannel.id}>`, inline: true });
    }

    return interaction.editReply({ embeds: [confirmEmbed] });
  } catch (err) {
    console.error("[BOOSTSERVER] Ticket setup error:", err);
    return interaction.editReply({ content: `❌ Failed to set up ticket panel: ${err.message}` });
  }
}
