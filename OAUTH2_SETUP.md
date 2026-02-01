# Discord OAuth2 Setup Guide

## Required Redirect URIs

Add these to your Discord Developer Portal under **OAuth2 > Redirects**:

### Local Development
```
http://localhost:3000/auth/callback
```

### Production (Railway)
```
https://nodejs-production-9ae1.up.railway.app/auth/callback
```

---

## Step-by-Step Instructions

### 1. Go to Discord Developer Portal
- Visit: https://discord.com/developers/applications
- Sign in with your Discord account

### 2. Select Your Application
- Click on **BoostMon** application
- If you don't have one, create it first

### 3. Navigate to OAuth2
- Click **OAuth2** in the left sidebar
- You'll see the "General" tab selected

### 4. Scroll to "Redirects"
- Find the **Redirects** section
- You should see an **Add Redirect** button

### 5. Add Redirect URIs
**First URI (Local Development):**
- Click **Add Redirect**
- Paste: `http://localhost:3000/auth/callback`
- Click the checkmark to confirm

**Second URI (Production):**
- Click **Add Redirect**
- Paste: `https://nodejs-production-9ae1.up.railway.app/auth/callback`
- Click the checkmark to confirm

### 6. Save Changes
- Click the **Save Changes** button at the bottom
- You should see a success message

---

## Important Security Notes

✅ **DO:** Keep your redirect URIs exact (case-sensitive, including protocol)
✅ **DO:** Add both development and production URIs
✅ **DO:** Save changes after adding URIs

❌ **DON'T:** Share your Client Secret publicly
❌ **DON'T:** Use IP addresses instead of domain/localhost
❌ **DON'T:** Include trailing slashes if not in the code

---

## Testing After Setup

### Test Local Development
1. Start the bot: `npm start`
2. Open: http://localhost:3000/login.html
3. Click "Login with Discord"
4. You should be redirected to Discord's auth page
5. After authorizing, you'll be redirected back to the dashboard

### Test Production
1. Wait for Railway to deploy latest changes
2. Open: https://nodejs-production-9ae1.up.railway.app/login.html
3. Click "Login with Discord"
4. Complete the OAuth flow
5. Should redirect to dashboard on Railway

---

## Troubleshooting

### Error: "Invalid redirect_uri"
- **Cause:** The redirect URI doesn't match exactly
- **Fix:** Check for typos, extra slashes, http vs https mismatch

### Error: "Access Denied"
- **Cause:** Your Discord bot app isn't configured correctly
- **Fix:** Make sure Client ID and Client Secret are set in `.env`

### Page won't redirect
- **Cause:** Redirect URI not added to Discord Developer Portal
- **Fix:** Follow steps above to add the URIs

### Still having issues?
- Check that `DISCORD_CLIENT_ID` is set in `.env`
- Verify `DISCORD_CLIENT_SECRET` is set
- Make sure redirect URIs are 100% exact match
- Try clearing browser cookies/cache

---

## OAuth Scopes

The bot requests these Discord OAuth scopes:
- `identify` - Get user profile info
- `guilds` - List user's servers

These are safe and minimal - no message reading, no access to private data!

---

**Last Updated:** February 1, 2026
