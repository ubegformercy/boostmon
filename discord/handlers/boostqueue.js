// discord/handlers/queue.js — /queue command handler
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");

module.exports = async function handleQueue(interaction, { client }) {
  if (!interaction.guild) {
    return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
  }

  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  // ---------- /queue add ----------
  if (subcommand === "add") {
    const userOption = interaction.options.getUser("user");
    const note = interaction.options.getString("note");

    let targetId = userOption?.id || interaction.user.id;
    let targetUser = userOption || interaction.user;

    // Only allow adding others if user is admin
    if (userOption && userOption.id !== interaction.user.id) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "⛔ Only **Server Owner** or users with **Administrator** permission can add others to the queue.",
          ephemeral: true
        });
      }
    }

    await interaction.deferReply({ ephemeral: true }).catch(() => null);

    // Check if user is already in queue
    const existingInQueue = await db.getQueueUser(targetId, guild.id);
    if (existingInQueue) {
      const embed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("⚠️ Already in Queue")
        .setTimestamp(new Date())
        .addFields(
          { name: "User", value: `${targetUser}`, inline: true },
          { name: "Status", value: `Already in position **#${existingInQueue.position_order}**`, inline: true }
        );

      if (existingInQueue.note) {
        embed.addFields({ name: "Note", value: existingInQueue.note, inline: false });
      }

      embed.setFooter({ text: "BoostMon • Boost Queue" });
      return interaction.editReply({ embeds: [embed] });
    }

    // Block only on active, UNPAUSED timers in this guild.
    // Paused timers are allowed to stay/join queue until resumed.
    const activeTimers = await db.getTimersForUser(targetId);
    const now = Date.now();
    const blockingTimers = activeTimers.filter(
      (t) => t.guild_id === guild.id && !t.paused && Number(t.expires_at || 0) > now
    );
    if (blockingTimers.length > 0) {
      const roleList = blockingTimers.map((t) => `<@&${t.role_id}>`).join(", ");
      const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("⛔ Active Unpaused Timer Detected")
        .setTimestamp(new Date())
        .addFields(
          { name: "User", value: `${targetUser}`, inline: true },
          { name: "Active Role(s)", value: roleList, inline: true }
        )
        .setDescription("Users with an active unpaused timed role cannot be added to the boost queue. Pause the timer first or wait for it to expire.")
        .setFooter({ text: "BoostMon • Boost Queue" });
      return interaction.editReply({ embeds: [embed] });
    }

    const queueEntry = await db.addToQueue(targetId, guild.id, note);
    if (!queueEntry) {
      return interaction.editReply({ content: "❌ Failed to add to the queue. Please try again." });
    }

    // Assign the configured queue role (if set)
    const queueRoleId = await db.getQueueRole(guild.id);
    if (queueRoleId) {
      const member = await guild.members.fetch(targetId).catch(() => null);
      if (member) {
        await member.roles.add(queueRoleId).catch(err =>
          console.warn(`Failed to assign queue role ${queueRoleId} to ${targetId}:`, err.message)
        );
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("✅ Added to Boost Queue")
      .setTimestamp(new Date())
      .addFields(
        { name: "User", value: `${targetUser}`, inline: true },
        { name: "Position", value: `#${queueEntry.position_order}`, inline: true },
        { name: "Added At", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      );

    if (note) {
      embed.addFields({ name: "Note", value: note, inline: false });
    }

    if (userOption && userOption.id !== interaction.user.id) {
      embed.addFields({ name: "Added By", value: `${interaction.user}`, inline: true });
    }

    if (queueRoleId) {
      embed.addFields({ name: "Role Assigned", value: `<@&${queueRoleId}>`, inline: true });
    }

    embed.setFooter({ text: "BoostMon • Boost Queue" });
    return interaction.editReply({ embeds: [embed] });
  }

  // ---------- /queue remove ----------
  if (subcommand === "remove") {
    const userOption = interaction.options.getUser("user");
    let targetId = userOption?.id || interaction.user.id;

    // Only allow removing others if user is admin
    if (userOption && userOption.id !== interaction.user.id) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "⛔ Only **Server Owner** or users with **Administrator** permission can remove others from the queue.",
          ephemeral: true
        });
      }
    }

    await interaction.deferReply({ ephemeral: true }).catch(() => null);

    const queueEntry = await db.getQueueUser(targetId, guild.id);
    if (!queueEntry) {
      const targetMention = userOption ? `<@${userOption.id}>` : "You are";
      return interaction.editReply({
        content: `${targetMention} not in the queue.`
      });
    }

    const removed = await db.removeFromQueue(targetId, guild.id);
    if (!removed) {
      return interaction.editReply({ content: "❌ Failed to remove from queue. Please try again." });
    }

    // Remove the configured queue role (if set)
    const queueRoleId = await db.getQueueRole(guild.id);
    if (queueRoleId) {
      const member = await guild.members.fetch(targetId).catch(() => null);
      if (member) {
        await member.roles.remove(queueRoleId).catch(err =>
          console.warn(`Failed to remove queue role ${queueRoleId} from ${targetId}:`, err.message)
        );
      }
    }

    const userMention = userOption ? `<@${userOption.id}>` : "You have been";
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("❌ Removed from Queue")
      .setTimestamp(new Date())
      .addFields(
        { name: "Status", value: `${userMention} removed from the boost queue.`, inline: false }
      )
      .setFooter({ text: "BoostMon • Boost Queue" });

    if (userOption && userOption.id !== interaction.user.id) {
      embed.addFields(
        { name: "Removed By", value: `${interaction.user}`, inline: true }
      );
    }

    return interaction.editReply({ embeds: [embed] });
  }

  // ---------- /queue status ----------
  if (subcommand === "status") {
    const userOption = interaction.options.getUser("user");
    const targetUser = userOption || interaction.user;

    // Only allow checking others if user is admin
    if (userOption && userOption.id !== interaction.user.id) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "⛔ Only **Server Owner** or users with **Administrator** permission can check other users' queue status.",
          ephemeral: true
        });
      }
    }

    await interaction.deferReply({ ephemeral: true }).catch(() => null);

    const position = await db.getUserQueuePosition(targetUser.id, guild.id);

    if (position === null) {
      const isSelf = targetUser.id === interaction.user.id;
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle(isSelf ? "Your Queue Status" : `Queue Status: ${targetUser.username}`)
        .setTimestamp(new Date())
        .addFields(
          { name: "Status", value: isSelf ? "You are **not** in the boost queue." : `${targetUser} is **not** in the boost queue.`, inline: false }
        )
        .setFooter({ text: "BoostMon • Boost Queue" });
      return interaction.editReply({ embeds: [embed] });
    }

    const queueEntry = await db.getQueueUser(targetUser.id, guild.id);
    const totalInQueue = (await db.getQueue(guild.id)).length;
    const isSelf = targetUser.id === interaction.user.id;

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(isSelf ? "🎯 Your Queue Status" : `🎯 Queue Status: ${targetUser.username}`)
      .setTimestamp(new Date())
      .addFields(
        { name: "Position", value: `#${position} of ${totalInQueue}`, inline: true },
        { name: "People Ahead", value: `${position - 1}`, inline: true }
      );

    if (queueEntry.note) {
      embed.addFields({ name: "Note", value: queueEntry.note, inline: false });
    }

    embed.addFields(
      { name: "Added At", value: `<t:${Math.floor(new Date(queueEntry.added_at).getTime() / 1000)}:R>`, inline: true }
    );

    embed.setFooter({ text: "BoostMon • Boost Queue" });
    return interaction.editReply({ embeds: [embed] });
  }

  // ---------- /queue list ----------
  if (subcommand === "list") {
    const channelOption = interaction.options.getChannel("channel");

    // If channel option is used, require admin
    if (channelOption) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "⛔ Only **Server Owner** or users with **Administrator** permission can post the queue to a channel.",
          ephemeral: true
        });
      }

      // Validate it's a text channel
      const channel = await guild.channels.fetch(channelOption.id).catch(() => null);
      if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
        return interaction.reply({
          content: "⛔ Please select a text or announcement channel.",
          ephemeral: true
        });
      }

      // Check bot can send to that channel
      const me = await guild.members.fetchMe();
      const perms = channel.permissionsFor(me);
      if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms?.has(PermissionFlagsBits.SendMessages)) {
        return interaction.reply({
          content: `⛔ I don't have permission to send messages in ${channel}.`,
          ephemeral: true
        });
      }
    }

    await interaction.deferReply({ ephemeral: true }).catch(() => null);

    const queue = await db.getQueue(guild.id, 50);

    if (queue.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("Boost Queue")
        .setTimestamp(new Date())
        .addFields(
          { name: "Status", value: "The boost queue is empty.", inline: false }
        )
        .setFooter({ text: "BoostMon • Boost Queue" });
      return interaction.editReply({ embeds: [embed] });
    }

    // Auto-prune: verify each user is still in the server, remove those who left
    let pruned = 0;
    for (const entry of queue) {
      const member = await guild.members.fetch(entry.user_id).catch(() => null);
      if (!member) {
        await db.removeFromQueue(entry.user_id, guild.id);
        pruned++;
      }
    }

    // Re-fetch the queue after pruning (positions were reordered by removeFromQueue)
    const cleanQueue = pruned > 0 ? await db.getQueue(guild.id, 50) : queue;

    if (cleanQueue.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("Boost Queue")
        .setTimestamp(new Date())
        .addFields(
          { name: "Status", value: `The boost queue is empty.${pruned > 0 ? ` (${pruned} member(s) who left the server were removed)` : ""}`, inline: false }
        )
        .setFooter({ text: "BoostMon • Boost Queue" });
      return interaction.editReply({ embeds: [embed] });
    }

    const lines = [];
    for (const entry of cleanQueue) {
      const member = await guild.members.fetch(entry.user_id).catch(() => null);
      const displayName = member
        ? (member.nickname || member.user.globalName || member.user.username)
        : `<@${entry.user_id}>`;
      const noteText = entry.note ? ` • ${entry.note}` : "";
      const addedAt = `<t:${Math.floor(new Date(entry.added_at).getTime() / 1000)}:R>`;
      const medal = entry.position_order === 1 ? "🥇" : entry.position_order === 2 ? "🥈" : entry.position_order === 3 ? "🥉" : "🔹";

      lines.push(`${medal} **#${entry.position_order}** • ${displayName} • Added ${addedAt}${noteText}`);
    }

    const description = lines.join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("🎯 Boost Queue")
      .setDescription(description)
      .setTimestamp(new Date());

    const footerParts = [`${cleanQueue.length} in queue`];
    if (pruned > 0) footerParts.push(`${pruned} removed (left server)`);
    embed.setFooter({ text: `BoostMon • ${footerParts.join(" • ")}` });

    // If admin specified a channel, post publicly there
    if (channelOption) {
      const channel = await guild.channels.fetch(channelOption.id).catch(() => null);
      if (channel) {
        await channel.send({ embeds: [embed] });
        return interaction.editReply({ content: `✅ Boost queue posted to ${channel}.` });
      }
    }

    return interaction.editReply({ embeds: [embed] });
  }
};
