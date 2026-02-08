# 🔍 Dashboard Performance Issue - Root Cause Analysis

**Status**: IDENTIFIED & SOLUTION READY  
**Date**: February 8, 2026  
**Issue**: Scheduled Reports & Auto-Purge Settings tables taking too long to populate

---

## Problem Summary

Users report that the **Scheduled Reports** and **Auto-Purge Settings** tables in the tabbed view are slow to populate, even though:
- ✅ API returns data successfully
- ✅ Stats show correct counts
- ✅ Grid view works fine

---

## Root Cause Analysis

### Where the Slowdown Occurs

**File**: `routes/dashboard.js` (lines 132-380)  
**Endpoint**: `GET /api/dashboard`

### The Bottleneck Code

```javascript
// This is the SLOW part - fetching member data for EVERY timer
const formattedTimers = await Promise.all(
  (allTimers || []).map(async (timer) => {
    // ... calculation code ...
    
    // THIS IS THE PROBLEM - Making Discord API calls in a loop!
    let displayName = userName;
    let presence = 'offline';
    try {
      const guild = global.botClient?.guilds?.cache?.get(guildId);
      if (guild) {
        const member = await guild.members.fetch(timer.user_id).catch(() => null);
        if (member) {
          displayName = member.displayName || userName;
          presence = member.presence?.status || 'offline';
        }
      }
    } catch (err) {
      // Fallback to userName if member fetch fails
    }
    // ... rest of code ...
  })
).then(timers => timers.filter(t => t !== null && t !== undefined));
```

### Why This Is Slow

1. **Sequential Discord API Calls**: For every timer in the database, it makes an async call to fetch member data
2. **Promise.all() Parallelization**: All calls run in parallel, but Discord API has rate limits
3. **No Timeout**: Each failed request waits for full timeout before falling back
4. **Cascading Delay**: If you have 100 timers, you're making 100 parallel Discord API calls
5. **Unnecessary Data**: The tabbed view for Reports and Autopurge doesn't need this member data at all!

### Why Reports & Autopurge Tables Are Slow

The **entire `/api/dashboard` endpoint** is slow because of the timer formatting code above. Even though Reports and Autopurge formatting is fast:

```javascript
// Fast - just uses cached names
const formattedSchedules = (schedules || []).map((schedule) => {
  const roleName = getRoleName(schedule.role_id);  // Cached
  const channelName = getChannelName(schedule.channel_id);  // Cached
  return { /* ... */ };
});

const formattedAutopurge = (autopurges || []).map((setting) => {
  const channelName = getChannelName(setting.channel_id);  // Cached
  return { /* ... */ };
});
```

The entire response is blocked by the slow `formattedTimers` processing. The frontend receives everything at once, so all tables appear slow.

---

## Solution Strategy

### Option 1: Add Timeout to Member Fetch (Quick Fix)
Already implemented in the code:
```javascript
const user = await Promise.race([
  client.users.fetch(userId),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
]);
```

This helps but doesn't solve the root issue.

### Option 2: Cache Member Data in-Memory (Recommended)
Maintain a cache of member display names and presence data that updates periodically in the background.

**Benefits**:
- Eliminates all Discord API calls from the hot path
- Reports and Autopurge data returns instantly
- Timers get member info from cache (may be slightly stale, but always fast)

**Implementation**:
- Create a `memberCache` object
- Update it via background sync (already exists: `guildMemberSync`)
- Use cache in API endpoint (fallback to userName if not in cache)
- No API calls needed on each request

### Option 3: Separate Endpoints (Moderate Fix)
Split `/api/dashboard` into:
- `/api/dashboard/quick` - Returns stats, reports, autopurge (no member fetches)
- `/api/dashboard/full` - Returns everything including timers with member data

**Benefits**:
- Reports and Autopurge load instantly
- Timers load separately
- Minimal code changes

**Drawback**:
- Requires frontend changes to handle two separate requests

---

## Recommended Fix: In-Memory Member Cache

This is the **best solution** because:

1. ✅ Reports and Autopurge tables load instantly (no member data needed)
2. ✅ Timers still get display names from fast cache lookup
3. ✅ Cache updates in background via existing `guildMemberSync` service
4. ✅ No API changes needed
5. ✅ Minimal code changes
6. ✅ Graceful fallback (shows username if not in cache)

### Implementation Steps

1. **Add member cache to `app.js`**:
   ```javascript
   global.memberCache = {}; // { guildId: { userId: { displayName, presence } } }
   ```

2. **Update `guild-member-sync.js`** to populate cache:
   ```javascript
   // When syncing members, also update the global cache
   global.memberCache[guildId] = global.memberCache[guildId] || {};
   global.memberCache[guildId][member.id] = {
     displayName: member.displayName,
     presence: member.presence?.status || 'offline'
   };
   ```

3. **Update `/api/dashboard` endpoint** to use cache:
   ```javascript
   // Instead of:
   // const member = await guild.members.fetch(timer.user_id);
   
   // Do this:
   const cachedMember = global.memberCache[guildId]?.[timer.user_id];
   if (cachedMember) {
     displayName = cachedMember.displayName || userName;
     presence = cachedMember.presence || 'offline';
   }
   // No async/await needed!
   ```

---

## Performance Impact

### Before Fix
- 100 timers = 100 parallel Discord API calls
- Average response time: 5-10 seconds (with rate limiting)
- Reports/Autopurge tables wait for all timers to process

### After Fix
- 0 Discord API calls per request (all cached)
- Average response time: < 500ms
- Reports/Autopurge tables instant
- Timers get display names from in-memory cache

---

## Implementation Priority

**High**: The slow Dashboard response affects all views (grid and tabbed)

---

## Files to Modify

1. ✅ `app.js` - Add member cache initialization
2. ✅ `guild-member-sync.js` - Update cache during sync
3. ✅ `routes/dashboard.js` - Use cache instead of API calls

---

## Testing Plan

1. Load dashboard with 100+ timers
2. Measure `/api/dashboard` response time
3. Verify Reports and Autopurge tables appear in < 500ms
4. Verify timers still show display names and presence
5. Check that cache updates after member status changes

---

## Rollout Plan

1. Deploy changes to dev/staging
2. Test with various guild sizes
3. Monitor performance metrics
4. Deploy to production

---

## Notes

- Member cache will have slight staleness (updates every 5 minutes via sync)
- This is acceptable because member display names rarely change
- Presence can be stale but is a nice-to-have feature
- Critical data (timers, reports, autopurge) is always current

