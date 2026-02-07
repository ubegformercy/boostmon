# 🎯 Boost Queue - Quick Reference

## For Users 👥

### Join the Queue
```
/boostqueue add
```
Optional: Add a note about why you want a boost
```
/boostqueue add note: Need Demon for speedrun
```

### Check Your Position
```
/boostqueue status
```
See your position and how many people are ahead of you.

### See Everyone's Position
```
/boostqueue view
```
See the entire queue and who's ahead of you.

### Leave the Queue
```
/boostqueue remove
```
No penalty, you can re-join anytime.

---

## For Admins 🔧

### Give a User Their Boost

**Option 1: Use `/settime` (sets time exactly)**
```
/settime @username 60 @BoostRole
```
✅ Automatically removes them from queue
✅ Next person promoted to #1

**Option 2: Use `/addtime` (adds to existing time)**
```
/addtime @username 60 @BoostRole
```
✅ Automatically removes them from queue
✅ Next person promoted to #1

### Mark Someone as Completed (if not giving time)
```
/boostqueue complete @username
```
✅ Removes them from queue
✅ Next person promoted to #1
✅ They get a DM notification

### Remove Someone from Queue
```
/boostqueue remove @username
```
Use this if they're being troublemakers or changed their mind.

### View Full Queue
```
/boostqueue view
```
See everyone waiting and their notes.

---

## How It Works 🔄

1. **User joins:** `/boostqueue add`
   - Position: #1 (if first)
   - Status: Waiting

2. **More users join:** `/boostqueue add`
   - Existing user: Still #1
   - New user: #2
   - System reorders automatically

3. **Admin gives boost:** `/settime @user1 60 @role`
   - user1 gets role and timer
   - user1 removed from queue
   - user2 promoted to #1
   - user2 receives DM: "🎉 You're Next!"

4. **Process repeats:** Admin does step 3 again for user2

---

## Notifications 📬

### When You're Added to Queue
```
✅ Added to Boost Queue
Your Position: #1
```

### When You're Promoted
You'll receive a DM:
```
🎉 You're Next!
You've been promoted to #1 in the boost queue for EPIC Forge Studio!
```

### When Removed
```
❌ Removed from Queue
You have been removed from the boost queue.
```

---

## Common Questions ❓

**Q: Can I see why someone is in the queue?**
A: Yes! Use `/boostqueue view` to see their notes.

**Q: What if I want to leave and come back?**
A: Use `/boostqueue remove` to leave, then `/boostqueue add` to rejoin.

**Q: Will I get notified when I'm up?**
A: Yes! You'll get a DM when you're promoted to #1.

**Q: Does the queue persist after a bot restart?**
A: Yes! It's stored in the database. Queue survives everything!

**Q: Can I add a note later?**
A: Not yet - rejoin the queue to change your note.

**Q: What if I'm removed by accident?**
A: Just rejoin with `/boostqueue add` - you'll get a new position.

---

## Admin Tips 💡

### Efficiency
1. Check queue: `/boostqueue view`
2. Give first person a boost: `/settime @user 60 @role`
3. Repeat for next person
4. Next person auto-promoted, no manual work!

### Transparency
- Users can see the queue anytime
- No hidden mechanics
- Fair first-come-first-served

### Integration
- `/settime` and `/addtime` handle queue removal
- Use them normally - queue management is automatic
- No extra commands needed

### Troubleshooting
- User not removed? Check timer was actually set
- Queue not updating? Refresh with `/boostqueue view`
- Wrong order? Admins can remove and re-add to fix

---

## Command Reference 📖

### User Commands
| Command | Use When | Permissions |
|---------|----------|-------------|
| `/boostqueue add` | You want a boost | Everyone |
| `/boostqueue status` | You want to check your position | Everyone |
| `/boostqueue view` | You want to see the queue | Everyone |
| `/boostqueue remove` | You want to leave the queue | Everyone (self only) |

### Admin Commands
| Command | Use When | Permissions |
|---------|----------|-------------|
| `/settime @user MIN @role` | Giving someone a boost | Admin/Owner |
| `/addtime @user MIN @role` | Adding time to existing boost | Admin/Owner |
| `/boostqueue complete @user` | Marking someone as done (no time given) | Admin/Owner |
| `/boostqueue remove @user` | Removing someone else from queue | Admin/Owner |
| `/boostqueue view` | Viewing the full queue | Everyone |

---

## Status Codes 🟢

### Queue Status Messages

| Message | Meaning |
|---------|---------|
| ✅ Added to Boost Queue | You're in! |
| ⚠️ Already in Queue | You can't join twice |
| ❌ Removed from Queue | You left or were removed |
| 🎯 Your Queue Status | Shows your position |
| 🎯 Boost Queue | Shows everyone's position |
| ❌ Not in Queue | You're not queued up |
| 🎉 You're Next! | You're promoted to #1 (DM) |

---

## Emoji Guide 🎨

| Emoji | Meaning |
|-------|---------|
| ✅ | Success |
| ❌ | Removed/Error |
| ⚠️ | Warning |
| 🎯 | Queue related |
| 🎉 | Promotion |
| ⏳ | Waiting |
| #1, #2, etc | Position |

---

Last Updated: February 7, 2026
Version: v2.0.0
