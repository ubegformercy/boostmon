# 🚀 Railway Deployment Guide - BoostMon

**Status:** Production Ready | **Version:** 2024 | **Last Updated:** January 2026

---

## Quick Start: Deploy to Railway in 5 Minutes

This guide will walk you through deploying BoostMon to Railway with the Scheduled Role Status feature.

---

## Prerequisites

Before you start, ensure you have:

1. ✅ **GitHub Account** - Connected to your BoostMon repository
2. ✅ **Railway Account** - Sign up at [railway.app](https://railway.app)
3. ✅ **Discord Bot Token** - From Discord Developer Portal
4. ✅ **Discord Client ID** - From Discord Developer Portal
5. ✅ **Discord Guild ID** - Your test Discord server ID

---

## Step 1: Push Code to GitHub

Commit all changes and push to your repository:

```bash
cd /workspaces/nodejs
git add -A
git commit -m "feat: add scheduled role status reporting feature"
git push origin main
```

**Expected Output:**
```
main -> main
✓ Code pushed to GitHub
```

---

## Step 2: Connect Railway to GitHub

1. Go to [Railway Dashboard](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your **ubegformercy/nodejs** repository
4. Click **"Deploy Now"**

Railway will start building and deploying automatically.

---

## Step 3: Configure Environment Variables

In Railway dashboard, go to your project and set these environment variables:

| Variable | Value | Source |
|----------|-------|--------|
| `DISCORD_TOKEN` | Your bot token | Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Your client ID | Discord Developer Portal |
| `DISCORD_GUILD_ID` | Your server ID | Your Discord server |
| `DATABASE_URL` | Auto-created by Railway | (See Step 4 below) |

### How to find your Discord credentials:

**Discord Token & Client ID:**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your BoostMon application
3. Go to **"Bot"** section
4. Copy **Token** and **Application ID** (Client ID)

**Guild ID (Server ID):**
1. Enable **Developer Mode** in Discord (User Settings → Advanced → Developer Mode)
2. Right-click your server name → **Copy Server ID**

---

## Step 4: Add PostgreSQL Database

Railway provides PostgreSQL automatically, but you need to add it to your project:

1. In your Railway project, click **"Add"** (+ icon)
2. Select **"Database"** → **"PostgreSQL"**
3. Wait for database to provision (~30 seconds)
4. The `DATABASE_URL` will be automatically set as an environment variable

**Verify it's set:**
```bash
echo $DATABASE_URL  # Should show: postgres://...
```

---

## Step 5: Deploy

Once all environment variables are set, Railway will automatically redeploy with the new configuration.

**To manually trigger deploy:**
1. Go to your Railway project
2. Click the **"Deploy"** button
3. Wait for status to show **"Active"** (green checkmark)

---

## Step 6: Verify Deployment

Check that BoostMon is running:

1. **Check Railway Logs:**
   - Go to Railway project → Logs tab
   - Look for: `BoostMon logged in as [BOT_NAME]`
   - Should see: `✓ Database schema initialized`

2. **Test in Discord:**
   - Go to your test server
   - Run: `/settime @yourself 60 @testrole`
   - Bot should respond instantly
   - Check remaining time: `/showtime @yourself`

3. **Test Scheduled Reports:**
   - Run: `/rolestatus schedule set @testrole #notifications 15`
   - Should create a 15-minute scheduled report
   - List schedules: `/rolestatus schedule list`
   - Should see your new schedule

---

## Environment Variables Reference

### Required Variables

```
DISCORD_TOKEN=<your-bot-token-from-discord-developer-portal>
DISCORD_CLIENT_ID=<your-client-id-from-discord-developer-portal>
DISCORD_GUILD_ID=<your-guild-id-from-discord>
DATABASE_URL=<auto-set-by-railway-postgresql>
```

⚠️ **SECURITY NOTES:**
- Never hardcode credentials in your code or shell commands
- Never add `.env` files to version control (use `.gitignore`)
- Use Railway's Variables UI or `.env` files for local development
- The `DATABASE_URL` format is: `postgres://username:password@host:port/database`
  - Railway provides this securely; you don't need to create it manually

### Optional Variables

None. All settings are stored in the database and managed via Discord commands.

---

## Troubleshooting

### Issue: Bot not responding to commands

**Check:**
1. Railway shows **"Active"** status (green)
2. Discord TOKEN is correct (not expired)
3. Bot has **"Manage Roles"** permission in server
4. Logs show: `BoostMon logged in as [BOT_NAME]`

**Logs location:**
- Railway Dashboard → Your Project → Logs tab
- Scroll to see real-time logs

### Issue: Database connection failed

**Symptoms:**
- Logs show: `Failed to initialize database`
- Bot works but timers don't persist

**Fix:**
1. Go to Railway project
2. Add **PostgreSQL** database (if not already added)
3. Verify `DATABASE_URL` is set in Variables
4. Redeploy

**Check DATABASE_URL:**
```bash
# In Railway terminal or logs
echo $DATABASE_URL
# Should output: postgres://...
```

### Issue: Scheduled reports not running

**Check:**
1. Schedule was created: `/rolestatus schedule list`
2. Bot is online and active
3. Warning channel exists and bot can see it
4. Wait 30+ seconds (cleanup cycle runs every 30s)

**Force check logs:**
- Railway Logs → Search for `[SCHEDULED-REPORT]`
- Should see execution entries every 30 seconds

### Issue: "DATABASE_URL is not set" error

**This is expected for local development!**

**For Local Testing (Optional):**
```bash
# Set a local PostgreSQL connection
export DATABASE_URL="<your-local-postgres-connection-string>"
npm run start
```

**For Railway:** DATABASE_URL is auto-set when you add PostgreSQL database.

⚠️ **SECURITY WARNING:** Do NOT use `export` commands with credentials in production!
- `export` adds credentials to shell history (.bash_history, .zsh_history)
- Instead, use `.env` files (which are in .gitignore) or Railway's Variables UI

---

## Performance Notes

### Deployment Specs (Railway)

| Metric | Value |
|--------|-------|
| **Runtime** | Node.js 18+ |
| **Memory** | 512 MB (default, auto-scales) |
| **Uptime** | 99.9% SLA |
| **Cleanup Cycle** | 30 seconds |
| **Database** | PostgreSQL (auto-backed up) |

### Limits

- **Max Timers:** Unlimited
- **Max Guilds:** Unlimited
- **Max Schedules:** Unlimited
- **Response Time:** <100ms

---

## Production Checklist

Before considering your deployment complete:

- [ ] Discord bot is online and responding
- [ ] All 7 timer commands work (`/settime`, `/addtime`, etc.)
- [ ] Scheduled reports work: `/rolestatus schedule set @role #channel 15`
- [ ] Logs show no errors (Railway Logs tab)
- [ ] Database is initialized: `✓ Database schema initialized`
- [ ] Can create and disable schedules
- [ ] Timers persist after bot restart

---

## Maintenance

### Monitoring

**Daily:**
- Check Railway Logs for errors
- Verify bot is "Active" in Railway dashboard

**Weekly:**
- Review command usage in logs
- Check for any permission errors

### Backups

Railway automatically backs up your PostgreSQL database daily. No manual action needed.

To download a backup:
1. Railway Dashboard → PostgreSQL database
2. Click **"Backups"**
3. Download latest snapshot

---

## Rollback

If you need to revert to a previous version:

1. Go to Railway project
2. Click **"Deployments"** tab
3. Find the previous deployment
4. Click **"Redeploy"**

All data is preserved (stored in PostgreSQL).

---

## Support

- 📚 **Documentation:** See `SCHEDULED_ROLESTATUS_FEATURE.md`
- 🔧 **GitHub Issues:** Report bugs at github.com/ubegformercy/nodejs/issues
- 💬 **Discord:** Contact bot developer

---

## Next Steps

After deployment, consider:

1. **Update Discord Bot Status** - Show dynamic status like "Managing 500+ timers"
2. **Add Custom Logging** - Track usage metrics
3. **Set Up Monitoring** - Use Railway's native monitoring
4. **Document Your Guild Setup** - For future admins

---

**✅ You're ready to deploy!**

Push your changes to GitHub and follow the steps above. Questions? Check the troubleshooting section above.
