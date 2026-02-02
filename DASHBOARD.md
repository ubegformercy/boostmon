# BoostMon Dashboard

Access your bot's dashboard at: `/dashboard.html`

## Features

**Real-time Statistics**
- Active timers count
- Scheduled reports count
- Auto-purge settings count

**Active Timers**
- See all users with timed roles
- View time remaining
- Check pause/active status

**Scheduled Reports**
- Monitor automated role status reports
- See next scheduled report time
- Track last report execution

**Auto-Purge Settings**
- View all configured channels
- See purge type (bot/user/both)
- Check last purge time

## Access

**Local Development:**
```
http://localhost:3000/dashboard.html
```

**Railway Deployment:**
```
https://your-railway-deployment-url/dashboard.html
```

## Auto-Refresh

Dashboard refreshes every 30 seconds automatically.

## Custom Domain (Optional)

To use a custom domain:
1. Purchase domain (Namecheap, Google Domains, etc.) - ~$10-15/year
2. Point DNS to Railway deployment URL
3. Configure Railway to use custom domain

**Do you need this?** No, Railway provides a free URL that works perfectly.
