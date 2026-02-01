# Environment Variables - Secure Setup Guide

## The Right Way to Handle Secrets

### 🏠 Local Development (Dev Container)
Use `.env` file locally - **it never goes to GitHub**
```
✅ Safe - only on your machine
✅ Protected by .gitignore
✅ Standard practice
```

### 🚀 Production (Railway)
Use Railway Variables - **never use .env on production**
```
✅ MOST SECURE - encrypted by Railway
✅ Never stored in git
✅ Only accessible to your app
✅ Automatically injected at runtime
```

---

## Why Railway Variables Are Better for Production

| Aspect | .env File | Railway Variables |
|--------|-----------|------------------|
| **Encryption** | Plain text (risky if leaked) | Encrypted at rest ✅ |
| **Access Control** | Anyone with repo access | Only Railway team controls |
| **Git Exposure** | Risk if .gitignore fails | Zero git exposure ✅ |
| **Audit Trail** | None | Railway logs all changes |
| **Automatic Rotation** | Manual | Can be automated ✅ |
| **Production Ready** | Not recommended | Industry standard ✅ |

---

## Setup - The Secure Way

### Step 1: Local Development with .env

**Create locally on your dev container:**

```bash
# Create .env file (local only)
cat > /workspaces/nodejs/.env << 'EOF'
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DATABASE_URL=your_postgresql_url_here
NODE_ENV=development
EOF
```

**Verify it's protected:**
```bash
# Check .gitignore includes .env
cat /workspaces/nodejs/.gitignore | grep "\.env"

# Should output: .env
```

**Test locally:**
```bash
npm start
# Your bot will use the .env variables
```

---

### Step 2: Production Setup on Railway (IMPORTANT!)

**This is where your REAL secrets go:**

1. **Go to your Railway project**
   - https://railway.app/dashboard

2. **Select your BoostMon service**
   - Click on the service in your project

3. **Go to Variables tab**
   - NOT Variables Editor - the main Variables tab

4. **Add these variables:**

   | Variable | Value | Source |
   |----------|-------|--------|
   | `DISCORD_CLIENT_ID` | `your_client_id` | From Discord Developer Portal |
   | `DISCORD_CLIENT_SECRET` | `your_client_secret` | From Discord Developer Portal |
   | `DISCORD_TOKEN` | `your_bot_token` | From Discord Developer Portal |
   | `DATABASE_URL` | Should already exist | Railway PostgreSQL |

5. **Important:** Only add `DISCORD_CLIENT_SECRET` if not already present

6. **After adding variables:**
   - Click Deploy
   - Railway will restart with new variables
   - Your secrets are now encrypted and safe ✅

---

## Critical Security Points

### ✅ DO THIS:

```bash
# 1. Create .env locally (dev only)
cat > .env << 'EOF'
DISCORD_TOKEN=...
DISCORD_CLIENT_SECRET=...
EOF

# 2. Verify .gitignore protects it
git status  # Should NOT show .env

# 3. Use Railway Variables for production
# Go to Railway dashboard → Variables tab → add your secrets

# 4. Keep rotating your tokens
# Every 6 months or if exposed, regenerate on Discord
```

### ❌ NEVER DO THIS:

```bash
# ❌ DON'T commit .env to GitHub
git add .env
git commit -m "Add secrets"

# ❌ DON'T hardcode secrets in code
const SECRET = "abc123";  // BAD!

# ❌ DON'T share your secrets anywhere
# Discord token, Client Secret - keep these private!

# ❌ DON'T use same token in multiple apps
# Create separate apps for dev and production

# ❌ DON'T put secrets in error messages
throw new Error(`Secret is: ${DISCORD_TOKEN}`);  // BAD!
```

---

## The Complete Secure Workflow

### Local Development
```
1. Create .env with your credentials (local machine only)
2. Run: npm start
3. Test everything locally
4. Make changes
5. Push to GitHub (WITHOUT .env - it's in .gitignore)
```

### Production Deployment
```
1. Log into Railway dashboard
2. Select BoostMon service
3. Go to Variables tab
4. Add DISCORD_CLIENT_SECRET and any new secrets
5. Click Deploy
6. Railway pulls latest code from GitHub
7. Railway injects encrypted variables at runtime
8. Your app starts with production credentials
```

### If You Ever Expose a Secret
```
1. IMMEDIATELY go to Discord Developer Portal
2. Click "Reset Secret" or "Reset Token"
3. This invalidates the old secret
4. Update Railway Variables with new secret
5. No need to touch GitHub (it never had it!)
```

---

## Step-by-Step: Set Up Railway Variables

### Video Guide Alternative:
If you prefer visual instructions:
1. Go to Railway dashboard
2. Click your BoostMon project
3. Click BoostMon service
4. Click "Variables" tab
5. You should see existing variables like DATABASE_URL

### Add New Variables:

**Click the "+" button or "New Variable"**

Add these one by one:

**Variable 1:**
- Key: `DISCORD_CLIENT_ID`
- Value: `your_actual_client_id_from_discord`
- Click Add

**Variable 2:**
- Key: `DISCORD_CLIENT_SECRET`
- Value: `your_actual_client_secret_from_discord`
- Click Add (Railway will hide it after saving)

**Variable 3:**
- Key: `DISCORD_TOKEN`
- Value: `your_actual_bot_token_from_discord`
- Click Add (Railway will hide it after saving)

**After all variables are added:**
- Click **Deploy** button
- Railway will redeploy with new variables
- Check logs to verify deployment succeeded

---

## Verify It's Working

### Local Test
```bash
npm start
# Look for: "BoostMon logged in as YourBotName#0000"
# This means .env variables were loaded
```

### Production Test
```bash
# After Railway deploys:
1. Open: https://nodejs-production-9ae1.up.railway.app/login.html
2. Click "Login with Discord"
3. Should redirect to Discord auth
4. If it works, your Railway variables are correct!
```

---

## Common Mistakes to Avoid

### Mistake 1: Committing .env to GitHub
```bash
# ❌ BAD - This exposes your secrets!
git add .env
git commit -m "Add .env"
git push

# ✅ GOOD - .gitignore automatically prevents this
# Just don't manually add it
```

**Recovery:**
```bash
# If you accidentally committed .env:
git rm --cached .env
git commit -m "Remove .env from git history"
git push

# Immediately rotate ALL your tokens on Discord!
```

### Mistake 2: Using same credentials for dev and prod
```bash
# ❌ BAD - If dev credentials leak, production is compromised
# Local: YOUR_TOKEN
# Railway: SAME_TOKEN  ← Bad!

# ✅ GOOD - Separate credentials
# Local dev: Use YOUR_TOKEN (from your Discord app in dev mode)
# Railway prod: Use RAILWAY_TOKEN (from your Discord app in prod mode)
```

### Mistake 3: Railway Variables vs .env Confusion
```bash
# ❌ WRONG - Putting .env on Railway
# Create local .env file
# Upload .env to Railway somehow
# This defeats the purpose!

# ✅ CORRECT - Use Railway's Variable system
# Create local .env file (stays on your machine)
# Enter variables in Railway dashboard (Railway stores encrypted)
# Push code to GitHub (no .env in push)
```

---

## Your Current Setup Status

✅ `.gitignore` is already protecting `.env`
✅ You have `OAUTH2_CREDENTIALS_GUIDE.md` explaining both methods
✅ Railway has access to DATABASE_URL already

**What you need to do:**

1. **Local Development (Choose ONE):**
   - Option A: Create `.env` file locally with your Discord credentials
   - Option B: Set environment variables in your terminal
   
2. **Production (Railway):**
   - Go to Railway dashboard
   - Click BoostMon service → Variables tab
   - Add `DISCORD_CLIENT_SECRET` (and optionally other Discord vars)
   - Click Deploy

---

## Testing Checklist

```
Local Development:
[ ] Create .env file with credentials
[ ] Run: npm start
[ ] No errors in terminal
[ ] Go to http://localhost:3000/login.html
[ ] "Login with Discord" button appears
[ ] Click it - redirects to Discord auth

Production (Railway):
[ ] Add DISCORD_CLIENT_SECRET to Railway Variables
[ ] Click Deploy
[ ] Wait for deployment to complete
[ ] Go to https://nodejs-production-9ae1.up.railway.app/login.html
[ ] "Login with Discord" button appears
[ ] Click it - redirects to Discord auth
[ ] Select your server
[ ] See dashboard with real data
```

---

## Emergency: If You Expose Secrets

### Immediate Actions:
```bash
1. Go to Discord Developer Portal
2. Reset CLIENT_SECRET
3. Reset BOT_TOKEN
4. Update Railway Variables with new values
5. Click Deploy on Railway
6. Done! - GitHub never had the secrets
```

### Verify It's Fixed:
```bash
# Check git history (secrets should never be there)
git log --all --source --remotes -S "your_old_token"
# Should return nothing!
```

---

## References

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Railway Documentation](https://docs.railway.app)
- [Environment Variables Best Practices](https://12factor.net/config)
- [Git Security](https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work)

---

**Summary:**
- 🏠 **Local**: Use `.env` file (protected by `.gitignore`)
- 🚀 **Production**: Use Railway Variables (encrypted by Railway)
- 🔐 **Never**: Commit secrets to GitHub
- ⚠️ **If exposed**: Regenerate tokens immediately

**Last Updated:** February 1, 2026
