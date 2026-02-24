// services/streak.js — Streak system helpers (sync roles, update progress)
const db = require("../db");

// Note: client is injected lazily via init() to avoid circular deps
let _client = null;

function init(client) {
  _client = client;
}

async function syncStreakRoles(member, currentDays, streakRoles) {
  if (!member || !streakRoles.length) return;

  const rolesToAdd = [];
  const rolesToRemove = [];

  for (const sr of streakRoles) {
    if (currentDays >= sr.day_threshold) {
      if (!member.roles.cache.has(sr.role_id)) {
        rolesToAdd.push(sr.role_id);
      }
    } else {
      if (member.roles.cache.has(sr.role_id)) {
        rolesToRemove.push(sr.role_id);
      }
    }
  }

  if (rolesToAdd.length > 0) await member.roles.add(rolesToAdd).catch(() => null);
  if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove).catch(() => null);
}

async function updateStreakProgress(guildId, userId) {
  const now = new Date();
  let streak = await db.getUserStreak(guildId, userId);

  if (!streak) {
    streak = await db.upsertUserStreak(guildId, userId, {
      streak_start_at: now,
      save_tokens: 0,
      last_save_earned_at: now,
    });
  } else if (!streak.streak_start_at) {
    await db.upsertUserStreak(guildId, userId, {
      streak_start_at: now,
      updated_at: now,
    });
    streak.streak_start_at = now;
  }

  // Handle save token earning (1 every 30 days)
  const lastEarnedAt = streak.last_save_earned_at
    ? new Date(streak.last_save_earned_at)
    : new Date(streak.created_at);
  const daysSinceLastSave = Math.floor((now - lastEarnedAt) / (24 * 60 * 60 * 1000));

  if (daysSinceLastSave >= 30) {
    const newSaves = Math.floor(daysSinceLastSave / 30);
    await db.updateUserStreakSaves(guildId, userId, newSaves);
    await db.upsertUserStreak(guildId, userId, {
      last_save_earned_at: new Date(lastEarnedAt.getTime() + newSaves * 30 * 24 * 60 * 60 * 1000),
    });
  }

  // Check and apply streak roles
  const streakDays = Math.floor((now - new Date(streak.streak_start_at)) / (24 * 60 * 60 * 1000));
  const streakRoles = await db.getStreakRoles(guildId);
  const guild = _client?.guilds?.cache?.get(guildId);
  if (guild) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      await syncStreakRoles(member, streakDays, streakRoles);
    }
  }
}

module.exports = {
  init,
  syncStreakRoles,
  updateStreakProgress,
};
