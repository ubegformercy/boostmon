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

    // Build timers info (organize by guild)
    let timerInfo = "None";
    if (allTimers.length > 0) {
      const timersByGuild = {};
      
      for (const timer of allTimers) {
        try {
          const timerGuild = interaction.client.guilds.cache.get(timer.guild_id);
          const guildName = timerGuild?.name || `Guild ${timer.guild_id}`;
          
          if (!timersByGuild[guildName]) {
            timersByGuild[guildName] = [];
          }

          const roleObj = timerGuild?.roles.cache.get(timer.role_id);
          const roleName = roleObj?.name || `Role ${timer.role_id}`;
          
          let remainingMs = Math.max(0, Number(timer.expires_at) - Date.now());
          if (timer.paused && timer.paused_remaining_ms) {
            remainingMs = Number(timer.paused_remaining_ms);
          }

          const timeText = formatMs(remainingMs);
          let timerLine;

          if (timer.paused) {
            const pauseDuration = formatPauseDuration(timer.paused_remaining_ms);
            timerLine = `• ${roleName}: ${pauseDuration} • ${timeText}`;
          } else {
            timerLine = `• ${roleName}: ${timeText}`;
          }

          timersByGuild[guildName].push(timerLine);
        } catch (err) {
          console.error(`[INFO] Error processing timer:`, err);
        }
      }

      // Build final timer display
      const timerLines = [];
      for (const [guildName, timersList] of Object.entries(timersByGuild)) {
        timerLines.push(`**${guildName}**`);
        timerLines.push(...timersList.slice(0, 3)); // Max 3 per guild
      }

      timerInfo = timerLines.slice(0, 10).join("\n") || "None"; // Max 10 lines total
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
      )
      .setFooter({ text: `BoostMon • Requested by ${interaction.user.username}` });

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[INFO] Handler error:", err);
    return interaction.editReply({
      content: "❌ Failed to retrieve user info. Please try again."
    });
  }
};
