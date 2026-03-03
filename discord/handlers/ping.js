// discord/handlers/ping.js — /ping command handler
const { EmbedBuilder } = require("discord.js");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");

function formatUptime(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(" ");
}

module.exports = async function handlePing(interaction) {
  await interaction.deferReply().catch(() => null);

  const wsPing = Math.max(0, Math.round(interaction.client.ws.ping || 0));
  const commandLatency = Math.max(0, Date.now() - interaction.createdTimestamp);
  const uptime = formatUptime(interaction.client.uptime || 0);

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
    .setTitle("🏓 Pong! Bot Status")
    .setTimestamp(new Date())
    .addFields(
      { name: "Status", value: "🟢 Online", inline: true },
      { name: "API Latency", value: `**${wsPing}ms**`, inline: true },
      { name: "Command Latency", value: `**${commandLatency}ms**`, inline: true },
      { name: "Uptime", value: `**${uptime}**`, inline: false }
    )
    .setFooter({ text: "BoostMon • Health Check" });

  return interaction.editReply({ embeds: [embed] });
};
