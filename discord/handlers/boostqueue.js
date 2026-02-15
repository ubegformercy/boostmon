// discord/handlers/boostqueue.js — /boostqueue command handler
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");

module.exports = async function handleBoostqueue(interaction, { client }) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  // ---------- /boostqueue add ----------
  if (subcommand === "add") {
    const userOption = interaction.options.getUser("user");
    const note = interaction.options.getString("note");

    let targetId = userOption?.id || interaction.user.id;
    let targetUser = userOption || interaction.user;

    // Only allow adding others if user is admin
    if (userOption && userOption.id !== interaction.user.id) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({
          content: "⛔ Only **Server Owner** or users with **Administrator** permission can add others to the queue.",
          ephemeral: true
        });
      }
    }

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

    const queueEntry = await db.addToQueue(targetId, guild.id, note);
    if (!queueEntry) {
      return interaction.editReply({ content: "❌ Failed to add to the queue. Please try again." });
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

    embed.setFooter({ text: "BoostMon • Boost Queue" });
    return interaction.editReply({ embeds: [embed] });
  }

  // ---------- /boostqueue remove ----------
  if (subcommand === "remove") {
    const userOption = interaction.options.getUser("user");
    let targetId = userOption?.id || interaction.user.id;

    // Only allow removing others if user is admin
    if (userOption && userOption.id !== interaction.user.id) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({
          content: "⛔ Only **Server Owner** or users with **Administrator** permission can remove others from the queue.",
          ephemeral: true
        });
      }
    }

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

  // ---------- /boostqueue view ----------
  if (subcommand === "view") {
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

    const fields = [];
    for (const entry of queue) {
      const user = await client.users.fetch(entry.user_id).catch(() => null);
      const userName = user ? user.username : `<@${entry.user_id}>`;
      const noteText = entry.note ? ` • ${entry.note}` : "";
      const addedAt = new Date(entry.added_at).toLocaleString();

      fields.push({
        name: `#${entry.position_order} - ${userName}`,
        value: `Added: ${addedAt}${noteText}`,
        inline: false
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("🎯 Boost Queue")
      .setTimestamp(new Date())
      .addFields(...fields)
      .addFields(
        { name: "Total in Queue", value: `${queue.length}`, inline: true }
      )
      .setFooter({ text: "BoostMon • Boost Queue" });

    return interaction.editReply({ embeds: [embed] });
  }

  // ---------- /boostqueue status ----------
  if (subcommand === "status") {
    const position = await db.getUserQueuePosition(interaction.user.id, guild.id);

    if (position === null) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("Your Queue Status")
        .setTimestamp(new Date())
        .addFields(
          { name: "Status", value: "You are **not** in the boost queue.", inline: false }
        )
        .setFooter({ text: "BoostMon • Boost Queue" });
      return interaction.editReply({ embeds: [embed] });
    }

    const queueEntry = await db.getQueueUser(interaction.user.id, guild.id);
    const totalInQueue = (await db.getQueue(guild.id)).length;

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("🎯 Your Queue Status")
      .setTimestamp(new Date())
      .addFields(
        { name: "Your Position", value: `#${position} of ${totalInQueue}`, inline: true },
        { name: "People Ahead", value: `${position - 1}`, inline: true }
      );

    if (queueEntry.note) {
      embed.addFields({ name: "Your Note", value: queueEntry.note, inline: false });
    }

    embed.addFields(
      { name: "Added At", value: `<t:${Math.floor(new Date(queueEntry.added_at).getTime() / 1000)}:R>`, inline: true }
    );

    embed.setFooter({ text: "BoostMon • Boost Queue" });
    return interaction.editReply({ embeds: [embed] });
  }

  // ---------- /boostqueue complete ----------
  if (subcommand === "complete") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.editReply({
        content: "⛔ Only **Server Owner** or users with **Administrator** permission can mark users as completed.",
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser("user", true);
    const queueEntry = await db.getQueueUser(targetUser.id, guild.id);

    if (!queueEntry) {
      return interaction.editReply({
        content: `<@${targetUser.id}> is not in the queue.`
      });
    }

    const completed = await db.completeQueue(targetUser.id, guild.id, interaction.user.id);
    if (!completed) {
      return interaction.editReply({ content: "❌ Failed to mark as completed. Please try again." });
    }

    // Get the next person in queue
    const nextInQueue = (await db.getQueue(guild.id, 1))[0];

    const embed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("✅ Boost Completed")
      .setTimestamp(new Date())
      .addFields(
        { name: "User", value: `<@${targetUser.id}>`, inline: true },
        { name: "Completed By", value: `${interaction.user}`, inline: true }
      );

    if (nextInQueue) {
      embed.addFields(
        { name: "Next in Queue", value: `<@${nextInQueue.user_id}> (Position #1)`, inline: false }
      );
    } else {
      embed.addFields(
        { name: "Next in Queue", value: "Queue is now empty! 🎉", inline: false }
      );
    }

    const reply = await interaction.editReply({ embeds: [embed] });

    // Try to DM the next person
    if (nextInQueue) {
      try {
        const nextUser = await client.users.fetch(nextInQueue.user_id);
        const dmEmbed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
          .setTitle("🎉 You're Next!")
          .setDescription(`You've been promoted to **#1** in the boost queue for **${guild.name}**!`)
          .setTimestamp(new Date())
          .setFooter({ text: "BoostMon • Boost Queue" });

        await nextUser.send({ embeds: [dmEmbed] }).catch(() => null);
      } catch (err) {
        console.warn(`Failed to DM user ${nextInQueue.user_id}:`, err.message);
      }
    }

    return reply;
  }
};
