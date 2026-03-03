// discord/handlers/boostserver.js — /boostserver command handler
const {
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");
const showtimeHandler = require("./showtime");

const DEFAULT_TICKET_PANEL_TITLE = "Support & Boost Ticket System";
const DEFAULT_TICKET_PANEL_DESCRIPTION =
  "This channel is used to submit support requests for this Boost Server.\n\n" +
  "Please select the appropriate option from the dropdown below and provide clear, detailed information about your request.\n" +
  "If this is a boost request, include your Roblox Username and Display Name.\n" +
  "If this is a question, explain your issue clearly so our team can assist you efficiently.\n\n" +
  "All tickets are private and only visible to you and the server staff.";
const DEFAULT_TICKET_CATEGORIES = ["Boost Request", "Questions"];

const CREATE_WIZARD_TTL_MS = 5 * 60_000;
const WIZARD_DESCRIPTION_MAX_LENGTH = 1000;
const WIZARD_REQUIRED_CHANNELS = ["announcements", "leaderboard", "chat", "mod-chat"];
const WIZARD_ALL_CHANNELS = ["announcements", "leaderboard", "giveaways", "events", "images", "chat", "mod-chat"];
const WIZARD_PUBLIC_ELIGIBLE_CHANNELS = WIZARD_ALL_CHANNELS.filter((channelKey) => channelKey !== "mod-chat");
const CREATE_WIZARDS_BY_KEY = new Map(); // key: guildId:userId
const CREATE_WIZARDS_BY_TOKEN = new Map(); // key: token
const DESCRIPTION_EDIT_TTL_MS = 5 * 60_000;
const DESCRIPTION_EDITS_BY_TOKEN = new Map(); // key: token
const OWNER_TRANSFER_TTL_MS = 5 * 60_000;
const OWNER_TRANSFERS_BY_TOKEN = new Map(); // key: token
const JOIN_REQUEST_TTL_MS = 10 * 60_000;
const JOIN_REQUESTS_BY_KEY = new Map(); // key: guildId:serverId:userId
const JOIN_REQUESTS_BY_TOKEN = new Map(); // key: token
const LEADERS_REFRESH_COOLDOWNS = new Map(); // key: guildId:serverId:userId
const LEADERS_REFRESH_COOLDOWN_MS = 5_000;

const SUBCOMMAND_LABELS = {
  "create": "Create Boost Server",
  "description": "Update Description",
  "join": "Join Boost Server",
  "leave": "Leave Boost Server",
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

function canBypassSingleServerOwnershipLimit(interaction, guild) {
  const isGuildOwner = guild.ownerId === interaction.user.id;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
  return Boolean(isGuildOwner || isAdmin);
}

function canViewBoostServerLeaders(interaction, guild, server) {
  const member = interaction.member;
  const hasOwnerRole = server.role_owner_id ? member?.roles?.cache?.has(server.role_owner_id) : false;
  const hasModRole = server.role_mod_id ? member?.roles?.cache?.has(server.role_mod_id) : false;
  const isGuildOwner = guild.ownerId === interaction.user.id;
  const hasManageGuild = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    || member?.permissions?.has(PermissionFlagsBits.ManageGuild);
  return Boolean(hasOwnerRole || hasModRole || isGuildOwner || hasManageGuild);
}

function isBoostServerMember(interaction, server) {
  const member = interaction.member;
  const hasOwnerRole = server.role_owner_id ? member?.roles?.cache?.has(server.role_owner_id) : false;
  const hasModRole = server.role_mod_id ? member?.roles?.cache?.has(server.role_mod_id) : false;
  const hasMemberRole = server.role_member_id ? member?.roles?.cache?.has(server.role_member_id) : false;
  return Boolean(hasOwnerRole || hasModRole || hasMemberRole);
}

function canManageOwnerTransfer(interaction, guild, server) {
  const member = interaction.member;
  const isGuildOwner = guild.ownerId === interaction.user.id;
  const hasManageGuild = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    || member?.permissions?.has(PermissionFlagsBits.ManageGuild)
    || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    || member?.permissions?.has(PermissionFlagsBits.Administrator);
  const isCurrentOwnerByDb = server.owner_id === interaction.user.id;
  const hasOwnerRole = server.role_owner_id ? member?.roles?.cache?.has(server.role_owner_id) : false;
  return Boolean(isGuildOwner || hasManageGuild || isCurrentOwnerByDb || hasOwnerRole);
}

function canOwnerTransferOverride(interaction, guild) {
  const member = interaction.member;
  const isGuildOwner = guild.ownerId === interaction.user.id;
  const hasManageGuild = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    || member?.permissions?.has(PermissionFlagsBits.ManageGuild)
    || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    || member?.permissions?.has(PermissionFlagsBits.Administrator);
  return Boolean(isGuildOwner || hasManageGuild);
}

async function resolveBoostServerOwner(guild, server, options = {}) {
  const { logWarning = false } = options;
  let resolvedOwnerId = server.owner_id || null;
  let warningText = null;

  if (!server.role_owner_id) {
    return { ownerId: resolvedOwnerId, warningText };
  }

  const ownerRole = guild.roles.cache.get(server.role_owner_id)
    || await guild.roles.fetch(server.role_owner_id).catch(() => null);

  if (!ownerRole) {
    return { ownerId: resolvedOwnerId, warningText };
  }

  const ownerHolders = [...ownerRole.members.values()];
  if (ownerHolders.length > 1) {
    ownerHolders.sort((a, b) => {
      const positionDiff = (b.roles?.highest?.position || 0) - (a.roles?.highest?.position || 0);
      if (positionDiff !== 0) return positionDiff;
      const joinedA = Number(a.joinedTimestamp || 0);
      const joinedB = Number(b.joinedTimestamp || 0);
      if (joinedA !== joinedB) return joinedA - joinedB;
      return String(a.id).localeCompare(String(b.id));
    });

    resolvedOwnerId = ownerHolders[0].id;
    warningText = `⚠️ Multiple PS Owner role holders detected (${ownerHolders.length}). Showing highest-role-positioned holder: <@${resolvedOwnerId}>.`;

    if (logWarning) {
      console.warn(`[BOOSTSERVER] owner resolution warning for server #${server.server_index} (${server.display_name}): multiple PS Owner holders detected: ${ownerHolders.map((m) => m.id).join(", ")}. Selected ${resolvedOwnerId}.`);
    }
  } else if (!resolvedOwnerId && ownerHolders.length === 1) {
    resolvedOwnerId = ownerHolders[0].id;
  }

  return { ownerId: resolvedOwnerId, warningText };
}

function buildLeadersRefreshRow(serverId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bsleaders_refresh:${serverId}`)
      .setLabel("Refresh")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildServerChannelSummaryLines(server) {
  return [
    server.channel_announcements_id ? `📢 <#${server.channel_announcements_id}> — Server announcements` : null,
    server.channel_leaderboard_id ? `👑 <#${server.channel_leaderboard_id}> — Leaderboard` : null,
    server.channel_giveaways_id ? `🎁 <#${server.channel_giveaways_id}> — Giveaways` : null,
    server.channel_events_id ? `🎉 <#${server.channel_events_id}> — Events` : null,
    server.channel_images_id ? `📸 <#${server.channel_images_id}> — Images & screenshots` : null,
    server.channel_chat_id ? `💬 <#${server.channel_chat_id}> — General chat` : null,
    server.channel_mod_chat_id ? `🔒 <#${server.channel_mod_chat_id}> — Mod chat (private)` : null,
    server.channel_ticket_panel_id ? `🚀 <#${server.channel_ticket_panel_id}> — Booster tickets` : null,
  ].filter(Boolean).join("\n");
}

function buildServerHeaderEmbed(server, descriptionOverride = null) {
  const descriptionText = descriptionOverride ?? server.description ?? "";
  const channelSummaryLines = buildServerChannelSummaryLines(server);

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle(`${server.display_name}`)
    .setDescription(
      `Welcome to **${server.display_name}** — Boost Server #${server.server_index}\n\n` +
      (descriptionText ? `**Description:** ${descriptionText}\n\n` : "") +
      `**Owner:** <@${server.owner_id}>\n` +
      `**Status:** ${String(server.status || "active").replace(/^./, (c) => c.toUpperCase())}\n\n` +
      channelSummaryLines
    )
    .setTimestamp(new Date())
    .setFooter({ text: "BoostMon • Boost Server" });
}

async function upsertPinnedBoostServerHeader(guild, server, descriptionOverride = null, clientUserId = null) {
  const announcementsId = server.channel_announcements_id;
  if (!announcementsId) {
    return { ok: false, message: "Announcements channel is not configured for this boost server." };
  }

  const announcementsChannel = await guild.channels.fetch(announcementsId).catch(() => null);
  if (!announcementsChannel) {
    return { ok: false, message: "Announcements channel could not be found." };
  }

  const expectedAuthorId = clientUserId || guild.client.user?.id;
  const pinnedMessages = await announcementsChannel.messages.fetchPinned().catch(() => null);
  const existingHeader = pinnedMessages?.find((message) => {
    const embed = message.embeds?.[0];
    if (!embed) return false;
    const isBoostHeader = embed.footer?.text === "BoostMon • Boost Server" && embed.title === server.display_name;
    if (!isBoostHeader) return false;
    if (!expectedAuthorId) return true;
    return message.author?.id === expectedAuthorId;
  }) || null;

  const embed = buildServerHeaderEmbed(server, descriptionOverride);
  const headerMessage = existingHeader
    ? await existingHeader.edit({ embeds: [embed] }).catch(() => null)
    : await announcementsChannel.send({ embeds: [embed] }).catch(() => null);

  if (!headerMessage) {
    return { ok: false, message: "Failed to post/update the announcements header." };
  }

  if (!headerMessage.pinned) {
    await headerMessage.pin().catch(() => null);
  }

  return { ok: true, messageId: headerMessage.id };
}

function fullAccessAllowFlags() {
  return [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.ReadMessageHistory,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.AttachFiles,
    PermissionsBitField.Flags.EmbedLinks,
  ];
}

function buildMainCategoryOverwrites(guildId, botId, ownerRoleId, modRoleId, memberRoleId) {
  const overwrites = [
    {
      id: guildId,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
    {
      id: botId,
      allow: fullAccessAllowFlags(),
    },
  ];

  if (ownerRoleId) {
    overwrites.push({ id: ownerRoleId, allow: fullAccessAllowFlags() });
  }
  if (modRoleId) {
    overwrites.push({ id: modRoleId, allow: fullAccessAllowFlags() });
  }
  if (memberRoleId) {
    overwrites.push({
      id: memberRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.ReadMessageHistory,
      ],
    });
  }

  return overwrites;
}

function buildMainChannelOverwrites(guildId, botId, ownerRoleId, modRoleId, memberRoleId, channelKey, isPublic) {
  const everyoneOverwrite = (channelKey === "mod-chat")
    ? {
      id: guildId,
      deny: [PermissionsBitField.Flags.ViewChannel],
    }
    : isPublic
    ? {
      id: guildId,
      allow: [PermissionsBitField.Flags.ViewChannel],
      deny: [PermissionsBitField.Flags.SendMessages],
    }
    : {
      id: guildId,
      deny: [PermissionsBitField.Flags.ViewChannel],
    };

  const overwrites = [
    everyoneOverwrite,
    {
      id: botId,
      allow: fullAccessAllowFlags(),
    },
    {
      id: ownerRoleId,
      allow: fullAccessAllowFlags(),
    },
    {
      id: modRoleId,
      allow: fullAccessAllowFlags(),
    },
  ];

  if (channelKey === "mod-chat") {
    overwrites.push({
      id: memberRoleId,
      deny: [PermissionsBitField.Flags.ViewChannel],
    });
    return overwrites;
  }

  if (channelKey === "images") {
    overwrites.push({
      id: memberRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.AttachFiles,
      ],
    });
    return overwrites;
  }

  if (channelKey === "chat") {
    overwrites.push({
      id: memberRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.SendMessages,
      ],
    });
    return overwrites;
  }

  // announcements / giveaways / events default member read-only
  overwrites.push({
    id: memberRoleId,
    allow: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.ReadMessageHistory,
    ],
    deny: [PermissionsBitField.Flags.SendMessages],
  });
  return overwrites;
}

function buildTicketsCategoryOverwrites(guildId, botId, ownerRoleId, modRoleId, memberRoleId) {
  const overwrites = [
    {
      id: guildId,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
    {
      id: botId,
      allow: fullAccessAllowFlags(),
    },
    {
      id: ownerRoleId,
      allow: fullAccessAllowFlags(),
    },
    {
      id: modRoleId,
      allow: fullAccessAllowFlags(),
    },
  ];

  if (memberRoleId) {
    overwrites.push({
      id: memberRoleId,
      deny: [PermissionsBitField.Flags.ViewChannel],
    });
  }

  return overwrites;
}

function buildTicketPanelOverwrites(guildId, botId, ownerRoleId, modRoleId, memberRoleId) {
  const overwrites = [
    {
      id: guildId,
      deny: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
      ],
    },
    {
      id: botId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ManageMessages,
        PermissionsBitField.Flags.EmbedLinks,
      ],
    },
    {
      id: ownerRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.ReadMessageHistory,
      ],
      deny: [PermissionsBitField.Flags.SendMessages],
    },
    {
      id: modRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.ReadMessageHistory,
      ],
      deny: [PermissionsBitField.Flags.SendMessages],
    },
  ];

  if (memberRoleId) {
    overwrites.push({
      id: memberRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.ReadMessageHistory,
      ],
      deny: [PermissionsBitField.Flags.SendMessages],
    });
  }

  return overwrites;
}

async function repairBoostServerOverwrites(guild, server, clientUserId) {
  const roleIdsPresent = [server.role_owner_id, server.role_mod_id, server.role_member_id].every(Boolean);
  if (!roleIdsPresent) {
    return { ok: false, message: "Missing boost server role IDs; cannot reapply overwrites." };
  }

  const mainCategory = server.category_id
    ? await guild.channels.fetch(server.category_id).catch(() => null)
    : null;
  if (mainCategory) {
    await mainCategory.permissionOverwrites.set(
      buildMainCategoryOverwrites(guild.id, clientUserId, server.role_owner_id, server.role_mod_id, server.role_member_id)
    ).catch(() => null);
  }

  const mainChannelMap = {
    announcements: server.channel_announcements_id,
    leaderboard: server.channel_leaderboard_id,
    giveaways: server.channel_giveaways_id,
    events: server.channel_events_id,
    images: server.channel_images_id,
    chat: server.channel_chat_id,
    "mod-chat": server.channel_mod_chat_id,
  };

  for (const [channelKey, channelId] of Object.entries(mainChannelMap)) {
    if (!channelId) continue;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) continue;
    await channel.permissionOverwrites.set(
      buildMainChannelOverwrites(
        guild.id,
        clientUserId,
        server.role_owner_id,
        server.role_mod_id,
        server.role_member_id,
        channelKey,
        false
      )
    ).catch(() => null);
  }

  const ticketsCategory = server.tickets_category_id
    ? await guild.channels.fetch(server.tickets_category_id).catch(() => null)
    : null;
  if (ticketsCategory) {
    await ticketsCategory.permissionOverwrites.set(
      buildTicketsCategoryOverwrites(guild.id, clientUserId, server.role_owner_id, server.role_mod_id, server.role_member_id)
    ).catch(() => null);
  }

  const ticketPanel = server.channel_ticket_panel_id
    ? await guild.channels.fetch(server.channel_ticket_panel_id).catch(() => null)
    : null;
  if (ticketPanel) {
    await ticketPanel.permissionOverwrites.set(
      buildTicketPanelOverwrites(guild.id, clientUserId, server.role_owner_id, server.role_mod_id, server.role_member_id)
    ).catch(() => null);
  }

  return { ok: true, message: "Permission overwrites reapplied." };
}

async function sendBoostMemberWelcomeDM(guild, server, targetUser) {
  try {
    const ownerMember = await guild.members.fetch(server.owner_id).catch(() => null);
    const ownerDisplayName = ownerMember?.displayName || ownerMember?.user?.username || "The server owner";

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`Welcome to ${server.display_name}`)
      .setDescription(
        `Welcome! ${ownerDisplayName} has added you to their Boost Server: ${server.display_name}.\n` +
        "Head over to the server channels to get started. If you have questions, open a ticket in booster-tickets."
      )
      .setTimestamp(new Date())
      .setFooter({ text: "BoostMon • Member Access Granted" });

    await targetUser.send({ embeds: [welcomeEmbed] });
  } catch (err) {
    console.warn(
      `[BOOSTSERVER] Welcome DM failed for user ${targetUser.id} in boost server #${server.server_index} (${server.display_name}): ${err.message}`
    );
  }
}

function joinRequestKey(guildId, serverId, userId) {
  return `${guildId}:${serverId}:${userId}`;
}

function clearJoinRequest(state) {
  if (!state) return;
  if (state.timeout) clearTimeout(state.timeout);
  JOIN_REQUESTS_BY_KEY.delete(joinRequestKey(state.guildId, state.serverId, state.requesterId));
  JOIN_REQUESTS_BY_TOKEN.delete(state.token);
}

function getJoinRequestByToken(token) {
  const state = JOIN_REQUESTS_BY_TOKEN.get(token);
  if (!state) return null;
  if (Date.now() > state.expiresAt) {
    clearJoinRequest(state);
    return null;
  }
  return state;
}

async function sendJoinDeclinedDM(targetUser, serverName, moderatorName, serverIndex) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`Join Request Update — ${serverName}`)
      .setDescription(`Your request to join ${serverName} was declined by ${moderatorName}.`)
      .setTimestamp(new Date())
      .setFooter({ text: `Boost Server #${serverIndex}` });
    await targetUser.send({ embeds: [embed] });
  } catch (err) {
    console.warn(`[BOOSTSERVER] Decline DM failed for user ${targetUser.id} in boost server #${serverIndex} (${serverName}): ${err.message}`);
  }
}

async function handleJoin(interaction, guild, server) {
  const requester = interaction.user;
  const memberRoleId = server.role_member_id;
  if (!memberRoleId) {
    return interaction.editReply({ content: "❌ This boost server does not have a PS Member role configured." });
  }

  const requesterMember = await guild.members.fetch(requester.id).catch(() => null);
  if (!requesterMember) {
    return interaction.editReply({ content: "❌ Could not verify your membership in this Discord server." });
  }

  if (requesterMember.roles.cache.has(memberRoleId)) {
    return interaction.editReply({ content: "ℹ️ You already have member access to this boost server." });
  }

  const modChatId = server.channel_mod_chat_id;
  const modChatChannel = modChatId ? await guild.channels.fetch(modChatId).catch(() => null) : null;
  if (!modChatChannel) {
    return interaction.editReply({ content: "❌ This boost server does not have a valid mod-chat channel for join requests." });
  }

  const pendingKey = joinRequestKey(guild.id, server.id, requester.id);
  const existingPending = JOIN_REQUESTS_BY_KEY.get(pendingKey);
  if (existingPending && Date.now() <= existingPending.expiresAt) {
    return interaction.editReply({
      content: "⏳ You already have a pending join request for this boost server. Please wait up to 10 minutes.",
    });
  }
  if (existingPending) {
    clearJoinRequest(existingPending);
  }

  const robloxUsername = interaction.options.getString("roblox_username")?.trim() || null;
  const requestText = interaction.options.getString("request_text")?.trim() || null;

  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const requestEmbed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle(`Join Request — ${server.display_name}`)
    .setDescription(
      `**Requester:** <@${requester.id}>\n` +
      `**Roblox Username:** ${robloxUsername || "Not provided"}\n` +
      `**Request:** ${requestText || "No additional request text. Please include Roblox Username if needed."}`
    )
    .setTimestamp(new Date())
    .setFooter({ text: `Boost Server #${server.server_index}` });

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bsjoin_approve:${token}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`bsjoin_decline:${token}`)
      .setLabel("Decline")
      .setStyle(ButtonStyle.Danger)
  );

  const joinMessage = await modChatChannel.send({
    content: `<@${requester.id}> <@&${server.role_owner_id}> <@&${server.role_mod_id}>`,
    embeds: [requestEmbed],
    components: [controls],
  });

  const state = {
    token,
    guildId: guild.id,
    serverId: server.id,
    requesterId: requester.id,
    messageId: joinMessage.id,
    channelId: modChatChannel.id,
    expiresAt: Date.now() + JOIN_REQUEST_TTL_MS,
    timeout: setTimeout(() => {
      const live = JOIN_REQUESTS_BY_TOKEN.get(token);
      if (live) clearJoinRequest(live);
    }, JOIN_REQUEST_TTL_MS),
  };
  JOIN_REQUESTS_BY_KEY.set(pendingKey, state);
  JOIN_REQUESTS_BY_TOKEN.set(token, state);

  return interaction.editReply({
    content: `✅ Your join request for **${server.display_name}** has been sent to staff.`,
  });
}

async function handleLeave(interaction, guild, server) {
  const callerMember = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!callerMember) {
    return interaction.editReply({ content: "❌ Could not verify your membership in this Discord server." });
  }

  const ownerRoleId = server.role_owner_id;
  const modRoleId = server.role_mod_id;
  const memberRoleId = server.role_member_id;

  const hasOwnerRole = ownerRoleId ? callerMember.roles.cache.has(ownerRoleId) : false;
  const hasModRole = modRoleId ? callerMember.roles.cache.has(modRoleId) : false;
  if (hasOwnerRole || hasModRole) {
    return interaction.editReply({
      content: "⛔ You cannot leave as staff. PS Owner/PS Mod must transfer ownership or be removed by the owner/admin.",
    });
  }

  if (!memberRoleId) {
    return interaction.editReply({ content: "You are not a member of this boost server." });
  }

  const memberRole = guild.roles.cache.get(memberRoleId) || await guild.roles.fetch(memberRoleId).catch(() => null);
  if (!memberRole || !callerMember.roles.cache.has(memberRoleId)) {
    return interaction.editReply({ content: "You are not a member of this boost server." });
  }

  try {
    await callerMember.roles.remove(memberRole, `User left boost server #${server.server_index}`);
  } catch (err) {
    console.error(`[BOOSTSERVER] Leave failed removing PS Member role for ${interaction.user.id} on server #${server.server_index}: ${err.message}`);
    return interaction.editReply({ content: "❌ Failed to remove your PS Member role. Please contact an admin." });
  }

  if (server.channel_mod_chat_id) {
    const modChat = await guild.channels.fetch(server.channel_mod_chat_id).catch(() => null);
    if (modChat && typeof modChat.send === "function") {
      await modChat.send(`<@${interaction.user.id}> left the boost server.`).catch(() => null);
    }
  }

  return interaction.editReply({
    content: `✅ You left **${server.display_name}**. Your PS Member role was removed.`,
  });
}

async function handleLeaders(interaction, guild, server) {
  if (!canViewBoostServerLeaders(interaction, guild, server)) {
    return interaction.editReply({ content: "Not authorized." });
  }

  const payload = await buildLeadersPayload(guild, server);
  return interaction.editReply(payload);
}

async function handleOwnerView(interaction, guild, server) {
  await guild.members.fetch().catch(() => null);
  const { ownerId: resolvedOwnerId, warningText } = await resolveBoostServerOwner(guild, server, { logWarning: true });

  const ownerDisplay = resolvedOwnerId ? `<@${resolvedOwnerId}>` : "No owner set.";

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("Boost Server Owner")
    .setTimestamp(new Date())
    .addFields(
      { name: "Server", value: `#${server.server_index} — ${server.display_name}`, inline: false },
      { name: "Current Owner", value: ownerDisplay, inline: false }
    )
    .setFooter({ text: "BoostMon • Owner View" });

  if (warningText) {
    embed.addFields({ name: "Warning", value: warningText, inline: false });
  }

  return interaction.editReply({ embeds: [embed] });
}

function clearOwnerTransferState(state) {
  if (!state) return;
  if (state.timeout) clearTimeout(state.timeout);
  OWNER_TRANSFERS_BY_TOKEN.delete(state.token);
}

function getActiveOwnerTransfer(token, interaction) {
  const state = OWNER_TRANSFERS_BY_TOKEN.get(token);
  if (!state) return { state: null, reason: "missing" };

  if (Date.now() > state.expiresAt) {
    clearOwnerTransferState(state);
    return { state: null, reason: "expired" };
  }

  if (state.guildId !== interaction.guildId) {
    return { state: null, reason: "forbidden" };
  }

  return { state, reason: null };
}

async function handleOwnerSet(interaction, guild, server) {
  if (!canManageOwnerTransfer(interaction, guild, server)) {
    return interaction.editReply({ content: "Not authorized." });
  }

  const newOwner = interaction.options.getUser("new_owner", false)
    || interaction.options.getUser("user", true);

  if (newOwner.bot) {
    return interaction.editReply({ content: "❌ Bots cannot be set as owner." });
  }

  const newOwnerMember = await guild.members.fetch(newOwner.id).catch(() => null);
  if (!newOwnerMember) {
    return interaction.editReply({ content: "❌ New owner must be a member of this server." });
  }

  await guild.members.fetch().catch(() => null);
  const { ownerId: currentOwnerId } = await resolveBoostServerOwner(guild, server);

  if (currentOwnerId === newOwner.id) {
    return interaction.editReply({ content: "You are already the owner." });
  }

  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const state = {
    token,
    guildId: guild.id,
    serverId: server.id,
    actorUserId: interaction.user.id,
    oldOwnerId: currentOwnerId || server.owner_id || null,
    newOwnerId: newOwner.id,
    expiresAt: Date.now() + OWNER_TRANSFER_TTL_MS,
    timeout: setTimeout(() => {
      const live = OWNER_TRANSFERS_BY_TOKEN.get(token);
      if (live) clearOwnerTransferState(live);
    }, OWNER_TRANSFER_TTL_MS),
  };

  OWNER_TRANSFERS_BY_TOKEN.set(token, state);

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("Confirm Ownership Transfer")
    .setDescription(`Transfer ownership of **${server.display_name}** to <@${newOwner.id}>?`)
    .setTimestamp(new Date())
    .addFields(
      { name: "Server", value: `#${server.server_index} — ${server.display_name}`, inline: false },
      { name: "Current Owner", value: state.oldOwnerId ? `<@${state.oldOwnerId}>` : "No owner set.", inline: true },
      { name: "New Owner", value: `<@${newOwner.id}>`, inline: true }
    )
    .setFooter({ text: "This confirmation expires in 5 minutes" });

  return interaction.editReply({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bsowner_confirm:${token}`)
          .setLabel("Confirm")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`bsowner_cancel:${token}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  });
}

async function handleOwnerTransferButton(interaction) {
  const [action, token] = interaction.customId.split(":");
  const { state, reason } = getActiveOwnerTransfer(token, interaction);
  if (!state) {
    const message = reason === "forbidden"
      ? "Not authorized."
      : "⌛ This ownership transfer request has expired. Run `/boostserver owner-set` again.";
    return interaction.reply({ content: message, ephemeral: true });
  }

  const guild = interaction.guild;
  const server = await db.getBoostServerById(state.serverId);
  if (!guild || !server || server.guild_id !== guild.id) {
    clearOwnerTransferState(state);
    return interaction.reply({ content: "❌ Boost server not found.", ephemeral: true });
  }

  const isInitiator = state.actorUserId === interaction.user.id;
  const isOverride = canOwnerTransferOverride(interaction, guild);
  if (!isInitiator && !isOverride) {
    return interaction.reply({ content: "Not authorized.", ephemeral: true });
  }

  if (action === "bsowner_cancel") {
    clearOwnerTransferState(state);
    return interaction.update({
      content: "❎ Ownership transfer canceled.",
      embeds: [],
      components: [],
    });
  }

  if (action !== "bsowner_confirm") {
    return interaction.reply({ content: "❌ Unknown owner transfer action.", ephemeral: true });
  }

  const newOwnerMember = await guild.members.fetch(state.newOwnerId).catch(() => null);
  if (!newOwnerMember || newOwnerMember.user?.bot) {
    clearOwnerTransferState(state);
    return interaction.update({
      content: "❌ New owner is no longer eligible (missing, left server, or bot account).",
      embeds: [],
      components: [],
    });
  }

  const ownerRole = server.role_owner_id
    ? (guild.roles.cache.get(server.role_owner_id) || await guild.roles.fetch(server.role_owner_id).catch(() => null))
    : null;

  if (!ownerRole) {
    clearOwnerTransferState(state);
    return interaction.update({
      content: "❌ PS Owner role is missing for this boost server.",
      embeds: [],
      components: [],
    });
  }

  const memberRole = server.role_member_id
    ? (guild.roles.cache.get(server.role_member_id) || await guild.roles.fetch(server.role_member_id).catch(() => null))
    : null;

  await guild.members.fetch().catch(() => null);
  const previousOwnerId = state.oldOwnerId || server.owner_id || null;

  for (const holder of ownerRole.members.values()) {
    if (holder.roles.cache.has(ownerRole.id)) {
      await holder.roles.remove(ownerRole, `Ownership transfer for boost server #${server.server_index}`).catch(() => null);
    }
  }

  if (memberRole && !newOwnerMember.roles.cache.has(memberRole.id)) {
    await newOwnerMember.roles.add(memberRole, `Ownership transfer prep for boost server #${server.server_index}`).catch(() => null);
  }

  if (!newOwnerMember.roles.cache.has(ownerRole.id)) {
    await newOwnerMember.roles.add(ownerRole, `Ownership transfer for boost server #${server.server_index}`).catch(() => null);
  }

  const updated = await db.updateBoostServer(server.id, { owner_id: newOwnerMember.id });
  if (!updated) {
    clearOwnerTransferState(state);
    return interaction.update({
      content: "❌ Failed to update owner in database.",
      embeds: [],
      components: [],
    });
  }

  if (server.channel_mod_chat_id) {
    const modChat = await guild.channels.fetch(server.channel_mod_chat_id).catch(() => null);
    if (modChat && typeof modChat.send === "function") {
      await modChat.send(
        `Ownership transferred: ${previousOwnerId ? `<@${previousOwnerId}>` : "No owner set"} → <@${newOwnerMember.id}> (by <@${interaction.user.id}>)`
      ).catch(() => null);
    }
  }

  await newOwnerMember.send(`You are now the PS Owner of ${server.display_name}.`).catch(() => null);

  clearOwnerTransferState(state);
  return interaction.update({
    content: `✅ Ownership transferred to <@${newOwnerMember.id}>.`,
    embeds: [],
    components: [],
  });
}

async function buildLeadersPayload(guild, server) {
  await guild.members.fetch().catch(() => null);

  const roleIds = [server.role_owner_id, server.role_mod_id, server.role_member_id].filter(Boolean);
  const boostServerUserIds = new Set();

  for (const member of guild.members.cache.values()) {
    if (roleIds.some((roleId) => member.roles?.cache?.has(roleId))) {
      boostServerUserIds.add(member.user.id);
    }
  }

  if (boostServerUserIds.size === 0) {
    return {
      content: "No active timers for this boost server.",
      embeds: [],
      components: [buildLeadersRefreshRow(server.id)],
    };
  }

  const allGuildTimersRaw = await db.getAllGuildTimers(guild.id);
  const allGuildTimers = Array.isArray(allGuildTimersRaw) ? allGuildTimersRaw : [];
  const timersForBoostServer = allGuildTimers.filter((timer) => boostServerUserIds.has(timer.user_id));

  if (timersForBoostServer.length === 0) {
    return {
      content: "No active timers for this boost server.",
      embeds: [],
      components: [buildLeadersRefreshRow(server.id)],
    };
  }

  const leaderboard = await showtimeHandler.buildTimersLeaderboardForUsers(guild, timersForBoostServer, {
    title: `【⭐】${server.display_name} Leaders【⭐】`,
    maxEntries: 25,
  });

  if (leaderboard.status !== "ok") {
    return {
      content: "No active timers for this boost server.",
      embeds: [],
      components: [buildLeadersRefreshRow(server.id)],
    };
  }

  return {
    content: null,
    embeds: [leaderboard.embed],
    components: [buildLeadersRefreshRow(server.id)],
  };
}

async function handleLeadersRefreshButton(interaction) {
  const [, serverId] = interaction.customId.split(":");
  const guild = interaction.guild;
  if (!guild || !serverId) {
    return interaction.reply({ content: "❌ Invalid refresh action.", ephemeral: true });
  }

  const server = await db.getBoostServerById(serverId);
  if (!server || server.guild_id !== guild.id) {
    return interaction.reply({ content: "❌ Boost server not found.", ephemeral: true });
  }

  if (!isBoostServerMember(interaction, server)) {
    return interaction.reply({ content: "You are not part of this boost server.", ephemeral: true });
  }

  const cooldownKey = `${guild.id}:${server.id}:${interaction.user.id}`;
  const lastRefreshAt = LEADERS_REFRESH_COOLDOWNS.get(cooldownKey) || 0;
  const elapsedMs = Date.now() - lastRefreshAt;
  if (elapsedMs < LEADERS_REFRESH_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((LEADERS_REFRESH_COOLDOWN_MS - elapsedMs) / 1000);
    return interaction.reply({ content: `⏳ Please wait ${waitSeconds}s before refreshing again.`, ephemeral: true });
  }
  LEADERS_REFRESH_COOLDOWNS.set(cooldownKey, Date.now());

  await interaction.deferUpdate().catch(() => null);
  const payload = await buildLeadersPayload(guild, server);
  return interaction.editReply(payload);
}

module.exports = async function handleBoostServer(interaction) {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  // CREATE wizard starts with a modal, so it must run before deferReply.
  if (subcommand === "create") {
    return handleCreateWizardStart(interaction, guild);
  }

  // DESCRIPTION editor starts with a modal, so it must run before deferReply.
  if (subcommand === "description") {
    return handleDescriptionEditStart(interaction, guild);
  }

  const isLeadersSubcommand = subcommand === "leaders";

  // Keep boostserver flows ephemeral by default, but make leaders output public.
  await interaction.deferReply({ ephemeral: !isLeadersSubcommand }).catch(() => null);

  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  const isGuildOwner = guild.ownerId === interaction.user.id;

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
  const ANYONE_SUBS = new Set(["join", "leave", "info", "mods-list", "owner-view", "leaders"]);

  // Subcommands requiring management permission (PS Owner / Discord Owner / Admin)
  const MANAGE_SUBS = new Set([
    "delete", "link-set", "link-clear", "config-set",
    "mods-add", "mods-remove", "member-add", "member-remove",
    "status-set", "ticket-setup", "description",
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
  } else if (subcommand === "owner-set") {
    if (!canManageOwnerTransfer(interaction, guild, server)) {
      return interaction.editReply({ content: "Not authorized." });
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

  // ── JOIN REQUEST ──
  if (subcommand === "join") {
    return handleJoin(interaction, guild, server);
  }

  // ── LEAVE BOOST SERVER ──
  if (subcommand === "leave") {
    return handleLeave(interaction, guild, server);
  }

  // ── LEADERS VIEW ──
  if (subcommand === "leaders") {
    return handleLeaders(interaction, guild, server);
  }

  // ── OWNER VIEW ──
  if (subcommand === "owner-view") {
    return handleOwnerView(interaction, guild, server);
  }

  // ── OWNER SET ──
  if (subcommand === "owner-set") {
    return handleOwnerSet(interaction, guild, server);
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

  // ── CONFIG SET (currently used as repair trigger) ──
  if (subcommand === "config-set") {
    return handleConfigSet(interaction, guild, server);
  }

  if (subcommand === "description") {
    return handleDescriptionEditStart(interaction, guild, server);
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

async function handleCreate(interaction, guild, wizardConfig = null) {
  const name = wizardConfig?.name || interaction.options?.getString("name", false)?.trim();
  const serverDescription = wizardConfig?.description || "";
  const selectedChannels = wizardConfig?.selectedChannels?.length
    ? wizardConfig.selectedChannels
    : [...WIZARD_ALL_CHANNELS];
  const publicChannelSet = new Set(
    (wizardConfig?.publicChannels || []).filter(
      (channelKey) => selectedChannels.includes(channelKey) && channelKey !== "mod-chat"
    )
  );
  const wizardPingMode = wizardConfig?.ticketPingMode || "off";
  const sendLogsToModChat = Boolean(wizardConfig?.sendLogsToModChat);
  const ownerId = interaction.user.id;
  const bypassOwnershipLimit = canBypassSingleServerOwnershipLimit(interaction, guild);

  // Validate name not blank
  if (!name) {
    return interaction.editReply({ content: "❌ Server name cannot be blank." });
  }

  // Restriction: member may only own ONE boost server
  if (!bypassOwnershipLimit) {
    const existingOwned = await db.getBoostServerByOwner(guild.id, ownerId);
    if (existingOwned) {
      return interaction.editReply({
        content: `❌ You already own a boost server: **${existingOwned.display_name}** (#${existingOwned.server_index}). Each member may only own one.`,
      });
    }
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
      permissionOverwrites: buildMainCategoryOverwrites(
        guild.id,
        interaction.client.user.id,
        null,
        null,
        null
      ),
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

    // Apply final main category role overwrites now that roles exist
    await category.permissionOverwrites.set(
      buildMainCategoryOverwrites(
        guild.id,
        interaction.client.user.id,
        ownerRole.id,
        modRole.id,
        memberRole.id
      )
    );

    // 3. Create selected channels under category
    const channelSpecs = {
      announcements: { name: "【📢】・announcements", modOnly: false },
      leaderboard: { name: "【👑】・leaderboard", modOnly: false },
      giveaways: { name: "【🎁】・giveaways", modOnly: false },
      events: { name: "【🎉】・events", modOnly: false },
      images: { name: "【📸】・images", modOnly: false },
      chat: { name: "【💬】・chat", modOnly: false },
      "mod-chat": { name: "【🔒】・mod-chat", modOnly: true },
    };

    const createdMainChannels = {};
    for (const key of selectedChannels) {
      const spec = channelSpecs[key];
      if (!spec) continue;

      const isPublic = publicChannelSet.has(key);
      const permissionOverwrites = buildMainChannelOverwrites(
        guild.id,
        interaction.client.user.id,
        ownerRole.id,
        modRole.id,
        memberRole.id,
        key,
        isPublic
      );

      const createdChannel = await guild.channels.create({
        name: spec.name,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites,
      });

      created.channels.push(createdChannel);
      createdMainChannels[key] = createdChannel;
    }

    const announcementsChannel = createdMainChannels.announcements || null;
    const leaderboardChannel = createdMainChannels.leaderboard || null;
    const giveawaysChannel = createdMainChannels.giveaways || null;
    const eventsChannel = createdMainChannels.events || null;
    const imagesChannel = createdMainChannels.images || null;
    const chatChannel = createdMainChannels.chat || null;
    const modChatChannel = createdMainChannels["mod-chat"] || null;

    if (!announcementsChannel || !leaderboardChannel || !chatChannel || !modChatChannel) {
      throw new Error("Required channels were not created correctly.");
    }

    // 3b. Create booster-tickets panel channel (read-only for users, bot sends)
    await ticketsCategory.permissionOverwrites.set(
      buildTicketsCategoryOverwrites(
        guild.id,
        interaction.client.user.id,
        ownerRole.id,
        modRole.id,
        memberRole.id
      )
    );

    const ticketPanelOverwrites = buildTicketPanelOverwrites(
      guild.id,
      interaction.client.user.id,
      ownerRole.id,
      modRole.id,
      memberRole.id
    );

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

    const createResult = await db.createBoostServer({
      guild_id: guild.id,
      server_index: serverIndex,
      display_name: name,
      description: serverDescription,
      slug,
      owner_id: ownerId,
      category_id: category.id,
      tickets_category_id: ticketsCategory.id,
      channel_announcements_id: announcementsChannel.id,
      channel_leaderboard_id: leaderboardChannel.id,
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
    }, {
      enforceSingleOwner: !bypassOwnershipLimit,
    });

    const serverRecord = createResult?.record || null;

    if (!serverRecord) {
      // Rollback: delete all created resources
      console.error("[BOOSTSERVER] DB save failed, attempting rollback...");
      for (const ch of created.channels) await ch.delete("Rollback: DB save failed").catch(() => null);
      for (const cat of created.categories) await cat.delete("Rollback: DB save failed").catch(() => null);
      for (const r of created.roles) await r.delete("Rollback: DB save failed").catch(() => null);

      if (createResult?.error === "OWNER_LIMIT") {
        const existingOwned = createResult.existingOwned;
        return interaction.editReply({
          content: `❌ You already own a boost server: **${existingOwned?.display_name || "Unknown"}** (#${existingOwned?.server_index || "?"}). Each member may only own one.`,
        });
      }

      return interaction.editReply({
        content: "❌ Failed to save boost server to the database. Created channels and roles have been rolled back.",
      });
    }

    // 6. Auto-post ticket panel in booster-tickets (delay 2.5s after channel creation)
    try {
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const panelEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle(DEFAULT_TICKET_PANEL_TITLE)
        .setDescription(DEFAULT_TICKET_PANEL_DESCRIPTION)
        .setTimestamp(new Date())
        .setFooter({ text: `${name} • Ticket Panel` });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`ticket_create:${serverRecord.id}`)
        .setPlaceholder("Select a category to open a ticket")
        .addOptions(
          {
            label: "Boost Request",
            value: "cat_0",
            description: "Open a Boost Request ticket",
          },
          {
            label: "Questions",
            value: "cat_1",
            description: "Open a Questions ticket",
          }
        );
      const components = [new ActionRowBuilder().addComponents(selectMenu)];

      const existingConfig = await db.getTicketConfig(serverRecord.id);
      let panelMessage = null;

      if (existingConfig?.panel_message_id) {
        panelMessage = await ticketPanelChannel.messages.fetch(existingConfig.panel_message_id).catch(() => null);
      }

      if (!panelMessage) {
        const pinnedMessages = await ticketPanelChannel.messages.fetchPinned().catch(() => null);
        panelMessage = pinnedMessages?.find(
          (m) => m.author.id === interaction.client.user.id
            && m.embeds.length > 0
            && m.embeds[0].footer?.text?.includes("Ticket Panel")
        ) || null;
      }

      if (!panelMessage) {
        const recentMessages = await ticketPanelChannel.messages.fetch({ limit: 20 }).catch(() => null);
        panelMessage = recentMessages?.find(
          (m) => m.author.id === interaction.client.user.id
            && m.embeds.length > 0
            && m.embeds[0].footer?.text?.includes("Ticket Panel")
        ) || null;
      }

      if (panelMessage) {
        panelMessage = await panelMessage.edit({ embeds: [panelEmbed], components });
      } else {
        panelMessage = await ticketPanelChannel.send({ embeds: [panelEmbed], components });
      }

      if (panelMessage && !panelMessage.pinned) {
        await panelMessage.pin().catch(() => null);
      }

      await db.upsertTicketConfig(serverRecord.id, {
        title: DEFAULT_TICKET_PANEL_TITLE,
        description: DEFAULT_TICKET_PANEL_DESCRIPTION,
        categories: DEFAULT_TICKET_CATEGORIES,
        ping_mode: wizardPingMode || existingConfig?.ping_mode || "off",
        notifications_channel_id: sendLogsToModChat ? modChatChannel?.id || null : existingConfig?.notifications_channel_id || null,
        panel_message_id: panelMessage?.id || null,
        logs_to_mod_chat: sendLogsToModChat,
      });
    } catch (err) {
      console.error(
        `[BOOSTSERVER] Non-fatal: failed to auto-post ticket panel for server #${serverIndex} (${name}) in guild ${guild.id}: ${err.message}`,
        err
      );
    }

    // 7. Post/update structured header in announcements channel and keep it pinned
    try {
      const headerResult = await upsertPinnedBoostServerHeader(guild, serverRecord, serverDescription, interaction.client.user.id);
      if (!headerResult.ok) {
        console.error(`[BOOSTSERVER] Failed to post/pin header: ${headerResult.message}`);
      }
    } catch (err) {
      console.error(`[BOOSTSERVER] Failed to post/pin header: ${err.message}`);
    }

    // 8. Ephemeral confirmation to the user
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
          [announcementsChannel, leaderboardChannel, giveawaysChannel, eventsChannel, imagesChannel, chatChannel, modChatChannel, ticketPanelChannel]
            .filter(Boolean)
            .map((c) => `${c}`)
            .join("\n"),
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
      server.channel_announcements_id, server.channel_leaderboard_id, server.channel_giveaways_id,
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
    await sendBoostMemberWelcomeDM(guild, server, targetUser);

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
      server.channel_announcements_id, server.channel_leaderboard_id, server.channel_giveaways_id,
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

async function handleConfigSet(interaction, guild, server) {
  const repairResult = await repairBoostServerOverwrites(guild, server, interaction.client.user.id);

  if (!repairResult.ok) {
    return interaction.editReply({ content: `❌ ${repairResult.message}` });
  }

  return interaction.editReply({
    content: `✅ ${repairResult.message} for **${server.display_name}** (#${server.server_index}).`,
  });
}

// ── TICKET SETUP ──
async function handleTicketSetup(interaction, guild, server) {
  const title = interaction.options.getString("title", true).trim() || DEFAULT_TICKET_PANEL_TITLE;
  const description = interaction.options.getString("description", true).trim() || DEFAULT_TICKET_PANEL_DESCRIPTION;
  const categoriesRaw = interaction.options.getString("categories") || "";
  const pingMode = interaction.options.getString("ping") || "off";
  const notificationsChannel = interaction.options.getChannel("notifications_channel");

  // Parse categories (trimmed, deduped case-insensitive, max 6)
  // Fallback defaults are strict and always ensure at least 2 dropdown options.
  const defaultCategories = [...DEFAULT_TICKET_CATEGORIES];
  const inputCategories = categoriesRaw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const seenCategoryKeys = new Set();
  const dedupedCategories = [];
  for (const category of inputCategories) {
    const key = category.toLowerCase();
    if (seenCategoryKeys.has(key)) continue;
    seenCategoryKeys.add(key);
    dedupedCategories.push(category);
    if (dedupedCategories.length >= 6) break;
  }

  let categories = dedupedCategories;
  if (categories.length < 2) {
    categories = defaultCategories;
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

  // Repair ticket overwrites for existing servers without requiring recreation.
  // Keep tickets category private; allow PS Member read-only on booster-tickets channel.
  if (server.tickets_category_id) {
    const ticketsCategory = await guild.channels.fetch(server.tickets_category_id).catch(() => null);
    if (ticketsCategory) {
      await ticketsCategory.permissionOverwrites.set(
        buildTicketsCategoryOverwrites(
          guild.id,
          interaction.client.user.id,
          server.role_owner_id,
          server.role_mod_id,
          server.role_member_id
        )
      ).catch(() => null);
    }
  }

  await panelChannel.permissionOverwrites.set(
    buildTicketPanelOverwrites(
      guild.id,
      interaction.client.user.id,
      server.role_owner_id,
      server.role_mod_id,
      server.role_member_id
    )
  ).catch(() => null);

  try {
    const existingConfig = await db.getTicketConfig(server.id);

    // 1. Save config to DB
    const config = await db.upsertTicketConfig(server.id, {
      title,
      description,
      categories,
      ping_mode: pingMode,
      notifications_channel_id: notificationsChannel?.id || null,
      panel_message_id: existingConfig?.panel_message_id || null,
      logs_to_mod_chat: existingConfig?.logs_to_mod_chat ?? null,
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

    if (config?.panel_message_id) {
      panelMessage = await panelChannel.messages.fetch(config.panel_message_id).catch(() => null);
      if (panelMessage) {
        panelMessage = await panelMessage.edit({ embeds: [panelEmbed], components });
        panelUpdated = true;
      }
    }

    try {
      if (!panelUpdated) {
        const pinnedMessages = await panelChannel.messages.fetchPinned().catch(() => null);
        const pinnedPanel = pinnedMessages?.find(
          (m) => m.author.id === interaction.client.user.id && m.embeds.length > 0
            && m.embeds[0].footer?.text?.includes("Ticket Panel")
        );
        if (pinnedPanel) {
          panelMessage = await pinnedPanel.edit({ embeds: [panelEmbed], components });
          panelUpdated = true;
        }
      }

      if (!panelUpdated) {
        const messages = await panelChannel.messages.fetch({ limit: 20 });
        const existingPanel = messages.find(
          (m) => m.author.id === interaction.client.user.id && m.embeds.length > 0
            && m.embeds[0].footer?.text?.includes("Ticket Panel")
        );

        if (existingPanel) {
          panelMessage = await existingPanel.edit({ embeds: [panelEmbed], components });
          panelUpdated = true;
        }
      }
    } catch (err) {
      console.warn("[BOOSTSERVER] Could not fetch/update existing panel:", err.message);
    }

    if (!panelUpdated) {
      console.warn(`[BOOSTSERVER] No existing ticket panel found for server #${server.server_index}; creating a new panel message.`);
      panelMessage = await panelChannel.send({ embeds: [panelEmbed], components });
    }

    // Pin the panel message if not already pinned
    if (panelMessage && !panelMessage.pinned) {
      await panelMessage.pin().catch(() => null);
    }

    await db.upsertTicketConfig(server.id, {
      title,
      description,
      categories,
      ping_mode: pingMode,
      notifications_channel_id: notificationsChannel?.id || null,
      panel_message_id: panelMessage?.id || null,
      logs_to_mod_chat: config?.logs_to_mod_chat ?? null,
    });

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

function wizardKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function clearCreateWizard(state) {
  if (!state) return;
  if (state.timeout) clearTimeout(state.timeout);
  CREATE_WIZARDS_BY_KEY.delete(wizardKey(state.guildId, state.userId));
  CREATE_WIZARDS_BY_TOKEN.delete(state.token);
}

function isInteractionExpiredError(err) {
  const message = `${err?.message || ""}`.toLowerCase();
  return message.includes("unknown interaction") || message.includes("interaction has already been acknowledged");
}

async function safeInteractionSend(interaction, method, payload) {
  try {
    if (method === "reply") return await interaction.reply(payload);
    if (method === "update") return await interaction.update(payload);
    if (method === "showModal") return await interaction.showModal(payload);
    if (method === "followUp") return await interaction.followUp(payload);
    return null;
  } catch (err) {
    if (isInteractionExpiredError(err)) {
      console.warn(`[BOOSTSERVER] Wizard interaction expired during ${method}: ${err.message}`);
      return null;
    }
    throw err;
  }
}

function getActiveCreateWizard(token, interaction) {
  const state = CREATE_WIZARDS_BY_TOKEN.get(token);
  if (!state) return { state: null, reason: "missing" };

  if (Date.now() > state.expiresAt) {
    clearCreateWizard(state);
    return { state: null, reason: "expired" };
  }

  if (state.guildId !== interaction.guildId || state.userId !== interaction.user.id) {
    return { state: null, reason: "forbidden" };
  }

  return { state, reason: null };
}

function clearDescriptionEditState(state) {
  if (!state) return;
  if (state.timeout) clearTimeout(state.timeout);
  DESCRIPTION_EDITS_BY_TOKEN.delete(state.token);
}

function getActiveDescriptionEdit(token, interaction) {
  const state = DESCRIPTION_EDITS_BY_TOKEN.get(token);
  if (!state) return { state: null, reason: "missing" };

  if (Date.now() > state.expiresAt) {
    clearDescriptionEditState(state);
    return { state: null, reason: "expired" };
  }

  if (state.guildId !== interaction.guildId || state.userId !== interaction.user.id) {
    return { state: null, reason: "forbidden" };
  }

  return { state, reason: null };
}

async function handleDescriptionEditStart(interaction, guild) {
  try {
    const serverId = interaction.options.getString("server", true);
    const server = await db.getBoostServerById(serverId);

    if (!server || server.guild_id !== guild.id) {
      return interaction.reply({ content: "❌ Boost server not found.", ephemeral: true });
    }

    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    const isGuildOwner = guild.ownerId === interaction.user.id;
    const isServerOwner = server.owner_id === interaction.user.id;
    const hasManage = isAdmin || isGuildOwner || isServerOwner;

    if (!hasManage) {
      return interaction.reply({
        content: "⛔ Only the **PS Owner**, **Discord Server Owner**, or **Administrators** can update the description.",
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`bsdesc_modal:${server.id}`)
      .setTitle("Boost Server Setup — Step 1/5")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("bsdesc_description")
            .setLabel("Server Description")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(WIZARD_DESCRIPTION_MAX_LENGTH)
            .setRequired(false)
            .setValue(server.description || "")
        )
      );

    return interaction.showModal(modal);
  } catch (err) {
    console.error("[BOOSTSERVER] Description edit start error:", err);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: "❌ Failed to start description editor." });
    }
    return interaction.reply({ content: "❌ Failed to start description editor.", ephemeral: true });
  }
}

async function handleDescriptionEditModal(interaction) {
  try {
    const [, serverId] = interaction.customId.split(":");
    const guild = interaction.guild;

    if (!guild || !serverId) {
      return safeInteractionSend(interaction, "reply", { content: "❌ Invalid description editor request.", ephemeral: true });
    }

    const server = await db.getBoostServerById(serverId);
    if (!server || server.guild_id !== guild.id) {
      return safeInteractionSend(interaction, "reply", { content: "❌ Boost server not found.", ephemeral: true });
    }

    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    const isGuildOwner = guild.ownerId === interaction.user.id;
    const isServerOwner = server.owner_id === interaction.user.id;
    const hasManage = isAdmin || isGuildOwner || isServerOwner;

    if (!hasManage) {
      return safeInteractionSend(interaction, "reply", {
        content: "⛔ Only the **PS Owner**, **Discord Server Owner**, or **Administrators** can update the description.",
        ephemeral: true,
      });
    }

    const description = interaction.fields.getTextInputValue("bsdesc_description")?.trim() || "";
    if (description.length > WIZARD_DESCRIPTION_MAX_LENGTH) {
      return safeInteractionSend(interaction, "reply", {
        content: `❌ Description must be ${WIZARD_DESCRIPTION_MAX_LENGTH} characters or less.`,
        ephemeral: true,
      });
    }

    const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const state = {
      token,
      guildId: guild.id,
      userId: interaction.user.id,
      serverId: server.id,
      description,
      expiresAt: Date.now() + DESCRIPTION_EDIT_TTL_MS,
      timeout: setTimeout(() => {
        const live = DESCRIPTION_EDITS_BY_TOKEN.get(token);
        if (live) clearDescriptionEditState(live);
      }, DESCRIPTION_EDIT_TTL_MS),
    };

    DESCRIPTION_EDITS_BY_TOKEN.set(token, state);

    const previewEmbed = buildServerHeaderEmbed(server, description);
    return safeInteractionSend(interaction, "reply", {
      content: "Preview your updated server header below. Confirm to save and keep it pinned.",
      embeds: [previewEmbed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`bsdesc_confirm:${token}`)
            .setLabel("Confirm")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`bsdesc_cancel:${token}`)
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Danger)
        ),
      ],
      ephemeral: true,
    });
  } catch (err) {
    if (isInteractionExpiredError(err)) return null;
    console.error("[BOOSTSERVER] Description modal error:", err);
    return safeInteractionSend(interaction, "reply", { content: "❌ Failed to build description preview.", ephemeral: true });
  }
}

async function handleDescriptionEditButton(interaction) {
  try {
    const [action, token] = interaction.customId.split(":");
    const { state, reason } = getActiveDescriptionEdit(token, interaction);
    if (!state) {
      const message = reason === "forbidden"
        ? "⛔ This preview belongs to another user."
        : "⌛ This description preview has expired. Run `/boostserver description` again.";
      return safeInteractionSend(interaction, "reply", { content: message, ephemeral: true });
    }

    if (action === "bsdesc_cancel") {
      clearDescriptionEditState(state);
      return safeInteractionSend(interaction, "update", {
        content: "❎ Description update canceled.",
        embeds: [],
        components: [],
      });
    }

    if (action !== "bsdesc_confirm") {
      return safeInteractionSend(interaction, "reply", { content: "❌ Unknown description action.", ephemeral: true });
    }

    const guild = interaction.guild;
    const server = await db.getBoostServerById(state.serverId);
    if (!guild || !server || server.guild_id !== guild.id) {
      clearDescriptionEditState(state);
      return safeInteractionSend(interaction, "update", {
        content: "❌ Boost server not found.",
        embeds: [],
        components: [],
      });
    }

    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    const isGuildOwner = guild.ownerId === interaction.user.id;
    const isServerOwner = server.owner_id === interaction.user.id;
    const hasManage = isAdmin || isGuildOwner || isServerOwner;

    if (!hasManage) {
      clearDescriptionEditState(state);
      return safeInteractionSend(interaction, "update", {
        content: "⛔ Only the PS Owner, Discord Server Owner, or Administrators can update the description.",
        embeds: [],
        components: [],
      });
    }

    const updatedServer = await db.updateBoostServer(server.id, { description: state.description });
    if (!updatedServer) {
      clearDescriptionEditState(state);
      return safeInteractionSend(interaction, "update", {
        content: "❌ Failed to save description.",
        embeds: [],
        components: [],
      });
    }

    const headerResult = await upsertPinnedBoostServerHeader(guild, updatedServer, state.description, interaction.client.user.id);
    clearDescriptionEditState(state);

    if (!headerResult.ok) {
      return safeInteractionSend(interaction, "update", {
        content: `⚠️ Description saved, but header update failed: ${headerResult.message}`,
        embeds: [],
        components: [],
      });
    }

    return safeInteractionSend(interaction, "update", {
      content: `✅ Description updated for **${updatedServer.display_name}** and announcements header is pinned in <#${updatedServer.channel_announcements_id}>.`,
      embeds: [],
      components: [],
    });
  } catch (err) {
    if (isInteractionExpiredError(err)) return null;
    console.error("[BOOSTSERVER] Description button error:", err);
    return safeInteractionSend(interaction, "reply", { content: "❌ Failed to update description.", ephemeral: true });
  }
}

function toChannelDisplayName(key) {
  const map = {
    announcements: "announcements",
    leaderboard: "leaderboard",
    giveaways: "giveaways",
    events: "events",
    images: "images",
    chat: "chat",
    "mod-chat": "mod-chat",
  };
  return map[key] || key;
}

function buildStep2Payload(state) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`bswiz_channels:${state.token}`)
    .setPlaceholder("Select channels to create")
    .setMinValues(3)
    .setMaxValues(WIZARD_ALL_CHANNELS.length)
    .addOptions(
      WIZARD_ALL_CHANNELS.map((channelKey) => ({
        label: toChannelDisplayName(channelKey),
        value: channelKey,
        default: state.selectedChannels.includes(channelKey),
        description: WIZARD_REQUIRED_CHANNELS.includes(channelKey)
          ? "Required channel"
          : "Optional channel",
      }))
    );

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("Step 2/5 — Channel Selection")
    .setDescription(
      "Select which channels should be created.\n" +
      "**Required and always included:** announcements, leaderboard, chat, mod-chat."
    );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bswiz_step2_next:${state.token}`)
          .setLabel("Continue")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`bswiz_cancel:${state.token}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  };
}

function buildStep3Payload(state) {
  const publicEligibleSelectedChannels = state.selectedChannels.filter((channelKey) =>
    WIZARD_PUBLIC_ELIGIBLE_CHANNELS.includes(channelKey)
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId(`bswiz_public:${state.token}`)
    .setPlaceholder("Select public channels (optional)")
    .setMinValues(0)
    .setMaxValues(publicEligibleSelectedChannels.length)
    .addOptions(
      publicEligibleSelectedChannels.map((channelKey) => ({
        label: toChannelDisplayName(channelKey),
        value: channelKey,
        default: state.publicChannels.includes(channelKey),
        description: "Public channels are view-only for @everyone",
      }))
    );

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("Step 3/5 — Public Visibility")
    .setDescription(
      "Choose which channels (if any) should be publicly visible to everyone in this Discord. " +
      "If you select none, your boost server stays private. Public channels are view-only."
    );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bswiz_step3_next:${state.token}`)
          .setLabel("Continue")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`bswiz_cancel:${state.token}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  };
}

function buildStep4Payload(state) {
  const pingSelect = new StringSelectMenuBuilder()
    .setCustomId(`bswiz_ping:${state.token}`)
    .setPlaceholder("Ticket ping mode")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions([
      { label: "None", value: "off", default: state.ticketPingMode === "off" },
      { label: "Owner", value: "owner", default: state.ticketPingMode === "owner" },
      { label: "Mod", value: "mod", default: state.ticketPingMode === "mod" },
      { label: "Both", value: "both", default: state.ticketPingMode === "both" },
    ]);

  const logsSelect = new StringSelectMenuBuilder()
    .setCustomId(`bswiz_logs:${state.token}`)
    .setPlaceholder("Send logs to mod-chat?")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions([
      { label: "Yes", value: "yes", default: state.sendLogsToModChat },
      { label: "No", value: "no", default: !state.sendLogsToModChat },
    ]);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("Step 4/5 — Ticket + Logs Configuration")
    .setDescription("Set ticket ping mode and whether logs should go to mod-chat.");

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(pingSelect),
      new ActionRowBuilder().addComponents(logsSelect),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bswiz_step4_next:${state.token}`)
          .setLabel("Continue")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`bswiz_cancel:${state.token}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  };
}

function buildStep5Payload(state) {
  const summaryEmbed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("Step 5/5 — Confirm Boost Server Setup")
    .addFields(
      { name: "Name", value: state.name, inline: false },
      { name: "Description", value: state.description || "None", inline: false },
      { name: "Channels Selected", value: state.selectedChannels.map((c) => `• ${toChannelDisplayName(c)}`).join("\n"), inline: true },
      { name: "Public Channels", value: state.publicChannels.length > 0 ? state.publicChannels.map((c) => `• ${toChannelDisplayName(c)}`).join("\n") : "None (private)", inline: true },
      { name: "Ticket Ping Mode", value: state.ticketPingMode, inline: true },
      { name: "Send Logs to mod-chat", value: state.sendLogsToModChat ? "Yes" : "No", inline: true },
    )
    .setFooter({ text: "Wizard expires in 5 minutes" });

  return {
    embeds: [summaryEmbed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bswiz_confirm:${state.token}`)
          .setLabel("Confirm")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`bswiz_cancel:${state.token}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  };
}

function buildWizardActivePayload(state) {
  const stepLabel = {
    1: "Step 1/5 — Name & Description",
    2: "Step 2/5 — Channel Selection",
    3: "Step 3/5 — Public Visibility",
    4: "Step 4/5 — Ticket + Logs",
    5: "Step 5/5 — Confirmation",
  }[state.step] || "Setup Wizard";

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xF1C40F)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("Active Boost Server Wizard")
        .setDescription(`You already have an active wizard in this server. Current progress: **${stepLabel}**.`)
        .setFooter({ text: "Choose Resume to continue or Cancel to discard." }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`bswiz_resume:${state.token}`)
          .setLabel("Resume")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`bswiz_cancel:${state.token}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  };
}

async function handleCreateWizardStart(interaction, guild) {
  const key = wizardKey(guild.id, interaction.user.id);
  const existing = CREATE_WIZARDS_BY_KEY.get(key);
  if (existing && Date.now() <= existing.expiresAt) {
    return safeInteractionSend(interaction, "reply", {
      ...buildWizardActivePayload(existing),
      ephemeral: true,
    });
  }

  const bypassOwnershipLimit = canBypassSingleServerOwnershipLimit(interaction, guild);
  if (!bypassOwnershipLimit) {
    const existingOwned = await db.getBoostServerByOwner(guild.id, interaction.user.id);
    if (existingOwned) {
      return interaction.reply({
        content: `❌ You already own a boost server: **${existingOwned.display_name}** (#${existingOwned.server_index}). Each member may only own one.`,
        ephemeral: true,
      });
    }
  }

  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const state = {
    token,
    guildId: guild.id,
    userId: interaction.user.id,
    step: 1,
    name: "",
    description: "",
    selectedChannels: [...WIZARD_REQUIRED_CHANNELS],
    publicChannels: [],
    ticketPingMode: "off",
    sendLogsToModChat: false,
    expiresAt: Date.now() + CREATE_WIZARD_TTL_MS,
    timeout: setTimeout(() => {
      const live = CREATE_WIZARDS_BY_TOKEN.get(token);
      if (live) clearCreateWizard(live);
    }, CREATE_WIZARD_TTL_MS),
  };

  CREATE_WIZARDS_BY_KEY.set(key, state);
  CREATE_WIZARDS_BY_TOKEN.set(token, state);

  const modal = new ModalBuilder()
    .setCustomId(`bswiz_step1:${token}`)
    .setTitle("Boost Server Setup — Step 1/5")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("bswiz_name")
          .setLabel("Boost Server Name")
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(25)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("bswiz_description")
          .setLabel("Server Description")
          .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(WIZARD_DESCRIPTION_MAX_LENGTH)
          .setRequired(false)
      )
    );

  return safeInteractionSend(interaction, "showModal", modal);
}

async function handleCreateWizardModal(interaction) {
  try {
    const token = interaction.customId.split(":")[1];
    const { state, reason } = getActiveCreateWizard(token, interaction);
    if (!state) {
      const message = reason === "forbidden"
        ? "⛔ This wizard belongs to another user."
        : "⌛ This setup wizard has expired. Run `/boostserver create` again.";
      return safeInteractionSend(interaction, "reply", { content: message, ephemeral: true });
    }

    const name = interaction.fields.getTextInputValue("bswiz_name")?.trim();
    const description = interaction.fields.getTextInputValue("bswiz_description")?.trim() || "";

    if (!name) {
      return safeInteractionSend(interaction, "reply", { content: "❌ Server name cannot be blank.", ephemeral: true });
    }
    if (name.length > 25) {
      return safeInteractionSend(interaction, "reply", { content: "❌ Server name must be 25 characters or less.", ephemeral: true });
    }
    if (description.length > WIZARD_DESCRIPTION_MAX_LENGTH) {
      return safeInteractionSend(interaction, "reply", { content: `❌ Description must be ${WIZARD_DESCRIPTION_MAX_LENGTH} characters or less.`, ephemeral: true });
    }

    const existingName = await db.getBoostServerByName(interaction.guildId, name);
    if (existingName) {
      clearCreateWizard(state);
      return safeInteractionSend(interaction, "reply", {
        content: `❌ A boost server named **${existingName.display_name}** already exists. Please choose a different name.`,
        ephemeral: true,
      });
    }

    state.name = name;
    state.description = description;
    state.step = 2;

    return safeInteractionSend(interaction, "reply", { ...buildStep2Payload(state), ephemeral: true });
  } catch (err) {
    if (isInteractionExpiredError(err)) return null;
    console.error("[BOOSTSERVER] Wizard modal error:", err);
    return safeInteractionSend(interaction, "reply", { content: "❌ Failed to continue wizard. Please run `/boostserver create` again.", ephemeral: true });
  }
}

async function handleCreateWizardSelect(interaction) {
  try {
    const [prefix, token] = interaction.customId.split(":");
    const { state, reason } = getActiveCreateWizard(token, interaction);
    if (!state) {
      const message = reason === "forbidden"
        ? "⛔ This wizard belongs to another user."
        : "⌛ This setup wizard has expired. Run `/boostserver create` again.";
      return safeInteractionSend(interaction, "reply", { content: message, ephemeral: true });
    }

    if (prefix === "bswiz_channels") {
      const selected = new Set(interaction.values);
      for (const required of WIZARD_REQUIRED_CHANNELS) selected.add(required);
      state.selectedChannels = WIZARD_ALL_CHANNELS.filter((channelKey) => selected.has(channelKey));
      state.publicChannels = state.publicChannels.filter(
        (channelKey) => state.selectedChannels.includes(channelKey) && channelKey !== "mod-chat"
      );
      state.step = 2;
      return safeInteractionSend(interaction, "update", buildStep2Payload(state));
    }

    if (prefix === "bswiz_public") {
      state.publicChannels = interaction.values.filter(
        (channelKey) => state.selectedChannels.includes(channelKey) && channelKey !== "mod-chat"
      );
      state.step = 3;
      return safeInteractionSend(interaction, "update", buildStep3Payload(state));
    }

    if (prefix === "bswiz_ping") {
      const value = interaction.values[0];
      if (["off", "owner", "mod", "both"].includes(value)) {
        state.ticketPingMode = value;
      }
      state.step = 4;
      return safeInteractionSend(interaction, "update", buildStep4Payload(state));
    }

    if (prefix === "bswiz_logs") {
      state.sendLogsToModChat = interaction.values[0] === "yes";
      state.step = 4;
      return safeInteractionSend(interaction, "update", buildStep4Payload(state));
    }

    return safeInteractionSend(interaction, "reply", { content: "❌ Unknown wizard selection.", ephemeral: true });
  } catch (err) {
    if (isInteractionExpiredError(err)) return null;
    console.error("[BOOSTSERVER] Wizard select error:", err);
    return safeInteractionSend(interaction, "reply", { content: "❌ Failed to continue wizard. Please run `/boostserver create` again.", ephemeral: true });
  }
}

async function handleCreateWizardButton(interaction) {
  try {
    const [prefix, token] = interaction.customId.split(":");
    const { state, reason } = getActiveCreateWizard(token, interaction);
    if (!state) {
      const message = reason === "forbidden"
        ? "⛔ This wizard belongs to another user."
        : "⌛ This setup wizard has expired. Run `/boostserver create` again.";
      return safeInteractionSend(interaction, "reply", { content: message, ephemeral: true });
    }

    if (prefix === "bswiz_cancel") {
      clearCreateWizard(state);
      return safeInteractionSend(interaction, "update", { content: "❎ Boost server setup canceled.", embeds: [], components: [] });
    }

    if (prefix === "bswiz_resume") {
      if (state.step === 1) {
        const modal = new ModalBuilder()
          .setCustomId(`bswiz_step1:${state.token}`)
          .setTitle("Boost Server Setup — Step 1/5")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("bswiz_name")
                .setLabel("Boost Server Name")
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(25)
                .setRequired(true)
                .setValue(state.name || "")
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("bswiz_description")
                .setLabel("Server Description")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(WIZARD_DESCRIPTION_MAX_LENGTH)
                .setRequired(false)
                .setValue(state.description || "")
            )
          );
        return safeInteractionSend(interaction, "showModal", modal);
      }

      if (state.step === 2) return safeInteractionSend(interaction, "update", buildStep2Payload(state));
      if (state.step === 3) return safeInteractionSend(interaction, "update", buildStep3Payload(state));
      if (state.step === 4) return safeInteractionSend(interaction, "update", buildStep4Payload(state));
      return safeInteractionSend(interaction, "update", buildStep5Payload(state));
    }

    if (prefix === "bswiz_step2_next") {
      const hasRequiredChannels = WIZARD_REQUIRED_CHANNELS.every((channelKey) => state.selectedChannels.includes(channelKey));
      if (!hasRequiredChannels) {
        return safeInteractionSend(interaction, "reply", {
          content: "❌ Required channels must remain selected: announcements, leaderboard, chat, mod-chat.",
          ephemeral: true,
        });
      }

      state.publicChannels = state.publicChannels.filter(
        (channelKey) => state.selectedChannels.includes(channelKey) && channelKey !== "mod-chat"
      );
      state.step = 3;
      return safeInteractionSend(interaction, "update", buildStep3Payload(state));
    }

    if (prefix === "bswiz_step3_next") {
      const isSubset = state.publicChannels.every((channelKey) => state.selectedChannels.includes(channelKey));
      if (!isSubset) {
        return safeInteractionSend(interaction, "reply", {
          content: "❌ Public visibility channels must be selected in Step 2.",
          ephemeral: true,
        });
      }

      state.step = 4;
      return safeInteractionSend(interaction, "update", buildStep4Payload(state));
    }

    if (prefix === "bswiz_step4_next") {
      state.step = 5;
      return safeInteractionSend(interaction, "update", buildStep5Payload(state));
    }

    if (prefix === "bswiz_confirm") {
      await safeInteractionSend(interaction, "update", {
        content: "⏳ Creating your boost server...",
        embeds: [],
        components: [],
      });

      clearCreateWizard(state);
      return handleCreate(interaction, interaction.guild, state);
    }

    return safeInteractionSend(interaction, "reply", { content: "❌ Unknown wizard action.", ephemeral: true });
  } catch (err) {
    if (isInteractionExpiredError(err)) return null;
    console.error("[BOOSTSERVER] Wizard button error:", err);
    return safeInteractionSend(interaction, "reply", { content: "❌ Failed to continue wizard. Please run `/boostserver create` again.", ephemeral: true });
  }
}

async function handleJoinRequestButton(interaction) {
  const [action, token] = interaction.customId.split(":");
  const state = getJoinRequestByToken(token);
  if (!state || state.guildId !== interaction.guildId) {
    return interaction.reply({ content: "⌛ This join request is no longer pending.", ephemeral: true });
  }

  const guild = interaction.guild;
  const server = await db.getBoostServerById(state.serverId);
  if (!server || server.guild_id !== guild.id) {
    clearJoinRequest(state);
    return interaction.reply({ content: "❌ Boost server not found for this request.", ephemeral: true });
  }

  const member = interaction.member;
  const isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator);
  const isGuildOwner = guild.ownerId === interaction.user.id;
  const isOwnerRole = member.roles?.cache?.has(server.role_owner_id);
  const isModRole = member.roles?.cache?.has(server.role_mod_id);
  const authorized = isAdmin || isGuildOwner || isOwnerRole || isModRole;

  if (!authorized) {
    return interaction.reply({ content: "Not authorized.", ephemeral: true });
  }

  const requesterMember = await guild.members.fetch(state.requesterId).catch(() => null);
  const requesterUser = requesterMember?.user || await interaction.client.users.fetch(state.requesterId).catch(() => null);
  if (!requesterUser) {
    clearJoinRequest(state);
    return interaction.reply({ content: "❌ Requester could not be found.", ephemeral: true });
  }

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bsjoin_approve:${token}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`bsjoin_decline:${token}`)
      .setLabel("Decline")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true)
  );

  if (action === "bsjoin_approve") {
    const memberRoleId = server.role_member_id;
    const role = memberRoleId ? guild.roles.cache.get(memberRoleId) || await guild.roles.fetch(memberRoleId).catch(() => null) : null;
    if (!role || !requesterMember) {
      clearJoinRequest(state);
      return interaction.reply({ content: "❌ Unable to approve: member role or requester member not found.", ephemeral: true });
    }

    if (!requesterMember.roles.cache.has(role.id)) {
      await requesterMember.roles.add(role, `Join request approved for boost server #${server.server_index}`);
    }
    await sendBoostMemberWelcomeDM(guild, server, requesterUser);

    await interaction.update({ components: [disabledRow] }).catch(() => null);
    await interaction.channel.send(`✅ Join request approved for <@${state.requesterId}> by <@${interaction.user.id}>.`).catch(() => null);

    clearJoinRequest(state);
    return;
  }

  if (action === "bsjoin_decline") {
    const moderatorName = interaction.member?.displayName || interaction.user.username;
    await sendJoinDeclinedDM(requesterUser, server.display_name, moderatorName, server.server_index);

    await interaction.update({ components: [disabledRow] }).catch(() => null);
    await interaction.channel.send(`❌ Join request declined for <@${state.requesterId}> by <@${interaction.user.id}>.`).catch(() => null);

    clearJoinRequest(state);
    return;
  }

  return interaction.reply({ content: "❌ Unknown join request action.", ephemeral: true });
}

module.exports.handleCreateWizardModal = handleCreateWizardModal;
module.exports.handleCreateWizardSelect = handleCreateWizardSelect;
module.exports.handleCreateWizardButton = handleCreateWizardButton;
module.exports.handleDescriptionEditModal = handleDescriptionEditModal;
module.exports.handleDescriptionEditButton = handleDescriptionEditButton;
module.exports.handleLeadersRefreshButton = handleLeadersRefreshButton;
module.exports.handleOwnerTransferButton = handleOwnerTransferButton;
module.exports.handleJoinRequestButton = handleJoinRequestButton;
