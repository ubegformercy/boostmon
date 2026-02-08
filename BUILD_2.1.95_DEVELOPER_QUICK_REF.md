# BUILD-2.1.95: Developer Quick Reference

## File Structure

### Main Dashboard HTML
**File:** `/workspaces/nodejs/public/dashboard.html`

| Section | Lines | Description |
|---------|-------|-------------|
| Reports Grid Form | 1275-1315 | Add new report form for grid view |
| Reports Grid Table | 1316-1330 | Display reports in grid view |
| Autopurge Grid Form | 1332-1380 | Add new autopurge setting form for grid view |
| Autopurge Grid Table | 1381-1400 | Display autopurge settings in grid view |
| Reports Tab Form | 1540-1575 | Add new report form for tabbed view |
| Reports Tab Table | 1576-1590 | Display reports in tabbed view |
| Autopurge Tab Form | 1590-1630 | Add new autopurge form for tabbed view |
| Autopurge Tab Table | 1631-1650 | Display autopurge in tabbed view |

### JavaScript Functions

#### Form Handlers
```javascript
// Grid View
handleAddReport(event)           // Line ~2802: Reports form submission
handleAddAutopurge(event)        // Line ~3180: Autopurge form submission

// Tabbed View
handleAddReportTab(event)        // Line ~2843: Reports tab form submission
handleAddAutopurgeTab(event)     // Line ~3220: Autopurge tab form submission

// Old functions (deprecated but still exist)
addNewReport()                   // Replaced by handleAddReport()
addNewAutopurgeSetting()         // Replaced by handleAddAutopurge()
```

#### Table Update Functions
```javascript
// Grid View
updateReportsTable(reports)      // Line ~3000: Render reports in grid
updateAutopurgeTable(autopurge)  // Line ~3050: Render autopurge in grid

// Tabbed View
updateReportsTableTab(reports)   // Line ~3134: Render reports in tab
updateAutopurgeTableTab(autopurge) // Line ~3178: Render autopurge in tab
```

#### Helper Functions
```javascript
editReportInterval(reportId, currentInterval)     // Edit report interval
updateReportInterval(reportId, intervalMinutes)   // Update interval in API
deleteReport(reportId)                             // Delete a report

editAutopurgeSetting(channelId, field, value)     // Edit autopurge field
updateAutopurgeSetting(channelId, field, newValue) // Update autopurge in API
deleteAutopurgeSetting(channelId)                  // Delete autopurge setting
```

## HTML Form Element IDs

### Grid View Forms
```javascript
// Reports Form (Grid)
'reportRole'         // Select role to monitor
'reportChannel'      // Select channel to post to
'reportInterval'     // Interval in minutes
'addReportForm'      // Form element (for reset)

// Autopurge Form (Grid)
'autopurgeChannel'   // Select channel to purge
'autopurgeType'      // Message type (all, bots, embeds)
'autopurgeLines'     // Number of messages to delete
'autopurgeInterval'  // Interval in minutes
'addAutopurgeForm'   // Form element (for reset)
```

### Tabbed View Forms
```javascript
// Reports Form (Tab)
'reportRoleTab'      // Select role to monitor
'reportChannelTab'   // Select channel to post to
'reportIntervalTab'  // Interval in minutes
'addReportFormTab'   // Form element (for reset)

// Autopurge Form (Tab)
'autopurgeChannelTab'   // Select channel to purge
'autopurgeTypeTab'      // Message type
'autopurgeLinesTab'     // Number of messages to delete
'autopurgeIntervalTab'  // Interval in minutes
'autopurgeFormTab'      // Form element (for reset)
```

### Table Element IDs
```javascript
// Grid View Tables
'reportsTableBody'     // Tbody for reports table
'autopurgeTableBody'   // Tbody for autopurge table

// Tabbed View Tables
'reportsTableBodyTab'  // Tbody for reports tab table
'autopurgeTableBodyTab' // Tbody for autopurge tab table
```

## Common Tasks

### Adding a New Field to Reports

1. **Add to HTML form (grid and tab)**
   ```html
   <div class="form-group">
       <label for="reportNewField">New Field</label>
       <input id="reportNewField" type="text" required>
   </div>
   ```

2. **Update form handlers**
   ```javascript
   async function handleAddReport(event) {
       // ... existing code ...
       const newField = document.getElementById('reportNewField').value;
       // ... pass to API ...
   }
   ```

3. **Update table rendering functions**
   ```javascript
   function updateReportsTable(reports) {
       // ... existing code ...
       return `
           <tr>
               <!-- ... existing columns ... -->
               <td>${report.newField}</td>
           </tr>
       `;
   }
   ```

4. **Update API endpoint** (in `routes/dashboard.js`)
   ```javascript
   const formattedSchedules = (schedules || []).map((schedule) => {
       return {
           // ... existing fields ...
           newField: schedule.new_field_column,
       };
   });
   ```

### Changing Display Format

**Example: Change date format**

Find the date rendering:
```javascript
// OLD
const lastReport = report.lastReport || 'Never';

// NEW
const lastReport = report.lastReport 
    ? new Date(report.lastReport).toDateString()
    : 'Never';
```

### Adding New Form Validation

```javascript
// In handleAddReport(event)
if (intervalMinutes <= 0) {
    showAlert('Interval must be greater than 0', 'error');
    return false;
}

// Add more conditions before the try block
if (someNewValidation) {
    showAlert('Validation error message', 'error');
    return false;
}
```

### Debugging Console Logs

**Run this in browser console to inspect data:**

```javascript
// Check what's in reports table
const tbody = document.getElementById('reportsTableBody');
console.log('Reports table body:', tbody.innerHTML);

// Check what the API is returning
fetch('/api/dashboard?guildId=YOUR_GUILD_ID')
    .then(r => r.json())
    .then(data => {
        console.log('API Reports:', data.reports);
        console.log('API Autopurge:', data.autopurge);
        console.log('API Stats:', data.stats);
    });

// Check form values
console.log('reportRole value:', document.getElementById('reportRole').value);
console.log('reportChannel value:', document.getElementById('reportChannel').value);
console.log('reportInterval value:', document.getElementById('reportInterval').value);
```

## API Endpoints

### Getting Data
```
GET /api/dashboard?guildId=GUILD_ID

Response:
{
    stats: {
        activeTimers: number,
        scheduledReports: number,
        autopurgeSettings: number
    },
    reports: [{
        id, role, roleId, channel, channelId, 
        interval, lastReport, nextReport
    }],
    autopurge: [{
        id, channel, channelId, type, lines, 
        interval, lastPurge
    }]
}
```

### Adding New Items
```
POST /api/report/add?guildId=GUILD_ID
Body: { roleId, channelId, intervalMinutes }

POST /api/autopurge/add?guildId=GUILD_ID
Body: { channelId, type, lines, intervalMinutes }
```

### Updating Items
```
PATCH /api/report/update?guildId=GUILD_ID
Body: { reportId, intervalMinutes }

PATCH /api/autopurge/update?guildId=GUILD_ID
Body: { channelId, field, newValue }
```

### Deleting Items
```
DELETE /api/report/delete?guildId=GUILD_ID
Body: { reportId }

DELETE /api/autopurge/delete?guildId=GUILD_ID
Body: { channelId }
```

## Troubleshooting Checklist

### Tables Show Empty
1. ✅ Check console for `[updateReportsTable] Rendering X` logs
2. ✅ Verify API `/api/dashboard` returns data
3. ✅ Check table tbody element with DevTools
4. ✅ Verify guildId is set correctly

### Forms Don't Submit
1. ✅ Check console for form submission logs
2. ✅ Verify form has `onsubmit` handler
3. ✅ Check that button has `type="submit"`
4. ✅ Verify form element ID matches JavaScript

### Dropdowns Empty
1. ✅ Check `/api/dropdown-data` returns roles/channels
2. ✅ Verify bot has guild access
3. ✅ Check console for `[Dropdown] Loaded` log
4. ✅ Verify Discord bot permissions

### Delete Buttons Don't Work
1. ✅ Check console for delete API call
2. ✅ Verify delete endpoint returns 200 OK
3. ✅ Check button onclick has correct ID
4. ✅ Verify dashboard refreshes after delete

## Version History

- **2.1.95** - Complete rebuild of Reports and Autopurge sections
- **2.1.94** - Added debugging logging to grid view
- **2.1.93** - Added debugging logging to updateDashboard()
- **2.1.92** - Fixed git commit message format
- **2.1.91** - Created commit message style guide
- **2.1.90** - Comprehensive documentation of tabbed view fix
- **2.1.89** - Tabbed view fix documentation
- **2.1.88** - Tabbed view fix documentation
- **2.1.87** - Initial column count fix

## Code Style Guidelines

### Form Handlers
```javascript
async function handleAdd[Feature](event) {
    event.preventDefault();  // ✅ Always
    
    // Get values
    const value = document.getElementById('fieldId').value.trim();
    
    // Validate
    if (!value) {
        showAlert('Error message', 'error');
        return false;  // ✅ Always
    }
    
    // Try operation
    try {
        const response = await fetch(`/api/...`);
        if (!response.ok) throw new Error(await response.json());
        
        showAlert('Success message', 'success');
        document.getElementById('formId').reset();  // ✅ Use .reset()
        loadDashboard();
    } catch (err) {
        console.error('Error:', err);
        showAlert(`Error: ${err.message}`, 'error');
    }
    return false;  // ✅ Always
}
```

### Table Update Functions
```javascript
function update[Feature]Table(items) {
    const tbody = document.getElementById('tableBodyId');
    console.log('[update[Feature]Table] Called with:', items?.length || 0, 'items');
    
    if (!items || items.length === 0) {
        console.log('[update[Feature]Table] No items, showing empty state');
        tbody.innerHTML = `<tr><td colspan="X">Empty state</td></tr>`;
        return;
    }
    
    console.log('[update[Feature]Table] Rendering', items.length, 'items');
    tbody.innerHTML = items.map((item, idx) => {
        console.log(`  [Item ${idx}]:`, item);
        return `<tr>...</tr>`;
    }).join('');
}
```

## Best Practices

1. ✅ Always use `.trim()` on text inputs
2. ✅ Always use `.reset()` on forms, not manual clearing
3. ✅ Always include `event.preventDefault()` in form handlers
4. ✅ Always return `false` from form handlers
5. ✅ Always add console logging for debugging
6. ✅ Always handle missing/null values gracefully
7. ✅ Always separate grid view from tabbed view code
8. ✅ Always verify column counts match headers
9. ✅ Always include try/catch around API calls
10. ✅ Always show user feedback (success/error alerts)
