# 🌍 Multi-Server Setup Guide - BoostMon

**Version:** 2.2.0  
**Date:** January 31, 2026  
**Status:** ✅ Production Ready

---

## 📋 Quick Summary

BoostMon now supports **unlimited servers** with a single bot instance. You have **two deployment options**:

| Mode | Setup | Servers | Speed | GUILD_ID |
|------|-------|---------|-------|----------|
| **Global Commands** ⭐ | Easy | Unlimited | 15-60 min sync | Not set |
| **Single Server** | Easy | 1 server | Instant | Required |

---

## 🚀 Option A: Global Commands (RECOMMENDED)

Use this for a bot that works on **any/all Discord servers**.

### Setup Steps

1. **Remove DISCORD_GUILD_ID** from Railway environment variables:
   - Go to Railway Dashboard → Your Project
   - Go to Variables section
   - **Delete** the `DISCORD_GUILD_ID` variable
   - Redeploy

2. **That's it!** The code now automatically:
   - Detects that `GUILD_ID` is empty
   - Registers commands globally
   - Works on ALL servers

### Timeline

- ✅ **Instant:** Bot logs show "GUILD_ID not set: bot will work on ALL servers"
- ⏳ **5 minutes:** Commands appear in test server
- ⏳ **15-60 minutes:** Commands fully synced across Discord

### How It Works

```javascript
// New logic in app.js (auto-detects):
if (GUILD_ID) {
  // Single server mode (backward compatible)
  Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
} else {
  // Global mode (new!)
  Routes.applicationCommands(CLIENT_ID)
}
```

### Logs You'll See

```
[MULTI-SERVER] GUILD_ID not set: bot will work on ALL servers (global commands)
Registering commands as: global (all servers)
```

---

## 🎯 Option B: Single Server (If You Prefer)

Use this for a bot dedicated to ONE server.

### Setup Steps

1. **Keep DISCORD_GUILD_ID** in Railway:
   ```
   DISCORD_GUILD_ID=YOUR_SERVER_ID
   ```

2. **Redeploy**

### Logs You'll See

```
[MULTI-SERVER] Using GUILD_ID mode: bot restricted to server 123456789
Registering commands as: guild (123456789)
```

### Multiple Servers?

If you want multiple dedicated bots:
- Create separate Railway projects
- Give each bot a unique `DISCORD_GUILD_ID`
- Each bot instance serves ONE server

---

## 🗄️ Database: Already Multi-Server Safe

**Good news:** Your database is already ready for multiple servers!

Every table has a `guild_id` column:

```sql
-- role_timers table
user_id, role_id, guild_id ← Groups timers by server

-- rolestatus_schedules table
guild_id, role_id, channel_id ← Each server has separate schedules

-- autopurge_settings table
guild_id, channel_id ← Each server has separate settings
```

**Result:** When you add the bot to Server A and Server B:
- Server A's timers stay separate from Server B's
- No data collision
- No migration needed ✅

---

## ✅ Migration Checklist

- [x] Code supports both global and single-server modes
- [x] Database already multi-server safe
- [x] No data loss or corruption risk
- [x] Backward compatible (existing GUILD_ID still works)
- [x] Automatic detection (no extra config needed)
- [x] Tested and deployed

---

## 📊 Deployment Comparison

### Global Commands (Recommended)

**Pros:**
- Works on unlimited servers
- No per-server configuration
- One bot instance handles everything
- Easy to scale

**Cons:**
- 15-60 min for Discord to sync commands
- Commands visible on ALL servers

**Best for:**
- Public/shared bots
- Multi-community deployments
- Maximum flexibility

### Single Server

**Pros:**
- Instant command availability
- Private to one server
- Easy to manage

**Cons:**
- Need separate bot per server
- Can't scale easily
- Must redeploy for each server

**Best for:**
- Private/internal bots
- Single community
- Dedicated bot per server

---

## 🔍 Verification Steps

After deploying, verify it works:

### 1. Check Logs
```
Railway Logs → Look for:
✅ [MULTI-SERVER] GUILD_ID not set: bot will work on ALL servers
✅ Registering commands as: global (all servers)
```

### 2. Test on Any Server
- Invite bot to any Discord server
- Wait 5-10 minutes
- Type `/settime @user 5 @role` 
- Should work! ✅

### 3. Verify Data Isolation
- Use bot on Server A (create a timer)
- Use bot on Server B (create a timer)
- Check in database:
  ```sql
  SELECT guild_id, user_id, role_id FROM role_timers;
  ```
- Both servers' data visible but separate ✅

---

## 🛠️ Troubleshooting

### Commands not appearing after 15 minutes?

**Solution:**
1. Remove and re-add bot to server
2. Or wait up to 60 minutes (Discord's sync time)
3. Check bot has proper permissions (Manage Roles, Send Messages)

### Commands only work on one server?

**Check:**
- Is `DISCORD_GUILD_ID` still set in Railway? 
  - If yes, you're in single-server mode ❌
  - Delete it to go global ✅

### Timers showing on wrong server?

**This won't happen** - database has `guild_id` separation
- Each server's data is isolated
- No cross-server contamination

### Need to go back to single server?

**Easy:** Just set `DISCORD_GUILD_ID` again:
```
DISCORD_GUILD_ID=YOUR_SERVER_ID
```
Redeploy, and bot switches modes automatically.

---

## 📈 Scaling Path

**Current (Single Server):**
```
Bot Instance → Server A
              (uses GUILD_ID)
```

**After Global Setup:**
```
Bot Instance → Server A ✅
            → Server B ✅
            → Server C ✅
            → ... any server ✅
```

**Database handles all:**
```
PostgreSQL
├─ Server A data (guild_id = 123)
├─ Server B data (guild_id = 456)
└─ Server C data (guild_id = 789)
   All isolated ✅
```

---

## 🎓 Understanding Discord Command Registration

### Guild Commands (Old Method)
- Registered for ONE specific Discord server
- Instant availability (no sync time)
- Private to that server
- Need separate bot per server

### Global Commands (New Method)
- Registered for ALL Discord servers
- Appears everywhere bot is installed
- 15-60 min for Discord's sync
- Single bot works everywhere

---

## ❓ FAQ

**Q: Can I use the bot on 100 servers?**  
A: Yes! One bot instance, unlimited servers with global commands.

**Q: Will my data be mixed up between servers?**  
A: No. Database separates by `guild_id` automatically.

**Q: Do I need to do anything else?**  
A: Just remove the `GUILD_ID` variable and redeploy.

**Q: Can I switch back to single-server?**  
A: Yes. Set `GUILD_ID` again anytime.

**Q: Why is the sync time 15-60 minutes?**  
A: That's Discord's system - they batch sync commands globally.

**Q: Does this affect my current timers?**  
A: No. All existing data preserved. Zero migration needed.

**Q: What if I have 10,000 users across 50 servers?**  
A: Database handles it fine. Each server's data isolated.

---

## 📞 Support

- 🐛 **Bug Reports:** GitHub Issues
- 💬 **Questions:** Check troubleshooting above
- 🚀 **Feature Requests:** GitHub Discussions

---

## Summary

| Before | After |
|--------|-------|
| Single server only | Unlimited servers |
| Must change GUILD_ID per server | Works everywhere |
| Can't scale | Scales infinitely |
| 1:1 bot-to-server ratio | N:1 bot-to-server ratio |

**Result:** One bot, unlimited Discord servers. 🎉

Deploy now with confidence - **your data is safe and ready!**
