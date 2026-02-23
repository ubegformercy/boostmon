// discord/handlers/info.js — /info command handler
const { EmbedBuilder } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL, formatMs } = require("../../utils/helpers");

module.exports = async function handleInfo(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const userOption = interaction.options.getUser("user"); // optional
  const targetUser = userOption ?? interaction.user;
  const guild = interaction.guild;

  try {
    // Fetch user's streak info
    const streak = await db.getUserStreak(guild.id, targetUser.id).catch(() => null);
    
    // Fetch user's timers
    const timers = await db.getTimersForUser(targetUser.id).catch(() => []);
    
    // Fetch pause credits
    const pauseCredits = await db.getPauseCredits(targetUser.id, guild.id).catch(() => 0);

    // Build timers info
    let timerInfo = "None";
    if (timers.length > 0) {
      const timerDetails = timers
        .map(t => {
          const roleObj = guild.roles.cache.get(t.role_id);
          const roleName = roleObj?.name || `Role ${t.role_id}`;
          const remainingMs = Math.max(0, Number(t.expires_at) - Date.now());
          const timeText = remainingMs > 0 ? formatMs(remainingMs) : "EXPIRED";
          const pauseStatus = t.paused ? " (⏸️ PAUSED)" : "";
          return `• **${roleName}**: ${timeText}${pauseStatus}`;
        })
        .slice(0, 5) // Show max 5 timers
        .join("\n");
      timerInfo = timerDetails || "None";
    }

    // Streak info
    const streakDays = streak?.streak_days || 0;
    const streakInfo = `${streakDays} day(s)`;
    const saveTokens = streak?.streaksaves || 0;

    // Build embed
    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(`📊 ${targetUser.username}'s Stats`)
      .setTimestamp(new Date())
      .addFields(
        { name: "🔥 Boost Streak", value: streakInfo, inline: true },
        { name: "💾 Streak Saves", value: `${saveTokens}`, inline: true },
        { name: "🎯 Server", value: guild.name, inline: true },
        { name: "⏱️ Active Timers", value: timerInfo, inline: false },
        { name: "💳 Pause Credits", value: `**${pauseCredits}** minute(s)`, inline: true }
      )
      .setFooter({ text: "BoostMon • User Info" });

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[INFO] Handler error:", err);
    return interaction.editReply({
      content: "❌ Failed to retrieve user info. Please try again."
    });
  }
};
