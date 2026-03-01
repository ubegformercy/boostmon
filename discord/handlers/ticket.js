// discord/handlers/ticket.js — Ticket dropdown + button interaction handler
const { EmbedBuilder, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");

// In-memory cooldown map: "guildId:serverId:userId" → timestamp (ms)
const ticketCooldowns = new Map();
const COOLDOWN_MS = 60_000; // 60 seconds
const MAX_OPEN_TICKETS = 25;

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

    // 9. Confirm to user
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

  // Placeholder — button handlers will be implemented in a future version
  const actionLabel = action.replace("ticket_", "");
  return interaction.editReply({
    content: `🚧 **Ticket ${actionLabel}** — Button handler is not yet implemented.`,
  });
}

module.exports = { handleTicketCreate, handleTicketButton };
