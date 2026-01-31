# 🚀 Quick Reference: Scheduled Role Status

## User Commands

### View Members (Original)
```
/rolestatus view @role
```
Shows all current members with this role and their timers.

---

### Set Up Automated Reports ⭐ NEW
```
/rolestatus schedule set @role #channel interval:15
```

| Parameter | Type | Options | Example |
|-----------|------|---------|---------|
| `role` | Role | Any role | `@Active-Booster` |
| `channel` | Channel | Text/announcement | `#daily-report` |
| `interval` | Minutes | 15-1440 | `15`, `30`, `60`, `1440` |

**Response:** Confirmation with schedule details

---

### Stop Reports
```
/rolestatus schedule disable @role
```

Disables all automated reports for that role.

---

### List All Schedules
```
/rolestatus schedule list
```

Shows every active automated report in the server.

---

## Common Intervals

| Use Case | Minutes | Frequency |
|----------|---------|-----------|
| Very Frequent | 15 | Every 15 min |
| Frequent | 30 | Every 30 min |
| Regular | 60 | Hourly |
| Twice Daily | 720 | Every 12 hours |
| Daily | 1440 | Once per day |

---

## Report Features

✅ Lists all members with role  
✅ Shows remaining time for each  
✅ Sorted by expiration (soonest first)  
✅ Status indicators (🟢 active, ⏸️ paused, 🔴 expired)  
✅ Summary statistics  
✅ Posted to your chosen channel  
✅ Automatic (no manual work!)  

---

## Permissions Needed

| Action | Permission | Who |
|--------|-----------|-----|
| Set schedule | Manage Messages | User |
| Disable schedule | Manage Messages | User |
| List schedules | None | Anyone |
| Post reports | Send Messages | Bot |

---

## Troubleshooting

**Reports not posting?**
- Check channel exists
- Verify bot has "Send Messages" permission
- Check interval setting (min 15 min)

**Reports stopped after bot restart?**
- They should automatically resume
- Check `/rolestatus schedule list` to verify still active

**Wrong interval?**
- Run `set` command again with new interval
- Automatically updates existing schedule

**Want to start over?**
- Run `/rolestatus schedule disable @role`
- Then run `set` command again

---

## Examples

### Set 30-Minute Reports
```
/rolestatus schedule set @Boosters #status interval:30
```
Posts role status every 30 minutes to #status channel.

### Daily Report
```
/rolestatus schedule set @VIPs #daily-stats interval:1440
```
Posts once per day at roughly the same time.

### View All Schedules
```
/rolestatus schedule list
```
Shows which roles have automated reports running.

### Stop Reports
```
/rolestatus schedule disable @Boosters
```
Stops posting reports for the Boosters role.

---

**Ready to use? Try it now!** ✨
