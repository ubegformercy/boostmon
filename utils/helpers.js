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
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

function friendlyDiscordError(err) {
  const rawMsg = err?.rawError?.message || err?.message || "Unknown error";
  const code = err?.code ? ` (code ${err.code})` : "";
  const status = err?.status ? ` (HTTP ${err.status})` : "";
  return `${rawMsg}${code}${status}`;
}

module.exports = {
  BOOSTMON_ICON_URL,
  ACTIVE_GREEN,
  buildActiveTimerEmbed,
  formatMs,
  friendlyDiscordError,
};
