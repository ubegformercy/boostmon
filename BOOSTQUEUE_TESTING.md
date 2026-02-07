# 🧪 Boost Queue Testing Guide

## Test Environment Setup

**Prerequisites:**
- BoostMon bot running
- Access to a test Discord server with Admin permissions
- The bot has role management permissions

---

## Phase 1: Basic Functionality Tests

### Test 1.1: Add User to Queue
**Steps:**
1. Run: `/boostqueue add`
2. Expected: ✅ Added to Boost Queue at position #1

**Verify in Database:**
```sql
SELECT * FROM boost_queue WHERE guild_id = 'YOUR_GUILD_ID';
```
Expected: 1 row with status='pending', position_order=1

---

### Test 1.2: Add Multiple Users to Queue
**Steps:**
1. Switch to User B (or have someone else join)
2. Run: `/boostqueue add`
3. Expected: ✅ Added at position #2
4. Switch to User C
5. Run: `/boostqueue add note: Test note`
6. Expected: ✅ Added at position #3

**Verify:**
```sql
SELECT user_id, position_order FROM boost_queue 
WHERE guild_id = 'YOUR_GUILD_ID' 
ORDER BY position_order;
```
Expected:
- User A: position 1
- User B: position 2
- User C: position 3

---

### Test 1.3: View Queue
**Steps:**
1. Run: `/boostqueue view`
2. Expected: Shows all 3 users with positions, timestamps, and notes

**Verify:**
- User A shown as #1
- User B shown as #2
- User C shown as #3 with note visible
- All timestamps are recent

---

### Test 1.4: Check Status
**Steps:**
1. Switch to User A
2. Run: `/boostqueue status`
3. Expected: Your Position: #1 of 3, People Ahead: 0

**Steps:**
1. Switch to User C
2. Run: `/boostqueue status`
3. Expected: Your Position: #3 of 3, People Ahead: 2

---

### Test 1.5: Remove User from Queue
**Steps:**
1. Switch to User B
2. Run: `/boostqueue remove`
3. Expected: ❌ Removed from Queue

**Verify Queue Updated:**
1. Run: `/boostqueue view`
2. Expected: Only User A (#1) and User C (#2)

**Verify in Database:**
```sql
SELECT user_id, position_order FROM boost_queue 
WHERE guild_id = 'YOUR_GUILD_ID' AND status = 'pending'
ORDER BY position_order;
```
Expected:
- User A: position 1
- User C: position 2 (reordered from 3!)

---

### Test 1.6: Duplicate Prevention
**Steps:**
1. Switch to User A
2. Run: `/boostqueue add` again
3. Expected: ⚠️ Already in Queue at position #1 (not added twice)

**Verify:**
```sql
SELECT COUNT(*) FROM boost_queue 
WHERE guild_id = 'YOUR_GUILD_ID' AND user_id = 'USER_A_ID' AND status = 'pending';
```
Expected: 1 row only

---

## Phase 2: Admin Permission Tests

### Test 2.1: Admins Can Remove Others
**Setup:**
- Regular user is in queue
- Admin is in queue

**Steps:**
1. As Admin, run: `/boostqueue remove @regular_user`
2. Expected: ❌ User removed from queue

**Verify:**
- User is gone from queue
- Admin still in queue

---

### Test 2.2: Non-Admins Can't Remove Others
**Setup:**
- Regular user A and B both in queue

**Steps:**
1. As User A, run: `/boostqueue remove @user_b`
2. Expected: ⛔ Only admins can remove others (error message)

**Verify:**
- User B still in queue
- Error message shown

---

### Test 2.3: Complete User (Admin Only)
**Setup:**
- Multiple users in queue:
  - User A: #1
  - User B: #2
  - User C: #3

**Steps:**
1. As Admin, run: `/boostqueue complete @user_a`
2. Expected: ✅ Boost Completed with "Next in Queue: User B"

**Verify Queue Updated:**
1. Run: `/boostqueue view`
2. Expected:
   - User B: #1 (promoted!)
   - User C: #2 (reordered)

**Verify Database:**
```sql
SELECT user_id, status, completed_by FROM boost_queue 
WHERE guild_id = 'YOUR_GUILD_ID' 
ORDER BY position_order;
```
Expected:
- User A: status='completed', completed_by=admin_id
- User B: status='pending', position_order=1
- User C: status='pending', position_order=2

**Check User B's DMs:**
- Expected: Notification "🎉 You're Next!" received

---

### Test 2.4: Non-Admins Can't Mark Complete
**Steps:**
1. As Regular User, run: `/boostqueue complete @someone`
2. Expected: ⛔ Only admins can mark complete (error message)

**Verify:**
- Queue unchanged
- Error message shown

---

## Phase 3: Integration Tests

### Test 3.1: /settime Auto-Removes User
**Setup:**
- User A in queue at #1
- User B in queue at #2
- Have a boost role set up

**Steps:**
1. As Admin, run: `/settime @user_a 60 @BoostRole`
2. Expected: ✅ Timed Role Activated (normal settime message)

**Verify User Removed:**
1. Run: `/boostqueue view`
2. Expected: Only User B shown as #1

**Verify Database:**
```sql
SELECT user_id, status FROM boost_queue 
WHERE guild_id = 'YOUR_GUILD_ID' AND status = 'pending';
```
Expected: Only User B

**Verify User B's DM:**
- Expected: Notification "🎉 You're Next!" received

---

### Test 3.2: /addtime Auto-Removes User
**Setup:**
- User A in queue at #1 (with no timer yet)
- User B in queue at #2

**Steps:**
1. First, set User A a base timer: `/settime @user_a 10 @BoostRole`
2. Then, as Admin, run: `/addtime @user_a 60 @BoostRole`
3. Expected: ✅ Timed Role Extended (normal addtime message)

**Verify User Removed:**
1. Run: `/boostqueue view`
2. Expected: Only User B shown

**Verify Database:**
```sql
SELECT user_id FROM boost_queue 
WHERE guild_id = 'YOUR_GUILD_ID' AND status = 'pending';
```
Expected: Only User B

---

### Test 3.3: Chain Completion Flow
**Setup:**
- User A: #1
- User B: #2
- User C: #3

**Steps:**
1. Admin: `/settime @user_a 60 @BoostRole`
   - Expected: User A removed, User B promoted to #1, gets DM
2. Admin: `/boostqueue complete @user_b` (or `/settime @user_b`)
   - Expected: User B removed, User C promoted to #1, gets DM
3. Admin: `/boostqueue complete @user_c`
   - Expected: User C removed, queue empty, no more promotions

**Verify Final State:**
1. Run: `/boostqueue view`
2. Expected: Queue is empty

---

## Phase 4: Edge Cases

### Test 4.1: Empty Queue Handling
**Steps:**
1. Ensure queue is empty
2. Run: `/boostqueue view`
3. Expected: "The boost queue is empty"

4. Run: `/boostqueue status`
5. Expected: "You are not in the boost queue"

---

### Test 4.2: Single User in Queue
**Setup:**
- Only User A in queue

**Steps:**
1. Run: `/boostqueue view`
2. Expected: Shows User A at #1 of 1

3. As Admin, run: `/boostqueue complete @user_a`
4. Expected: "Next in Queue: Queue is now empty! 🎉"

---

### Test 4.3: User Leaves and Rejoins
**Setup:**
- User A: #1
- User B: #2

**Steps:**
1. As User A, run: `/boostqueue remove`
2. Expected: Removed message

3. Verify: `/boostqueue view` shows only User B

4. As User A, run: `/boostqueue add note: Coming back`
5. Expected: Added at #2

6. Verify: `/boostqueue view` shows User B #1, User A #2

---

### Test 4.4: Removed User from Server
**Steps:**
1. Add 3 users to queue
2. Manually remove/ban User B from server
3. Run: `/boostqueue view`
4. Expected: Should still show User B in queue (bot can't know they left)

5. Admin tries: `/boostqueue remove @user_b` (by ID)
6. Expected: Should remove successfully

---

## Phase 5: Data Persistence

### Test 5.1: Queue Survives Bot Restart
**Setup:**
- Have 3 users in queue

**Steps:**
1. Note their positions
2. Stop the bot
3. Restart the bot
4. Run: `/boostqueue view`
5. Expected: Same 3 users at same positions

---

### Test 5.2: Database Backup/Recovery
**Steps:**
1. Backup database
2. Have users in queue
3. Simulate data corruption
4. Restore database
5. Run: `/boostqueue view`
6. Expected: Queue restored to backup state

---

## Phase 6: Performance Tests

### Test 6.1: Large Queue (50+ Users)
**Steps:**
1. Add 50+ users to queue programmatically
2. Run: `/boostqueue view`
3. Expected: Shows first 50, performance still acceptable

**Verify Database Query:**
```sql
EXPLAIN ANALYZE SELECT * FROM boost_queue 
WHERE guild_id = 'YOUR_GUILD_ID' AND status = 'pending'
ORDER BY position_order LIMIT 50;
```
Expected: Uses indexes, fast execution

---

### Test 6.2: Rapid Command Spam
**Steps:**
1. As User A, spam: `/boostqueue add` rapidly
2. Expected: Duplicate prevention works, only 1 entry created

3. Spam: `/boostqueue view` rapidly
4. Expected: No timeouts, all respond quickly

---

## Phase 7: Error Handling

### Test 7.1: Invalid Users
**Steps:**
1. Run: `/boostqueue remove @InvalidUser` (Discord will handle this)
2. Expected: Discord rejects before reaching bot

---

### Test 7.2: Database Connection Loss
**Steps:**
1. Stop database temporarily
2. Try: `/boostqueue view`
3. Expected: Graceful error message (bot shouldn't crash)

4. Restart database
5. Try: `/boostqueue view` again
6. Expected: Works normally

---

### Test 7.3: Missing Permissions
**Steps:**
1. Remove bot's Message Send permission in test channel
2. Admin: `/boostqueue complete @user` (next person should be promoted)
3. Expected: Command still works in DMs or other channels

---

## Test Report Template

```
Date: ___________
Tester: ___________
Version: v2.0.0

Phase 1: Basic Functionality
[ ] 1.1 Add user to queue
[ ] 1.2 Add multiple users
[ ] 1.3 View queue
[ ] 1.4 Check status
[ ] 1.5 Remove user
[ ] 1.6 Duplicate prevention

Phase 2: Admin Permissions
[ ] 2.1 Admins can remove others
[ ] 2.2 Non-admins can't remove others
[ ] 2.3 Complete user (admin only)
[ ] 2.4 Non-admins can't mark complete

Phase 3: Integration Tests
[ ] 3.1 /settime auto-removes
[ ] 3.2 /addtime auto-removes
[ ] 3.3 Chain completion flow

Phase 4: Edge Cases
[ ] 4.1 Empty queue
[ ] 4.2 Single user
[ ] 4.3 User leaves and rejoins
[ ] 4.4 Removed user from server

Phase 5: Data Persistence
[ ] 5.1 Queue survives restart
[ ] 5.2 Database recovery

Phase 6: Performance
[ ] 6.1 Large queue (50+ users)
[ ] 6.2 Rapid command spam

Phase 7: Error Handling
[ ] 7.1 Invalid users
[ ] 7.2 Database connection loss
[ ] 7.3 Missing permissions

Issues Found:
___________

Notes:
___________

Status: [ ] PASSED [ ] FAILED
```

---

## Success Criteria

✅ All Phase 1 tests pass  
✅ All Phase 2 tests pass  
✅ All Phase 3 tests pass  
✅ No unhandled errors  
✅ Database stays consistent  
✅ Permissions enforced  
✅ DMs sent correctly  

---

**Testing Date:** February 7, 2026  
**Status:** Ready for Testing ✅
