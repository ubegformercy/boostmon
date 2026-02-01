# Getting Your Discord OAuth2 Credentials

## What You Need

You need **THREE** pieces of information from Discord:

1. **Client ID** - Identifies your app
2. **Client Secret** - Secret key for OAuth (KEEP THIS PRIVATE!)
3. **Bot Token** - For the bot to connect to Discord

---

## Step 1: Get Your Client ID & Secret

### 1. Go to Discord Developer Portal
- https://discord.com/developers/applications
- Sign in with Discord

### 2. Select Your Application
- Click on your **BoostMon** application
- If you don't have one yet, click **New Application** and create it

### 3. Find Your Client ID
- You should be on the **General Information** tab
- Look for **CLIENT ID** field
- Copy this value
- Save it somewhere safe

### 4. Get Your Client Secret
- Still on the **General Information** tab
- Look for **CLIENT SECRET** field
- There should be a **Reset Secret** button if it's hidden
- Click **Reset Secret**
- A new secret will be generated
- Click the copy button (📋) next to it
- **VERY IMPORTANT:** Save this somewhere - you won't see it again!

---

## Step 2: Get Your Bot Token

### 1. Click **Bot** in left sidebar
### 2. Under **TOKEN** section, click **Reset Token**
### 3. Copy the token
### 4. Click **Yes, do it!** to confirm

**⚠️ WARNING:** Anyone with this token can control your bot! Don't share it!

---

## Step 3: Set Environment Variables

### ⚠️ SECURITY WARNING

**NEVER** commit `.env` to GitHub, even if your repo is public! The `.gitignore` file already protects it, but here's how it works:

- `.env` files are listed in `.gitignore` and will NOT be uploaded to GitHub
- Local `.env` files are only on your computer
- `.env` is safe for local development
- Railway uses the Variables tab (not `.env`) for production

### Option A: Local Development (.env file) - SAFE ✅

Only do this on your local machine or dev container:

1. Create `.env` file in `/workspaces/nodejs/`:
```bash
touch /workspaces/nodejs/.env
```

2. Edit `.env` with your credentials:
```bash
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DATABASE_URL=your_postgresql_url_here
NODE_ENV=development
```

3. **IMPORTANT:** Verify `.env` is in `.gitignore`:
```bash
grep "^\.env$" /workspaces/nodejs/.gitignore
# Should output: .env
```

4. **NEVER** do `git add .env` - it will be automatically ignored

### Option B: Railway Production - SAFE ✅

For production, use Railway's built-in Variables (not `.env`):

1. Go to your Railway project dashboard
2. Click on your **BoostMon** service
3. Go to the **Variables** tab
4. Click **New Variable** and add:
   - `DISCORD_CLIENT_ID` = your client ID
   - `DISCORD_CLIENT_SECRET` = your client secret (encrypted by Railway)
   - `DATABASE_URL` = your PostgreSQL URL (already set)

5. Click **Deploy** to apply changes

**Railway encrypts all variables!** They're stored securely and never exposed.

### Option C: GitHub Secrets (If Needed)

If you want CI/CD automation:

1. Go to GitHub repo → Settings → Secrets
2. Add: `DISCORD_CLIENT_SECRET`
3. Add: `DISCORD_TOKEN`
4. These are encrypted and only accessible to GitHub Actions

---

## Verify Your .env is Protected

Check that `.env` won't be committed:

```bash
cd /workspaces/nodejs
git status

# Should NOT show .env in the changes
# Should show .env in .gitignore
cat .gitignore | grep env
```

If you accidentally committed it:
```bash
# Remove from git history
git rm --cached .env
git commit -m "Remove .env from git history"
git push

# Immediately rotate your tokens!
```

---

## Step 4: Enable OAuth2

Go back to Discord Developer Portal → Your App → OAuth2

### Required Scopes
Make sure these are selected:
- ✅ `identify` - Access user profile
- ✅ `guilds` - Access user's servers

### Add Redirect URIs
Add these under **Redirects**:
- `http://localhost:3000/auth/callback` (for local dev)
- `https://nodejs-production-9ae1.up.railway.app/auth/callback` (for production)

### Save Changes
Click **Save Changes** at the bottom!

---

## Security Best Practices

### ✅ DO:
- Keep your Client Secret private
- Keep your Bot Token private
- Use environment variables (never hardcode credentials)
- Regenerate tokens if they're ever exposed
- Use HTTPS in production (Railway handles this)

### ❌ DON'T:
- Commit `.env` to GitHub
- Share your tokens anywhere
- Use the same token in multiple apps
- Display tokens in error messages
- Put credentials in code comments

---

## Testing OAuth

### Local Testing

1. Make sure `.env` has your credentials
2. Start bot: `npm start`
3. Go to: http://localhost:3000/login.html
4. Click "Login with Discord"
5. You should see Discord's authorization page
6. Click authorize
7. You should be redirected back with your servers listed

### Production Testing

1. Update Railway variables (see Step 3)
2. Wait for Railway to redeploy
3. Go to: https://nodejs-production-9ae1.up.railway.app/login.html
4. Same flow as local testing

---

## Troubleshooting

### "Invalid Client ID"
- Check that `DISCORD_CLIENT_ID` is exactly correct
- Make sure no spaces or extra characters

### "Invalid Client Secret"  
- Make sure `DISCORD_CLIENT_SECRET` is set
- Check for typos
- Try resetting the secret in Discord Developer Portal

### "Invalid redirect_uri"
- This means the redirect URL doesn't match Discord's records
- Check that you added it to the Redirects section (see Step 4)
- Make sure it's 100% exact match (including http/https)

### Blank Page After Authorization
- Check browser console for errors
- Check your bot's logs: `npm start` output
- Verify the redirect URI matches exactly

### "Missing Permissions"
- Your user account needs admin access to the server
- Or the bot needs admin permissions in the server

---

## Finding Your Existing Credentials

If you already have credentials set up on Railway:

1. Go to Railway project
2. Click **BoostMon** service
3. Click **Variables** tab
4. You can see (but not copy) existing variables
5. Click a variable to edit it if needed

---

## Next Steps

After setting up OAuth:

1. ✅ Add credentials to `.env` (local)
2. ✅ Add redirect URIs to Discord Developer Portal
3. ✅ Set variables on Railway (if deploying to production)
4. ✅ Test local: http://localhost:3000/login.html
5. ✅ Verify login works
6. ✅ Push to GitHub: `git push`
7. ✅ Wait for Railway to redeploy

Once working, the login flow should:
- Show beautiful login page
- Redirect to Discord authorization
- List your servers
- Let you select one
- Show dashboard with real data!

---

**Still stuck?** Check the logs:
```bash
# Local development logs
npm start

# See any errors in terminal output
```

**Last Updated:** February 1, 2026
