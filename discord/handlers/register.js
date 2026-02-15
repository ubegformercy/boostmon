// discord/handlers/register.js — /register command handler
const { EmbedBuilder } = require("discord.js");
const db = require("../../db");
const { BOOSTMON_ICON_URL, friendlyDiscordError } = require("../../utils/helpers");

module.exports = async function handleRegister(interaction) {
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const subcommand = interaction.options.getSubcommand();

  // ---------- /register user ----------
  if (subcommand === "user") {
    // Check if user is admin or owner
    if (!interaction.memberPermissions?.has("Administrator") &&
        interaction.user.id !== interaction.guild.ownerId) {
      return interaction.editReply({
        content: "⛔ Only **Server Owner** or users with **Administrator** permission can register other users.",
        ephemeral: true
      });
    }

    const discordUser = interaction.options.getUser("discorduser", true);
    const username = interaction.options.getString("username", true);
    const display = interaction.options.getString("display", true);

    try {
      const registration = await db.registerUser({
        guild_id: interaction.guild.id,
        discord_id: discordUser.id,
        discord_username: discordUser.username,
        in_game_username: username,
        display_name: display,
        registered_by: interaction.user.id,
        registered_at: new Date()
      });

      if (!registration) {
        return interaction.editReply({ content: "❌ Failed to register user. Please try again." });
      }

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("✅ User Registered")
        .setTimestamp(new Date())
        .addFields(
          { name: "Discord User", value: `${discordUser}`, inline: true },
          { name: "In-Game Username", value: username, inline: true },
          { name: "Display Name", value: display, inline: true },
          { name: "Registered By", value: `${interaction.user}`, inline: true }
        )
        .setFooter({ text: "BoostMon • User Registration" });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("Error registering user:", err);
      return interaction.editReply({
        content: "❌ Error registering user: " + friendlyDiscordError(err),
        ephemeral: true
      });
    }
  }

  // ---------- /register in-game ----------
  if (subcommand === "in-game") {
    const username = interaction.options.getString("username", true);
    const display = interaction.options.getString("display", true);

    try {
      const registration = await db.registerUser({
        guild_id: interaction.guild.id,
        discord_id: interaction.user.id,
        discord_username: interaction.user.username,
        in_game_username: username,
        display_name: display,
        registered_by: interaction.user.id,
        registered_at: new Date()
      });

      if (!registration) {
        return interaction.editReply({ content: "❌ Failed to register. Please try again." });
      }

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("✅ Registration Complete")
        .setTimestamp(new Date())
        .addFields(
          { name: "Discord User", value: `${interaction.user}`, inline: true },
          { name: "In-Game Username", value: username, inline: true },
          { name: "Display Name", value: display, inline: true }
        )
        .setFooter({ text: "BoostMon • User Registration" });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("Error registering user:", err);
      return interaction.editReply({
        content: "❌ Error during registration: " + friendlyDiscordError(err),
        ephemeral: true
      });
    }
  }
};
