// discord/handlers/info.js — /info command handler
const { EmbedBuilder } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL, formatMs, formatPauseDuration } = require("../../utils/helpers");

module.exports = async function handleInfo(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const userOption = interaction.options.getUser("user"); // optional
  const targetUser = userOption ?? interaction.user;
  const guild = interaction.guild;

  try {
    // Get member object for nickname
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    const memberNickname = member?.nickname || null;

    // Get in-game username from registration
    const registration = await db.getUserRegistration(guild.id, targetUser.id).catch(() => null);
    const inGameUsername = registration?.in_game_username || null;

    // Determine display name priority: nickname > in_game_username > discord username
    const displayName = memberNickname || inGameUsername || targetUser.username;

    // Build the title with user info
    const userTitle = `📊 ${displayName} (@${targetUser.username}) - (${inGameUsername || targetUser.username})`;

    // Fetch user's streak info
    const streak = await db.getUserStreak(guild.id, targetUser.id).catch(() => null);
    
    // Fetch user's timers across ALL guilds
    const allTimers = await db.getTimersForUser(targetUser.id).catch(() => []);
    
    // Fetch pause credits
    const pauseCredits = await db.getPauseCredits(targetUser.id, guild.id).catch(() => 0);

    // Build timers info and pause durations separately
    let timerInfo = "None";
    let pauseInfo = "None";
    const activeTimerLines = [];
    const pauseDurationLines = [];

    if (allTimers.length > 0) {
      for (const timer of allTimers) {
        try {
          const timerGuild = interaction.client.guilds.cache.get(timer.guild_id);
          const roleObj = timerGuild?.roles.cache.get(timer.role_id);
          const roleName = roleObj?.name || `Role ${timer.role_id}`;
          
          let remainingMs = Math.max(0, Number(timer.expires_at) - Date.now());
          if (timer.paused && timer.paused_remaining_ms) {
            remainingMs = Number(timer.paused_remaining_ms);
          }

          const timeText = formatMs(remainingMs);

          if (timer.paused && timer.pause_expires_at) {
            const pauseRemainingMs = Math.max(0, Number(timer.pause_expires_at) - Date.now());
            const pauseText = formatMs(pauseRemainingMs);
            activeTimerLines.push(`• ${roleName}: ${timeText}`);
            pauseDurationLines.push(`• ${roleName}: ${pauseText}`);
          } else {
            activeTimerLines.push(`• ${roleName}: ${timeText}`);
          }
        } catch (err) {
          console.error(`[INFO] Error processing timer:`, err);
        }
      }

      timerInfo = activeTimerLines.slice(0, 10).join("\n") || "None";
      if (pauseDurationLines.length > 0) {
        pauseInfo = pauseDurationLines.slice(0, 10).join("\n");
      }
    }

    // Streak info
    const streakDays = streak?.streak_days || 0;
    const saveTokens = streak?.streaksaves || 0;

    // Build embed
    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle(userTitle)
      .setTimestamp(new Date())
      .addFields(
        { name: "🔥 Boost Streak", value: `**${streakDays}** day(s)`, inline: true },
        { name: "💾 Streak Saves", value: `**${saveTokens}**`, inline: true },
        { name: "💳 Pause Credits", value: `**${pauseCredits}** min`, inline: true },
        { name: "⏱️ Active Timers", value: timerInfo || "None", inline: false }
      );

    // Add pause durations field if there are any paused timers
    if (pauseInfo !== "None") {
      embed.addFields(
        { name: "⏸️ Pause Durations", value: pauseInfo, inline: false }
      );
    }

    embed.setFooter({ text: `BoostMon • Requested by ${interaction.user.username}` });

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[INFO] Handler error:", err);
    return interaction.editReply({
      content: "❌ Failed to retrieve user info. Please try again."
    });
  }
};
