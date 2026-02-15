// services/timer.js — Timer math operations (set/add/remove/clear)
const db = require("../db");
const { updateStreakProgress } = require("./streak");

async function addMinutesForRole(userId, roleId, minutes, guildId = null) {
  const expiresAt = await db.addMinutesForRole(userId, roleId, minutes, guildId);
  if (guildId) await updateStreakProgress(guildId, userId);
  return expiresAt;
}

async function setMinutesForRole(userId, roleId, minutes, warnChannelIdOrNull, guildId = null) {
  const expiresAt = await db.setMinutesForRole(userId, roleId, minutes, warnChannelIdOrNull ?? null, guildId);
  if (guildId) await updateStreakProgress(guildId, userId);
  return expiresAt;
}

function removeMinutesForRole(userId, roleId, minutes) {
  return db.removeMinutesForRole(userId, roleId, minutes);
}

function clearRoleTimer(userId, roleId) {
  return db.clearRoleTimer(userId, roleId);
}

async function getFirstTimedRoleId(userId) {
  return await db.getFirstTimedRoleForUser(userId);
}

module.exports = {
  addMinutesForRole,
  setMinutesForRole,
  removeMinutesForRole,
  clearRoleTimer,
  getFirstTimedRoleId,
};
