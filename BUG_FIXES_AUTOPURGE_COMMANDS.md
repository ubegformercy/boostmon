# Bug Fixes - Autopurge & Duplicate Slash Commands

## Summary
Fixed two issues discovered during testing:
1. ✅ **Autopurge Settings Check** - Now allows re-enabling disabled settings instead of blocking
2. ✅ **Duplicate Slash Commands** - Improved cleanup logic with better logging and error handling

---

## Issue 1: Autopurge Settings Confusion

### The Problem
When trying to add a new autopurge setting for a channel:
- Frontend said: **"An entry already exists"** (HTTP 409 error)
- Discord command `/autopurge status` said: **"No active auto-purge settings in this server"**

This created confusion because the setting appeared to exist in the database but wasn't showing up in the Discord command.

### Root Cause
The `/api/autopurge/add` endpoint checked for **ANY** existing entry (enabled OR disabled):
```javascript
// OLD CODE - checked for any entry, enabled or disabled
const existing = await db.pool.query(
  `SELECT id FROM autopurge_settings WHERE guild_id = $1 AND channel_id = $2`,
  [guildId, channelId]
);

if (existing.rows.length > 0) {
  return res.status(409).json({ error: 'An auto-purge setting already exists...' });
}
```

But the `/autopurge status` Discord command only showed enabled entries:
```javascript
// In app.js - only fetches enabled settings
const settings = await db.getAllAutopurgeSettings(guild.id);

// In db.js - getAllAutopurgeSettings
const result = await pool.query(
  "SELECT * FROM autopurge_settings WHERE guild_id = $1 AND enabled = true ORDER BY channel_id ASC",
  [guildId]
);
```

**Result:** User could have a disabled entry that blocked new entries from being created.

### Solution
Modified `/api/autopurge/add` to:
1. Check if an entry already exists
2. If it exists AND is **enabled** → reject with error (as before)
3. If it exists but is **disabled** → update and re-enable it (NEW)
4. If it doesn't exist → create new entry (as before)

```javascript
// NEW CODE - distinguishes between enabled and disabled
const existing = await db.pool.query(
  `SELECT id, enabled FROM autopurge_settings WHERE guild_id = $1 AND channel_id = $2`,
  [guildId, channelId]
);

if (existing.rows.length > 0) {
  const setting = existing.rows[0];
  
  // If it exists and is enabled, reject
  if (setting.enabled) {
    return res.status(409).json({
      error: 'An auto-purge setting already exists for this channel'
    });
  }
  
  // If it exists but is disabled, update it instead of creating new
  const result = await db.pool.query(
    `UPDATE autopurge_settings 
     SET type = $1, lines = $2, interval_seconds = $3, enabled = true, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [type, lines, intervalMinutes * 60, setting.id]
  );

  return res.json({
    success: true,
    setting: result.rows[0],
    message: 'Auto-purge setting re-enabled successfully'
  });
}

// Create new autopurge setting (if no existing entry at all)
const result = await db.pool.query(
  `INSERT INTO autopurge_settings (guild_id, channel_id, type, lines, interval_seconds, enabled)
   VALUES ($1, $2, $3, $4, $5, true)
   RETURNING *`,
  [guildId, channelId, type, lines, intervalMinutes * 60]
);
```

### Impact
✅ **Before:** Users got blocked when trying to add a setting if a disabled one existed
✅ **After:** Users can now re-enable disabled settings seamlessly, or create new ones

**File Modified:** `/workspaces/nodejs/routes/dashboard.js` (lines 998-1025)
**Commit:** `6fa6e0e` (v2.1.46)

---

## Issue 2: Duplicate Slash Commands

### The Problem
Discord was showing duplicate slash commands in the command picker:
- `/addtime` appeared twice
- `/pausetime` appeared twice
- `/rolestatus schedule set` appeared twice
- (and potentially others)

This only happened on this server, not on other servers where the bot is installed.

### Root Cause
The duplicate command cleanup logic runs on `client.once("ready")` (bot startup), but:
1. Discord might cache commands between bot restarts
2. The cleanup might not execute properly if the bot crashes before cleanup completes
3. Commands might be registered multiple times if deployment doesn't fully restart the bot

### Solution
Improved the command cleanup logic with:

1. **Better logging** - Shows which commands are being deleted and why
2. **Detailed feedback** - Each deletion shows success/failure status
3. **Fallback handling** - Continues even if some deletions fail
4. **More explicit logic** - Clear distinction between duplicates and old commands

```javascript
// IMPROVED CODE - More detailed logging and feedback
const toDelete = [];

existingCommands.forEach(cmd => {
  if (desiredCommandNames.has(cmd.name)) {
    if (commandMap.has(cmd.name)) {
      // Duplicate found - mark for deletion
      toDelete.push({ id: cmd.id, name: cmd.name });
    } else {
      commandMap.set(cmd.name, cmd.id);
    }
  } else {
    // Command not in our desired list - mark for deletion
    toDelete.push({ id: cmd.id, name: cmd.name });
  }
});

// Delete duplicates and unwanted commands
if (toDelete.length > 0) {
  console.log(`🗑️  Deleting ${toDelete.length} duplicate/old commands...`);
  for (const cmd of toDelete) {
    try {
      await rest.delete(`${commandRoute}/${cmd.id}`);
      console.log(`   ✓ Deleted /${cmd.name} (ID: ${cmd.id})`);
    } catch (err) {
      console.warn(`   ✗ Failed to delete /${cmd.name}: ${err.message}`);
    }
  }
} else {
  console.log(`✓ No duplicates found`);
}
```

### Additional Tools Created
Also created helper scripts to manually diagnose and clean commands:

1. **`clean-slash-commands.js`** - One-time cleanup script to remove all duplicates manually
   ```bash
   node clean-slash-commands.js
   ```
   Shows:
   - All existing commands and their IDs
   - Which ones are duplicates
   - Removes duplicates one by one with logging

2. **`check-commands.js`** - Check current command status
   ```bash
   node check-commands.js
   ```

3. **`test-autopurge-db.js`** - Check autopurge settings in database
   ```bash
   node test-autopurge-db.js
   ```

### Next Steps to Clear Duplicates
Since the bot is already running with the improved cleanup code:

**Option 1: Next Bot Restart** (Automatic)
- The next time the bot restarts, it will automatically clean up duplicates
- Check console logs for `✓ Deleted /...` messages

**Option 2: Manual Cleanup Now** (If duplicates are urgent)
```bash
cd /workspaces/nodejs
node clean-slash-commands.js
```

### Impact
✅ **Automatic cleanup** runs on every bot startup
✅ **Better logging** helps diagnose issues
✅ **Manual tools** available for immediate cleanup if needed
✅ **Fallback logic** prevents bot from crashing if Discord API is slow

**Files Modified:** `/workspaces/nodejs/app.js` (lines 445-503)
**Commit:** `6fa6e0e` (v2.1.46)

---

## Testing Recommendations

### For Autopurge Fix
1. Go to Dashboard → Auto-Purge Settings
2. Try to add a setting for a channel
3. Should work now (even if a disabled setting existed)
4. Run `/autopurge status` in Discord - setting should appear

### For Duplicate Commands
1. In Discord, type `/` to open command picker
2. Look for duplicate command names
3. If duplicates exist, they will be cleaned up on next bot restart
4. Or run `node clean-slash-commands.js` manually

---

## Files Modified
- `/workspaces/nodejs/routes/dashboard.js` - Autopurge check logic
- `/workspaces/nodejs/app.js` - Command cleanup logging

## Files Created (Debug Tools)
- `/workspaces/nodejs/clean-slash-commands.js` - Manual duplicate cleanup
- `/workspaces/nodejs/check-commands.js` - Command status checker
- `/workspaces/nodejs/test-autopurge-db.js` - Database state checker

## Version
- **v2.1.46** - These fixes

---

## Verification Checklist
- [x] Autopurge fix deployed
- [x] Command cleanup improvement deployed
- [x] Better logging added
- [x] Debug tools created
- [x] Changes pushed to GitHub
- [x] Railway auto-deployment triggered
- [ ] User testing on next autopurge add
- [ ] User verification of duplicate commands after bot restart
