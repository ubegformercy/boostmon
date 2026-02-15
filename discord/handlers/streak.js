// discord/handlers/streak.js — /streak command handler
const { EmbedBuilder } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");

module.exports = async function handleStreak(interaction) {
  const guild = interaction.guild;
  if (!guild) {
    return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
  }

  const subcommand = interaction.options.getSubcommand();
  const group = interaction.options.getSubcommandGroup(false);

  if (group === "admin") {
    await interaction.deferReply().catch(() => null);
    if (!interaction.memberPermissions?.has("Administrator")) {
      return interaction.editReply({ content: "⛔ Only administrators can use this command.", ephemeral: true });
    }

    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount") || 1;

    if (subcommand === "grant-save") {
      await db.updateUserStreakSaves(guild.id, targetUser.id, amount);
      return interaction.editReply({ content: `✅ Granted ${amount} save token(s) to ${targetUser}.` });
    } else if (subcommand === "remove-save") {
      await db.updateUserStreakSaves(guild.id, targetUser.id, -amount);
      return interaction.editReply({ content: `✅ Removed ${amount} save token(s) from ${targetUser}.` });
    }
  }

  if (subcommand === "status") {
    await interaction.deferReply().catch(() => null);
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const streak = await db.getUserStreak(guild.id, targetUser.id);

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`🔥 Streak Status: ${targetUser.username}`)
      .setTimestamp(new Date());

    if (!streak || !streak.streak_start_at) {
      embed.setDescription(`${targetUser} does not have an active boost streak.`);
    } else {
      const days = Math.floor((Date.now() - new Date(streak.streak_start_at)) / (24 * 60 * 60 * 1000));
      const saves = streak.save_tokens || 0;

      embed.addFields(
        { name: "Current Streak", value: `**${days} days**`, inline: true },
        { name: "Streak Saves", value: `**${saves}**`, inline: true },
        { name: "Started On", value: `<t:${Math.floor(new Date(streak.streak_start_at).getTime() / 1000)}:D>`, inline: true }
      );

      if (streak.grace_period_until && new Date(streak.grace_period_until) > new Date()) {
        embed.addFields({ name: "🛡️ Grace Period", value: `Ends <t:${Math.floor(new Date(streak.grace_period_until).getTime() / 1000)}:R>`, inline: false });
      }
    }

    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === "leaderboard") {
    await interaction.deferReply().catch(() => null);
    const leaderboard = await db.getStreakLeaderboard(guild.id, 10);

    if (leaderboard.length === 0) {
      return interaction.editReply({ content: "No active boost streaks found in this server." });
    }

    const fields = leaderboard.map((entry, index) => {
      const days = Math.floor((Date.now() - new Date(entry.streak_start_at)) / (24 * 60 * 60 * 1000));
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔹";
      const displayName = entry.display_name || entry.username || `<@${entry.user_id}>`;
      return {
        name: `${medal} #${index + 1} - ${displayName}`,
        value: `**${days} Days** • ${entry.save_tokens} Saves`,
        inline: false
      };
    });

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("🏆 Streak Leaderboard")
      .setDescription("The longest uninterrupted boost streaks in the server!")
      .addFields(...fields)
      .setTimestamp(new Date())
      .setFooter({ text: "BoostMon • Longest Streaks" });

    return interaction.editReply({ embeds: [embed] });
  }
};
