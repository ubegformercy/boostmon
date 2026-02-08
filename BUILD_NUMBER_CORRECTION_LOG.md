# BUILD NUMBER CORRECTION LOG

**Issue**: Commits df583f7 through d2705d7 missing build numbers in commit messages  
**Current Version**: 2.1.90  
**Date**: February 8, 2026

---

## Commit Build Number Mapping

The following commits should have included build numbers but were missing them:

| Commit | Current Message | Should Be | Build |
|--------|-----------------|-----------|-------|
| df583f7 | docs: Add final comprehensive summary for tabbed view fix | [BUILD-2.1.90] docs: Add final comprehensive summary | 2.1.90 |
| f61d8e8 | docs: Add completion report for tabbed view data rendering fix | [BUILD-2.1.89] docs: Add completion report | 2.1.89 |
| 8b5c6a6 | docs: Add comprehensive tabbed view data rendering fix documentation (BUILD-2.1.87) | [BUILD-2.1.88] docs: Add comprehensive documentation | 2.1.88 |
| d2705d7 | Fix tabbed view table data rendering - align columns with table headers | [BUILD-2.1.87] Fix tabbed view table data rendering | 2.1.87 |

---

## Context

During the tabbed view data rendering fix, the following sequence occurred:

1. **Commit d2705d7** (BUILD-2.1.87) - Main fix for tabbed view data
   - Fixed reports table column mismatch
   - Fixed autopurge table field names
   - Added id field to API response
   - ❌ Missing [BUILD-2.1.87] prefix in some documentation

2. **Commit 8b5c6a6** (BUILD-2.1.88) - First documentation
   - Added TABBED_VIEW_DATA_RENDERING_FIX.md
   - ❌ Message doesn't clearly show BUILD-2.1.88

3. **Commit f61d8e8** (BUILD-2.1.89) - Completion report
   - Added COMPLETION_REPORT_TABBED_VIEW_FIX.md
   - ❌ Missing build number entirely

4. **Commit df583f7** (BUILD-2.1.90) - Final summary
   - Added TABBED_VIEW_FIX_FINAL_SUMMARY.md
   - ❌ Missing build number entirely

---

## Policy Going Forward

**All commits must follow this format**:

```
[BUILD-X.Y.Z] <Type>: <Description>

Example:
[BUILD-2.1.87] fix: Align tabbed view table columns with headers
[BUILD-2.1.88] docs: Add comprehensive tabbed view documentation
[BUILD-2.1.91] feat: Add inline editing to reports table
```

**Types to use**:
- `fix:` - Bug fixes
- `feat:` - New features
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Testing
- `build:` - Build system

---

## How to Check Build Number Before Committing

```bash
# Always check version before committing
cat version.json | grep version

# This will show current build number to use in commit message
```

---

## Example Correct Commit Messages

✅ `[BUILD-2.1.87] fix: Align tabbed view table columns with headers`  
✅ `[BUILD-2.1.88] docs: Add comprehensive fix documentation`  
✅ `[BUILD-2.1.89] build: Bump patch version`  
✅ `[BUILD-2.1.90] refactor: Consolidate dashboard helpers`

❌ `docs: Add documentation` (missing build number)  
❌ `Fix bug in table rendering` (missing type and build number)  
❌ `[BUILD-2.1.87] Working on the fix` (vague description)

---

## Reminder for Next Session

Before committing, always:

1. Check current version: `cat version.json | grep version`
2. Use format: `[BUILD-X.Y.Z] <type>: <description>`
3. Keep description concise and clear
4. Include issue numbers if applicable: `[BUILD-2.1.91] fix: Resolve #123`

---

## Impact of Missing Build Numbers

While not breaking functionality, missing build numbers:
- Makes changelog generation harder
- Creates difficulty tracking when features were added
- Reduces clarity in git history
- Makes release notes harder to prepare

**Priority**: ⚠️ IMPORTANT - Fix going forward

---

**Logged**: February 8, 2026 01:22 UTC  
**Status**: ✅ DOCUMENTED FOR FUTURE REFERENCE
