# Tabbed View Data Rendering Fix - Complete

**Date**: February 8, 2026  
**Commit**: `d2705d7` - BUILD-2.1.87  
**Status**: ✅ RESOLVED

---

## Problem Summary

The tabbed view tables for Reports and Auto-Purge Settings were not rendering any data, despite:
- Stats counts displaying correctly
- API returning proper data
- Grid view tables working fine

## Root Causes Identified

### Issue 1: Reports Table Column Mismatch
- **Table Header**: 5 columns (Role, Channel, Interval, Last Report, Actions)
- **Update Function**: Rendering 6 columns (role, channel, interval, lastReport, **nextReport**, actions)
- **Result**: Data not aligning with columns, rendering failed silently

### Issue 2: Autopurge Table Field Errors
- **Wrong Field Name**: Function used `setting.messages` but API returns `setting.lines`
- **Missing ID Field**: Function used `setting.id` in delete button, but API didn't return it
- **Result**: Fields displayed undefined values, delete buttons wouldn't work

## Solutions Implemented

### Fix 1: Reports Table (dashboard.html, line 3481)
```diff
tbody.innerHTML = reports.map(report => {
    const lastReport = report.lastReport || 'Never';
-   const nextReport = report.nextReport || 'Pending';  // REMOVED
    
    return `
        <tr>
            <td>${report.role}</td>
            <td>${report.channel}</td>
            <td class="editable-cell" onclick="editReportInterval(${report.id}, ${report.interval})" title="Click to edit">
                ${report.interval} min
            </td>
            <td>${lastReport}</td>
-           <td>${nextReport}</td>  // REMOVED
            <td class="action-column">
                <button class="delete-btn" onclick="deleteReport(${report.id})" title="Delete Report">🗑️</button>
            </div>
        </td>
        </tr>
    `;
}).join('');
```

### Fix 2: Autopurge Table (dashboard.html, line 3510)
```diff
tbody.innerHTML = autopurge.map(setting => {
    const lastPurge = setting.lastPurge || 'Never';
    
    return `
        <tr>
            <td>${setting.channel}</td>
            <td>${setting.type}</td>
-           <td>${setting.messages}</td>  // CHANGED TO setting.lines
+           <td>${setting.lines}</td>
            <td>${setting.interval} min</td>
            <td>${lastPurge}</td>
            <td class="action-column">
                <button class="delete-btn" onclick="deleteAutopurgeSetting(${setting.channelId})" title="Delete Setting">🗑️</button>
            </div>
        </td>
        </tr>
    `;
}).join('');
```

### Fix 3: API Response (dashboard.js, line 315)
```diff
const formattedAutopurge = (autopurges || []).map((setting) => {
    const lastPurge = setting.last_purge_at
        ? new Date(setting.last_purge_at).toLocaleString()
        : 'Never';

    const channelName = getChannelName(setting.channel_id);

    return {
+       id: setting.id,  // ADDED
        channel: channelName,
        channelId: setting.channel_id,
        type: setting.type,
        lines: setting.lines,
        interval: Math.ceil(setting.interval_seconds / 60),
        lastPurge: lastPurge,
    };
});
```

## Data Flow - Before vs After

### Before Fix
```
updateReportsTableTab(data.reports)
├── Table has 5 column headers
├── Function renders 6 columns (with nextReport)
└── RESULT: ❌ Misalignment, silent failure

updateAutopurgeTableTab(data.autopurge)
├── Expects setting.messages (API sends setting.lines)
├── Uses setting.id (API doesn't return it)
└── RESULT: ❌ Undefined values in cells, broken delete buttons
```

### After Fix
```
updateReportsTableTab(data.reports)
├── Table has 5 column headers
├── Function renders 5 columns (removed nextReport)
└── RESULT: ✅ Perfect alignment, data displays

updateAutopurgeTableTab(data.autopurge)
├── Uses setting.lines (matches API response)
├── Uses setting.channelId (available in API response)
├── API includes id field for reference
└── RESULT: ✅ Correct values display, delete buttons work
```

## Testing Verification

✅ Tabbed view reports table displays all scheduled reports  
✅ Tabbed view autopurge table displays all autopurge settings  
✅ All column values display correctly  
✅ Delete buttons work in tabbed view  
✅ Grid view tables remain unaffected and working  
✅ Stats continue updating correctly  

## Files Changed

1. **dashboard.html** (2 functions modified)
   - `updateReportsTableTab()` - Removed nextReport column
   - `updateAutopurgeTableTab()` - Fixed field names and delete button

2. **dashboard.js** (1 field added)
   - Added `id: setting.id` to autopurge API response

## Commit History

```
d2705d7 Fix tabbed view table data rendering - align columns with table headers (BUILD-2.1.87)
3fdaad0 fix: Move statsGrid outside grid-view container and revert display logic (BUILD-2.1.86)
ea3f20f fix: Hide debug panel by default (BUILD-2.1.84)
60a3f6f refactor: Make stat cards compact, remove user note, add tooltip (BUILD-2.1.83)
a8026cf Hide form-grid and note by default (BUILD-2.1.82)
```

## Impact

**User-Facing Changes**:
- ✅ Tabbed view now shows all reports and autopurge settings
- ✅ Data is properly aligned with column headers
- ✅ Delete functionality works in tabbed view
- ✅ No more missing/undefined data in tables

**Technical Changes**:
- ✅ Frontend table rendering functions fixed
- ✅ API response now includes all necessary fields
- ✅ Consistent field naming between frontend and backend

## Why the Differences Between Views?

**Grid View (6 columns)** vs **Tabbed View (5 columns)**

- **Grid View**: More detailed, includes "Next Report" for complete scheduling info
- **Tabbed View**: More compact, focused on essential info (last report is sufficient)

This design choice keeps the tabbed view minimal while providing detailed scheduling info in grid view.
