// discord/handlers/ticket.js — Ticket dropdown + button interaction handler
const { EmbedBuilder, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");

// In-memory cooldown map: "guildId:serverId:userId" → timestamp (ms)
const ticketCooldowns = new Map();
const COOLDOWN_MS = 60_000; // 60 seconds
const MAX_OPEN_TICKETS = 25;
const AUTO_CLOSE_MS = 10 * 60_000; // 10 minutes

// Track pending auto-close timers: ticketId → timeout handle
const autoCloseTimers = new Map();

/**
 * Handle ticket_create:{serverId} dropdown selection.
 * Called from interactionCreate when customId starts with "ticket_create:".
 */
async function handleTicketCreate(interaction) {
  const guild = interaction.guild;
  if (!guild) return;

  await interaction.deferReply({ ephemeral: true }).catch(() => null);

  // Parse serverId from customId
  const serverId = interaction.customId.split(":")[1];
  if (!serverId) {
    return interaction.editReply({ content: "❌ Invalid ticket panel." });
  }

  const server = await db.getBoostServerById(serverId);
  if (!server || server.guild_id !== guild.id) {
    return interaction.editReply({ content: "❌ Boost server not found." });
  }

  // 1. Verify user has PS Member, PS Mod, PS Owner, or Admin (abuse protection)
  const member = interaction.member;
  const isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator);
  const hasServerRole = member.roles?.cache?.has(server.role_owner_id)
    || member.roles?.cache?.has(server.role_mod_id)
    || member.roles?.cache?.has(server.role_member_id);

  if (!isAdmin && !hasServerRole) {
    return interaction.editReply({
      content: "⛔ You must be a member of this boost server to create a ticket.",
    });
  }

  // 2. Per-user cooldown (in-memory, resets on restart)
  const cooldownKey = `${guild.id}:${server.id}:${interaction.user.id}`;
  const lastAttempt = ticketCooldowns.get(cooldownKey);
  if (lastAttempt) {
    const elapsed = Date.now() - lastAttempt;
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return interaction.editReply({
        content: `⏳ Please wait **${remaining}** seconds before creating another ticket.`,
      });
    }
  }

  // 3. Global safety limit — max open/locked tickets per boost server
  const openCount = await db.countOpenTickets(server.id);
  if (openCount >= MAX_OPEN_TICKETS) {
    return interaction.editReply({
      content: "⚠️ This server has too many open tickets right now. Please wait or contact staff.",
    });
  }

  // Set cooldown timestamp (set early so rapid clicks are blocked)
  ticketCooldowns.set(cooldownKey, Date.now());

  // --- One-open-ticket-per-user enforcement ---
  const existingTicket = await db.getOpenTicketByUser(server.id, interaction.user.id);
  if (existingTicket) {
    // Edge case: channel was manually deleted — clean up stale record
    const existingChannel = await guild.channels.fetch(existingTicket.channel_id).catch(() => null);
    if (!existingChannel) {
      await db.updateTicketStatus(existingTicket.id, "closed");
    } else {
      return interaction.editReply({
        content: `⛔ You already have an open ticket: <#${existingTicket.channel_id}>. Please close it before creating a new one.`,
      });
    }
  }

  // Get the selected category
  const selectedValue = interaction.values[0]; // e.g. "cat_0"
  const config = await db.getTicketConfig(server.id);
  let categoryLabel = null;
  if (config?.categories && selectedValue?.startsWith("cat_")) {
    const catIndex = parseInt(selectedValue.split("_")[1], 10);
    categoryLabel = config.categories[catIndex] || null;
  }

  try {
    // 2. Atomic increment ticket counter
    const ticketNumber = await db.incrementTicketCounter(server.id);
    if (!ticketNumber) {
      return interaction.editReply({ content: "❌ Failed to generate ticket number." });
    }

    const paddedNumber = String(ticketNumber).padStart(4, "0");
    const channelName = `ticket-${paddedNumber}-${server.slug || "server"}`;

    // 3. Create ticket channel inside tickets category
    const ticketsCategoryId = server.tickets_category_id;
    if (!ticketsCategoryId) {
      return interaction.editReply({
        content: "❌ No tickets category found. The boost server may need to be recreated.",
      });
    }

    const ticketsCategory = await guild.channels.fetch(ticketsCategoryId).catch(() => null);
    if (!ticketsCategory) {
      return interaction.editReply({
        content: "❌ The tickets category no longer exists. It may have been manually deleted.",
      });
    }

    // 4. Channel permissions
    const permissionOverwrites = [
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
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
        ],
      },
    ];

    // Add PS Owner role
    if (server.role_owner_id) {
      permissionOverwrites.push({
        id: server.role_owner_id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      });
    }

    // Add PS Mod role
    if (server.role_mod_id) {
      permissionOverwrites.push({
        id: server.role_mod_id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      });
    }

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: ticketsCategoryId,
      permissionOverwrites,
    });

    // 5. Insert ticket row
    const ticket = await db.createTicket({
      boost_server_id: server.id,
      ticket_number: ticketNumber,
      creator_id: interaction.user.id,
      category_label: categoryLabel,
      channel_id: ticketChannel.id,
      status: "open",
    });

    if (!ticket) {
      await ticketChannel.delete("Rollback: DB insert failed").catch(() => null);
      return interaction.editReply({ content: "❌ Failed to save ticket. Channel has been cleaned up." });
    }

    // 6. Post header embed + buttons
    const headerEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`Ticket #${paddedNumber}${categoryLabel ? ` : ${categoryLabel}` : ""}`)
      .setDescription(
        `Opened by <@${interaction.user.id}>\n\n` +
        "Please write your message below. **Blank tickets close in 10 minutes.**"
      )
      .setTimestamp(new Date())
      .setFooter({ text: `${server.display_name} • Ticket System` });

    // 7. Buttons
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_close:${ticket.id}`)
        .setLabel("Close Ticket")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ticket_lock:${ticket.id}`)
        .setLabel("Close & Lock")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ticket_delete:${ticket.id}`)
        .setLabel("Delete Ticket")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Danger),
    );

    await ticketChannel.send({ embeds: [headerEmbed], components: [buttonRow] });

    // 8. Ping logic
    if (config && config.ping_mode !== "off") {
      const pings = [];
      if ((config.ping_mode === "mod" || config.ping_mode === "both") && server.role_mod_id) {
        pings.push(`<@&${server.role_mod_id}>`);
      }
      if ((config.ping_mode === "owner" || config.ping_mode === "both") && server.role_owner_id) {
        pings.push(`<@&${server.role_owner_id}>`);
      }

      if (pings.length > 0) {
        const pingMessage = `${pings.join(" ")} — New ticket #${paddedNumber} opened by <@${interaction.user.id}>`;

        // Send ping in the ticket channel
        await ticketChannel.send(pingMessage).catch(() => null);

        // Also send to notifications channel if configured
        if (config.notifications_channel_id) {
          const notifChannel = await guild.channels.fetch(config.notifications_channel_id).catch(() => null);
          if (notifChannel) {
            const notifEmbed = new EmbedBuilder()
              .setColor(0x3498DB)
              .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
              .setTitle(`🎫 New Ticket #${paddedNumber}`)
              .setDescription(
                `**Server:** ${server.display_name}\n` +
                `**Category:** ${categoryLabel || "General"}\n` +
                `**Opened by:** <@${interaction.user.id}>\n` +
                `**Channel:** <#${ticketChannel.id}>`
              )
              .setTimestamp(new Date())
              .setFooter({ text: `${server.display_name} • Ticket System` });

            await notifChannel.send({ content: pings.join(" "), embeds: [notifEmbed] }).catch(() => null);
          }
        }
      }
    }

    // 9. Schedule 10-minute auto-close for blank tickets
    scheduleAutoClose(interaction.client, ticket.id, ticketChannel.id, paddedNumber, server);

    // 10. Confirm to user
    return interaction.editReply({
      content: `✅ Ticket created: <#${ticketChannel.id}>`,
    });

  } catch (err) {
    console.error("[TICKET] Create error:", err);
    return interaction.editReply({ content: `❌ Failed to create ticket: ${err.message}` });
  }
}

/**
 * Handle ticket button interactions (close, lock, delete).
 * Called from interactionCreate when customId starts with "ticket_close:", "ticket_lock:", or "ticket_delete:".
 */
async function handleTicketButton(interaction) {
  const guild = interaction.guild;
  if (!guild) return;

  await interaction.deferReply({ ephemeral: true }).catch(() => null);

  const [action, ticketIdStr] = interaction.customId.split(":");
  const ticketId = parseInt(ticketIdStr, 10);
  if (!ticketId) {
    return interaction.editReply({ content: "❌ Invalid ticket." });
  }

  const ticket = await db.getTicketById(ticketId);
  if (!ticket) {
    return interaction.editReply({ content: "❌ Ticket not found in database." });
  }

  const server = await db.getBoostServerById(ticket.boost_server_id);
  if (!server) {
    return interaction.editReply({ content: "❌ Boost server not found." });
  }

  // Permission checks
  const member = interaction.member;
  const isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator);
  const isOwner = member.roles?.cache?.has(server.role_owner_id);
  const isMod = member.roles?.cache?.has(server.role_mod_id);
  const isCreator = interaction.user.id === ticket.creator_id;
  const isStaff = isAdmin || isOwner || isMod;

  // --- ❌ Close Ticket ---
  if (action === "ticket_close") {
    if (!isCreator && !isStaff) {
      return interaction.editReply({ content: "⛔ Only the ticket creator or staff can close this ticket." });
    }
    if (ticket.status === "closed") {
      return interaction.editReply({ content: "This ticket is already closed." });
    }
    return closeTicket(interaction, ticket, server, guild, "User action");
  }

  // --- 🔒 Close & Lock ---
  if (action === "ticket_lock") {
    if (!isStaff) {
      return interaction.editReply({ content: "⛔ Only staff (PS Mod / PS Owner / Admin) can lock tickets." });
    }
    if (ticket.status === "locked") {
      return interaction.editReply({ content: "This ticket is already locked." });
    }
    return lockTicket(interaction, ticket, server, guild);
  }

  // --- 🗑️ Delete Ticket ---
  if (action === "ticket_delete") {
    if (!isStaff) {
      return interaction.editReply({ content: "⛔ Only staff (PS Mod / PS Owner / Admin) can delete tickets." });
    }
    return deleteTicketAction(interaction, ticket, guild);
  }

  return interaction.editReply({ content: "❌ Unknown action." });
}

/**
 * Close a ticket: remove creator perms, rename channel, update DB.
 */
async function closeTicket(interaction, ticket, server, guild, reason) {
  try {
    // Cancel auto-close timer if pending
    cancelAutoClose(ticket.id);

    const channel = await guild.channels.fetch(ticket.channel_id).catch(() => null);
    if (!channel) {
      await db.updateTicketStatus(ticket.id, "closed");
      return interaction.editReply({ content: "⚠️ Channel not found. Ticket marked as closed in DB." });
    }

    // Remove creator permissions
    await channel.permissionOverwrites.delete(ticket.creator_id).catch(() => null);

    // Rename channel
    const paddedNumber = String(ticket.ticket_number).padStart(4, "0");
    const slug = server.slug || "server";
    await channel.setName(`closed-ticket-${paddedNumber}-${slug}`).catch(() => null);

    // Update DB
    await db.updateTicketStatus(ticket.id, "closed");

    // Post closure notice in channel
    const closeEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setDescription(`Ticket closed by ${interaction ? `<@${interaction.user.id}>` : "Auto-close"} — ${reason || "No reason"}`)
      .setTimestamp(new Date());

    await channel.send({ embeds: [closeEmbed] }).catch(() => null);

    if (interaction) {
      return interaction.editReply({ content: "✅ Ticket closed." });
    }
  } catch (err) {
    console.error("[TICKET] Close error:", err);
    if (interaction) {
      return interaction.editReply({ content: `❌ Failed to close ticket: ${err.message}` });
    }
  }
}

/**
 * Lock a ticket: remove creator perms, deny SendMessages for everyone, update DB.
 */
async function lockTicket(interaction, ticket, server, guild) {
  try {
    // Cancel auto-close timer if pending
    cancelAutoClose(ticket.id);

    const channel = await guild.channels.fetch(ticket.channel_id).catch(() => null);
    if (!channel) {
      await db.updateTicketStatus(ticket.id, "locked");
      return interaction.editReply({ content: "⚠️ Channel not found. Ticket marked as locked in DB." });
    }

    // Remove creator permissions
    await channel.permissionOverwrites.delete(ticket.creator_id).catch(() => null);

    // Lock channel — deny SendMessages for @everyone
    await channel.permissionOverwrites.edit(guild.id, {
      SendMessages: false,
      ViewChannel: false,
    }).catch(() => null);

    // Rename channel
    const paddedNumber = String(ticket.ticket_number).padStart(4, "0");
    const slug = server.slug || "server";
    await channel.setName(`locked-ticket-${paddedNumber}-${slug}`).catch(() => null);

    // Update DB
    await db.updateTicketStatus(ticket.id, "locked");

    // Post lock notice
    const lockEmbed = new EmbedBuilder()
      .setColor(0xF0B232)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setDescription(`Ticket locked by <@${interaction.user.id}>`)
      .setTimestamp(new Date());

    await channel.send({ embeds: [lockEmbed] }).catch(() => null);

    return interaction.editReply({ content: "🔒 Ticket closed & locked." });
  } catch (err) {
    console.error("[TICKET] Lock error:", err);
    return interaction.editReply({ content: `❌ Failed to lock ticket: ${err.message}` });
  }
}

/**
 * Delete a ticket: delete channel, remove DB record.
 */
async function deleteTicketAction(interaction, ticket, guild) {
  try {
    // Cancel auto-close timer if pending
    cancelAutoClose(ticket.id);

    const channel = await guild.channels.fetch(ticket.channel_id).catch(() => null);

    // Delete DB record first
    await db.deleteTicket(ticket.id);

    // Delete channel
    if (channel) {
      await channel.delete("Ticket deleted by staff").catch(() => null);
    }

    return interaction.editReply({ content: "🗑️ Ticket deleted." });
  } catch (err) {
    console.error("[TICKET] Delete error:", err);
    return interaction.editReply({ content: `❌ Failed to delete ticket: ${err.message}` });
  }
}

/**
 * Schedule auto-close: if no user messages within 10 minutes, close the ticket.
 */
function scheduleAutoClose(client, ticketId, channelId, paddedNumber, server) {
  // Cancel any existing timer for this ticket
  cancelAutoClose(ticketId);

  const timer = setTimeout(async () => {
    autoCloseTimers.delete(ticketId);
    try {
      const ticket = await db.getTicketById(ticketId);
      if (!ticket || ticket.status !== "open") return;

      const guild = client.guilds.cache.find(g => g.channels.cache.has(channelId))
        || await client.guilds.fetch().then(guilds => {
          for (const [, g] of guilds) return client.guilds.cache.get(g.id);
          return null;
        }).catch(() => null);

      if (!guild) return;

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        await db.updateTicketStatus(ticketId, "closed");
        return;
      }

      // Fetch messages — check if any non-bot message exists beyond the initial header
      const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
      if (!messages) return;

      const hasUserMessage = messages.some(m => !m.author.bot);
      if (hasUserMessage) return; // User posted something — don't auto-close

      // Auto-close: remove creator perms, rename, update DB
      await channel.permissionOverwrites.delete(ticket.creator_id).catch(() => null);

      const slug = server.slug || "server";
      await channel.setName(`closed-ticket-${paddedNumber}-${slug}`).catch(() => null);
      await db.updateTicketStatus(ticketId, "closed");

      const autoCloseEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setDescription("This ticket was automatically closed due to inactivity (no messages for 10 minutes).")
        .setTimestamp(new Date());

      await channel.send({ embeds: [autoCloseEmbed] }).catch(() => null);
    } catch (err) {
      console.error("[TICKET] Auto-close error:", err);
    }
  }, AUTO_CLOSE_MS);

  autoCloseTimers.set(ticketId, timer);
}

/**
 * Cancel a pending auto-close timer.
 */
function cancelAutoClose(ticketId) {
  const existing = autoCloseTimers.get(ticketId);
  if (existing) {
    clearTimeout(existing);
    autoCloseTimers.delete(ticketId);
  }
}

module.exports = { handleTicketCreate, handleTicketButton, cancelAutoClose };
