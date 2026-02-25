// utils/helpers.js — Shared utility helpers for BoostMon
const { EmbedBuilder } = require("discord.js");

const BOOSTMON_ICON_URL = "https://raw.githubusercontent.com/ubegformercy/nodejs/main/public/images/boostmon.png";
const ACTIVE_GREEN = 0x2ECC71;

function buildActiveTimerEmbed({ actor, targetUser, role, minutes, expiresAt, warnChannel }) {
  return new EmbedBuilder()
    .setColor(ACTIVE_GREEN)
    .setTitle("🟢 Timed Role Activated")
    .setTimestamp(new Date())
    .addFields(
      { name: "Command Run By", value: `${actor}`, inline: true },
      { name: "Target User", value: `${targetUser}`, inline: true },
      { name: "Role Assigned", value: `${role.name}`, inline: true },
      { name: "Duration", value: `${minutes} minute(s)`, inline: true },
      {
        name: "Expires",
        value: `<t:${Math.floor(expiresAt / 1000)}:F>\n(<t:${Math.floor(expiresAt / 1000)}:R>)`,
        inline: true,
      },
      {
        name: "Warning Channel",
        value: warnChannel ? `${warnChannel}` : "DMs",
        inline: true,
      }
    )
    .setFooter({ text: "BoostMon • Active Timer" });
}

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return days > 0 ? `[${days}d ${h}h ${m}m]` : `[${h}h ${m}m]`;
}

function formatPauseDuration(ms) {
  if (!ms || ms <= 0) return "[0m]";
  const totalMin = Math.floor(ms / 60000);
  return `[${totalMin}m]`;
}

function friendlyDiscordError(err) {
  const rawMsg = err?.rawError?.message || err?.message || "Unknown error";
  const code = err?.code ? ` (code ${err.code})` : "";
  const status = err?.status ? ` (HTTP ${err.status})` : "";
  return `${rawMsg}${code}${status}`;
}

function parseDuration(input) {
  // Parse flexible duration formats
  // Accepts: 1440, 1440m, 24h, 1d, 1d 12h, 5d, 299h, etc.
  // Examples: 1d, 24h, 1440m, 1440, 1d 12h 30m, 5d 2h, etc.
  if (!input || input.trim() === "") return null;

  let totalMinutes = 0;
  const parts = input.toLowerCase().trim().split(/\s+/);

  for (const part of parts) {
    const match = part.match(/^(\d+(?:\.\d+)?)([dhm]?)$/);
    if (!match) return null; // Invalid format

    const value = parseFloat(match[1]);
    const unit = match[2] || "m"; // Default to minutes

    if (unit === "d") {
      totalMinutes += value * 1440; // 1 day = 1440 minutes
    } else if (unit === "h") {
      totalMinutes += value * 60; // 1 hour = 60 minutes
    } else if (unit === "m") {
      totalMinutes += value; // minutes
    }
  }

  // Validate range: 1 minute to 43200 minutes (30 days)
  if (totalMinutes < 1 || totalMinutes > 43200) return null;
  
  return Math.floor(totalMinutes);
}

module.exports = {
  BOOSTMON_ICON_URL,
  ACTIVE_GREEN,
  buildActiveTimerEmbed,
  formatMs,
  formatPauseDuration,
  friendlyDiscordError,
  parseDuration,
};
