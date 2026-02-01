// Authentication Routes for Dashboard

const express = require('express');
const router = express.Router();

// OAuth Configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.NODE_ENV === 'production' 
  ? 'https://nodejs-production-9ae1.up.railway.app/auth/callback'
  : 'http://localhost:3000/auth/callback';

const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_API_URL = 'https://discord.com/api/v10';

/**
 * GET /auth/login
 * Redirects user to Discord OAuth2 consent screen
 */
router.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
  });

  res.redirect(`${DISCORD_AUTH_URL}?${params.toString()}`);
});

/**
 * GET /auth/callback
 * Discord redirects here with authorization code
 */
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user info
    const userResponse = await fetch(`${DISCORD_API_URL}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user info: ${userResponse.statusText}`);
    }

    const user = await userResponse.json();

    // Get user's guilds
    const guildsResponse = await fetch(`${DISCORD_API_URL}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!guildsResponse.ok) {
      throw new Error(`Failed to fetch guilds: ${guildsResponse.statusText}`);
    }

    const guilds = await guildsResponse.json();

    // Filter to only guilds where user is admin or bot is present
    const adminGuilds = guilds.filter(g => (g.permissions & 0x8) === 0x8); // ADMINISTRATOR

    // Store auth data in session/cookie
    const sessionData = {
      userId: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      accessToken,
      guilds: adminGuilds,
      timestamp: Date.now(),
    };

    // Set secure session cookie
    res.cookie('boostmon_auth', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to dashboard with selected guild
    if (adminGuilds.length === 1) {
      res.redirect(`/dashboard.html?guild=${adminGuilds[0].id}`);
    } else if (adminGuilds.length > 1) {
      res.redirect(`/guild-select.html`);
    } else {
      res.redirect(`/no-guilds.html`);
    }
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`/login-error.html?error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * GET /auth/logout
 * Clear session and redirect to login
 */
router.get('/logout', (req, res) => {
  res.clearCookie('boostmon_auth');
  res.redirect('/login.html');
});

/**
 * GET /auth/user
 * Returns current user info (protected endpoint)
 */
router.get('/user', (req, res) => {
  try {
    const authCookie = req.cookies.boostmon_auth;
    if (!authCookie) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const sessionData = JSON.parse(authCookie);
    res.json({
      userId: sessionData.userId,
      username: sessionData.username,
      discriminator: sessionData.discriminator,
      avatar: sessionData.avatar,
      guilds: sessionData.guilds,
    });
  } catch (err) {
    console.error('Auth user error:', err);
    res.status(500).json({ error: 'Failed to retrieve user info' });
  }
});

/**
 * Middleware to check if user is authenticated
 */
router.isAuthenticated = (req, res, next) => {
  const authCookie = req.cookies.boostmon_auth;
  if (!authCookie) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    req.user = JSON.parse(authCookie);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid session' });
  }
};

module.exports = router;
