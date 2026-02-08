# BUILD-2.1.95: Testing and Verification Guide

## Quick Start Testing

### 1. Dashboard Loading
1. Open browser DevTools: `F12` or `Ctrl+Shift+I`
2. Go to Console tab
3. Load dashboard: Navigate to `/dashboard`
4. Look for these console messages:
   ```
   [updateDashboard] Updating reports table...
   [updateReportsTable] Called with: X items
   [updateReportsTable] Rendering X reports
   ```

### 2. Data Verification

#### Check if Reports are Loading
1. Open browser console
2. Type: `document.getElementById('reportsTableBody').innerHTML`
3. Should show table rows with data, NOT the empty state
4. Look for console logs showing:
   - `[updateReportsTable] Rendering X reports`
   - `[Report 0]:` followed by the report object

#### Check if Autopurge Settings are Loading
1. Open browser console
2. Type: `document.getElementById('autopurgeTableBody').innerHTML`
3. Should show table rows with data
4. Look for console logs showing:
   - `[updateAutopurgeTable] Rendering X autopurge settings`
   - `[Autopurge 0]:` followed by the setting object

### 3. Tabbed View Testing

1. Click on "📋 Scheduled Reports" tab
2. Verify table shows reports (not empty)
3. Look for console logs:
   ```
   [updateReportsTableTab] Called with: X items
   [updateReportsTableTab] Rendering X reports
   ```
4. Click on "🗑️ Auto-Purge Settings" tab
5. Verify table shows autopurge settings
6. Look for console logs:
   ```
   [updateAutopurgeTableTab] Called with: X items
   [updateAutopurgeTableTab] Rendering X autopurge settings
   ```

## Detailed Console Logging Guide

### What to Look For

#### Success Indicators

**Grid View Reports:**
```
[updateReportsTable] Called with: 2 items
[updateReportsTable] Rendering 2 reports
  [Report 0]: {
    id: 123,
    role: "Moderator",
    roleId: "456",
    channel: "reports",
    channelId: "789",
    interval: 60,
    lastReport: "2/8/2026, 2:00:00 PM",
    nextReport: "2/8/2026, 3:00:00 PM"
  }
```

**Grid View Autopurge:**
```
[updateAutopurgeTable] Called with: 2 items
[updateAutopurgeTable] Rendering 2 autopurge settings
  [Autopurge 0]: {
    id: 456,
    channel: "spam",
    channelId: "789",
    type: "bots",
    lines: 10,
    interval: 30,
    lastPurge: "2/8/2026, 1:30:00 PM"
  }
```

**Tabbed View Reports:**
```
[updateReportsTableTab] Called with: 2 items
[updateReportsTableTab] Rendering 2 reports
  [Report 0]: {...}
```

**Tabbed View Autopurge:**
```
[updateAutopurgeTableTab] Called with: 2 items
[updateAutopurgeTableTab] Rendering 2 autopurge settings
  [Autopurge 0]: {...}
```

#### Error Indicators

**Data Not Loading:**
```
[updateReportsTable] Called with: 0 items
[updateReportsTable] No reports, showing empty state
```

**This means:**
- Either API is not returning data
- Or data is being passed as empty array
- Check `/api/dashboard` endpoint response

### Debugging Steps

#### Step 1: Check API Response
```javascript
// In browser console:
fetch('/api/dashboard?guildId=YOUR_GUILD_ID')
  .then(r => r.json())
  .then(data => {
    console.log('Reports:', data.reports);
    console.log('Autopurge:', data.autopurge);
  });
```

#### Step 2: Check updateDashboard is Being Called
1. Search console for: `[Dashboard] Setting allTimers array`
2. Should appear every 30 seconds (refresh interval)
3. If not appearing, dashboard.js API may be having issues

#### Step 3: Check Data is Being Received
```javascript
// In browser console, after API loads:
document.querySelectorAll('#reportsTableBody tr')
```

Should show:
- If data loaded: Multiple `<tr>` elements with data
- If empty: Single `<tr>` with colspan (empty state)

## Form Testing

### Adding a New Report (Grid View)

1. Fill in form fields:
   - Role to Monitor: Select a role from dropdown
   - Post to Channel: Select a channel from dropdown
   - Interval (minutes): Enter a number, e.g., 60
2. Click "➕ Add Report" button
3. Should see:
   - Success alert: "Scheduled report added successfully!"
   - Form clears
   - Dashboard refreshes and shows new report

4. Check console for:
   ```
   Error adding report: [if there's an error]
   ```

### Adding a New Autopurge Setting (Grid View)

1. Fill in form fields:
   - Channel to Purge: Select a channel
   - Message Type: Select type (All Messages, Bot Messages Only, Embeds Only)
   - Messages to Purge: Enter number, e.g., 10
   - Interval (minutes): Enter number, e.g., 30
2. Click "➕ Add Setting" button
3. Should see:
   - Success alert: "Auto-purge setting added successfully!"
   - Form clears
   - Dashboard refreshes and shows new setting

### Same Tests for Tabbed View

1. Click "📋 Scheduled Reports" tab
2. Repeat form testing above
3. Click "🗑️ Auto-Purge Settings" tab
4. Repeat form testing above

## Table Display Testing

### Reports Table Columns
Should show: `Role | Channel | Interval | Last Report | Actions`
- NOT: Role, Channel, Interval, Last Report, **Next Report**, Actions (old structure)

### Autopurge Table Columns
Should show: `Channel | Type | Messages to Purge | Interval | Last Purge | Actions`

## Delete Button Testing

### Grid View
1. Find a report/setting in the table
2. Click the 🗑️ delete button
3. Confirm the deletion
4. Should see success message and table updates

### Tabbed View
1. Switch to the respective tab
2. Repeat steps above

## Expected Console Output Sequence

When dashboard loads, you should see in order:

```
[Dashboard] ========== updateDashboard() STARTED ==========
[Dashboard] Bot status: online
[Dashboard] Setting status badge
[Dashboard] Updating stats...
[Dashboard] Setting allTimers array...
[Dashboard] Extracting unique roles...
[Dashboard] Populating role selector...
[Dashboard] Updating reports table...
[Dashboard] data.reports content: [Array with 2+ items]
[updateReportsTable] Called with: 2 items
[updateReportsTable] Rendering 2 reports
  [Report 0]: {...}
  [Report 1]: {...}
[Dashboard] Updating autopurge table...
[Dashboard] data.autopurge content: [Array with 2+ items]
[updateAutopurgeTable] Called with: 2 items
[updateAutopurgeTable] Rendering 2 autopurge settings
  [Autopurge 0]: {...}
  [Autopurge 1]: {...}
[Dashboard] Populating tabbed view...
[Dashboard] Calling updateReportsTableTab with: [Array with 2+ items]
[updateReportsTableTab] Called with: 2 items
[updateReportsTableTab] Rendering 2 reports
  [Report 0]: {...}
  [Report 1]: {...}
[Dashboard] Calling updateAutopurgeTableTab with: [Array with 2+ items]
[updateAutopurgeTableTab] Called with: 2 items
[updateAutopurgeTableTab] Rendering 2 autopurge settings
  [Autopurge 0]: {...}
  [Autopurge 1]: {...}
[Dashboard] Updating lastUpdate...
[Dashboard] ========== updateDashboard() COMPLETED SUCCESSFULLY ==========
```

## Troubleshooting

### Tables Show Empty State But Stats Show Numbers

**Problem:** Stats show "2 Scheduled Reports" but table is empty
**Solution:**
1. Check console for `[updateReportsTable] No reports, showing empty state`
2. Check API response: Does `/api/dashboard` return `reports: []`?
3. If API returns data but tables are empty:
   - Check browser DevTools Network tab
   - Look at `/api/dashboard` response body
   - Verify data format matches expected structure

### Console Shows 0 Items But I Added Data

**Problem:** Console says "Called with: 0 items" but I just added items
**Solution:**
1. Verify data was saved by checking database directly
2. Check if `loadDashboard()` was called after adding item
3. Verify API `/api/dashboard` returns the new items
4. May need to wait 30 seconds for next refresh (or refresh manually)

### Dropdowns Are Empty

**Problem:** Role/Channel dropdowns show no options
**Solution:**
1. Check console for: `[Dropdown] Loaded: X users, Y roles, Z channels`
2. If 0 roles/channels, verify `/api/dropdown-data` endpoint is working
3. Verify Discord bot has access to guild's roles and channels
4. Check bot permissions in Discord server

### Delete Button Doesn't Work

**Problem:** Delete button click has no effect
**Solution:**
1. Check console for delete error messages
2. Verify `deleteReport()` or `deleteAutopurgeSetting()` functions are defined
3. Check that API endpoints exist: `/api/report/delete`, `/api/autopurge/delete`
4. Verify report/setting ID is correct in the button onclick attribute

## Performance Considerations

- Dashboard refreshes every 30 seconds
- Member count refreshes every hour
- Dropdowns refresh every minute
- Console logging may impact performance with many records
- Consider clearing old logs if performance degrades

## Final Verification Checklist

- [ ] Console shows successful data loading
- [ ] Grid view Reports table has data
- [ ] Grid view Autopurge table has data
- [ ] Tabbed view Reports table has data
- [ ] Tabbed view Autopurge table has data
- [ ] Forms can add new items
- [ ] Delete buttons work
- [ ] Empty states show when no data
- [ ] No console errors or warnings
- [ ] Column counts match headers
- [ ] Date formatting is readable
- [ ] Type mapping shows correct display values
