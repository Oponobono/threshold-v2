# ✅ PHASE 6: EXECUTABLE STEP-BY-STEP CHECKLIST

**Status:** Ready to Execute  
**Last Updated:** 2026-06-04  
**Estimated Duration:** 4-6 hours (full verification)

---

## 🚀 PHASE 0: PRE-FLIGHT (15 minutes)

### ✓ Step 0.1: Verify Prerequisites
```powershell
# Windows: Open PowerShell as Administrator
whoami  # Confirm you're logged in

# Verify Node.js
node --version  # Should be v18+
npm --version   # Should be v9+

# If missing:
# Download from: https://nodejs.org (LTS version)
```

**✅ Check:** Node.js installed and up to date

---

### ✓ Step 0.2: Navigate to Project Root
```powershell
cd "c:\Users\cris7\OneDrive\Desktop\Threshold"
pwd  # Should show: c:\Users\cris7\OneDrive\Desktop\Threshold

# Verify structure
ls  # Should see: mobile/, scripts/, backend/, etc.
```

**✅ Check:** In correct directory

---

### ✓ Step 0.3: Run Pre-flight Check Script
```powershell
# Execute the quick start script
.\start-phase6.ps1

# Expected output:
# ╔════════════════════════════════════════════════════════════════╗
# ║           🚀 FASE 6: UUID MIGRATION - QUICK START             ║
# ╚════════════════════════════════════════════════════════════════╝
#
# ...checks running...
#
# ✨ ALL CHECKS PASSED! (20/20)
# You are ready for Phase 6 testing!
```

**✅ Check:** All 20 checks pass (if not, fix issues before proceeding)

---

## 🧪 PHASE 1: UNIT TESTS (15 minutes)

### ✓ Step 1.1: Navigate to Mobile Directory
```powershell
cd mobile
pwd  # Should show: .../Threshold/mobile

# Verify jest configuration
ls jest.config.js  # Should exist
```

**✅ Check:** jest.config.js found

---

### ✓ Step 1.2: Run Unit Tests
```powershell
# Run the offline-sync test suite with verbose output
npm run test -- offline-sync.test.ts --verbose

# Expected output format:
# PASS  src/__tests__/offline-sync.test.ts
#   UUID Generation & Validation
#     ✓ generates valid UUID v4 format (2ms)
#     ✓ each call generates different UUID (1ms)
#     ... 5 more tests
#   Offline Operations
#     ✓ creates subject offline with UUID persistence (5ms)
#     ... 4 more tests
#   Sync Queue Management
#     ✓ marks operation as processing (2ms)
#     ... 4 more tests
#   Conflict Resolution
#     ✓ last-write-wins: newer updated_at wins (3ms)
#     ... 2 more tests
#   Data Integrity
#     ✓ UUID immutable during updates (2ms)
#     ... 2 more tests
#
# Tests: 23 passed, 0 failed
# Test Suites: 1 passed, 1 total
```

**✅ Check:** All 23+ tests pass

**⚠️ If tests fail:**
```
1. Read error message carefully
2. Check: mobile/src/__tests__/offline-sync.test.ts
3. Verify test databases are clean (no lock files)
4. Run: npm run test -- --clearCache
5. Try again
```

---

## 🔍 PHASE 2: INTEGRATION CHECKS (10 minutes)

### ✓ Step 2.1: Return to Root Directory
```powershell
cd ..  # Go back to /Threshold
pwd    # Should show: .../Threshold

# Verify scripts directory
ls scripts/phase6-verify.js  # Should exist
```

**✅ Check:** phase6-verify.js found

---

### ✓ Step 2.2: Run Integration Verification
```powershell
# Run the integration check script
node scripts/phase6-verify.js

# Expected output:
# 🔍 PHASE 6: QUICK INTEGRATION CHECK
#
# ════════════════════════════════════════════
#
# ✅ [1] DatabaseContext.tsx exists
# ✅ [2] DatabaseContext exports DatabaseProvider
# ✅ [3] DatabaseContext prevents render until DB ready
# ✅ [4] UserRepository.ts exists
# ✅ [5] UserRepository has methods...
# ... 13 more checks ...
# ✅ [18] offline-sync.test.ts has all test suites
#
# ════════════════════════════════════════════
#
# ✨ ALL CHECKS PASSED! (20/20)
# You are ready for Phase 6 testing!
```

**✅ Check:** All 20 checks pass

**⚠️ If integration checks fail:**
```
1. Note which check failed (e.g., "#5")
2. Read error message
3. Run: node scripts/phase6-verify.js again (to confirm)
4. Check specific file:
   - If [1-3] fail: Check mobile/src/context/DatabaseContext.tsx
   - If [4-6] fail: Check mobile/src/services/database/repositories/UserRepository.ts
   - If [7-9] fail: Check mobile/src/services/database/SyncService.ts
   - If [10-12] fail: Check mobile/src/utils/uuid.ts
   - If [13-15] fail: Check mobile/app/_layout.tsx
   - If [16-18] fail: Check mobile/src/services/database/
5. Escalate if needed
```

---

## 📱 PHASE 3: APP SETUP & BUILD (20 minutes)

### ✓ Step 3.1: Install Mobile Dependencies
```powershell
cd mobile
npm install
# or if you prefer yarn:
# yarn install

# Wait for installation to complete...
# Expected: No error messages
```

**✅ Check:** npm install completes without errors

---

### ✓ Step 3.2: Build Check (Optional, but recommended)
```powershell
# Run TypeScript type check
npm run type-check

# Expected output: No errors
# Or if no type-check script:
npx tsc --noEmit

# Should complete without errors
```

**✅ Check:** TypeScript compiles without errors

---

### ✓ Step 3.3: Start Development Environment
```powershell
# Option 1: iOS (Mac only)
npm run ios

# Option 2: Android (any platform with Android Studio)
npm run android

# Option 3: Expo Go (easiest, use on physical device)
npx expo start

# Wait for app to launch...
# Should see: "Ready at ..."
```

**✅ Check:** App launches without crashes

---

## 🧫 PHASE 4: MANUAL TESTING - TIER 1 (30 minutes)

### ✓ Step 4.1: Test Login Success
```
SETUP:
  1. App is running (from Phase 3)
  2. Open React Native Debugger or Expo Go console
  3. Have network access

STEPS:
  1. On Welcome screen → Tap "Sign In"
  2. Enter credentials:
     - Email: test@example.com
     - Password: password123
  3. Tap "Sign In"

VERIFICATION:
  ☑ No crash
  ☑ Navigation to (tabs) screen
  ☑ Network tab shows: POST /api/auth/login → 200 OK
  ☑ Console shows: "[Auth] Login success: user_id=550e8400-..."
  ☑ Console shows: "[DatabaseProvider] BD lista ✅"
  ☑ User object has UUID format: 550e8400-e29b-41d4-a456-...

EXPECTED CONSOLE LOGS:
  [DatabaseProvider] Inicializando BD local...
  [DatabaseProvider] BD lista ✅
  [Auth] Login attempt: test@example.com
  [Auth] Login success: user_id=550e8400-...
  [UserRepository] User saved: { id: 550e8400..., email: test@example.com }
```

**✅ Check:** Login succeeds, UUID created

**⚠️ If login fails:**
```
- Check credentials are correct
- Verify backend is running
- Check network connectivity
- Verify email in backend exists
```

---

### ✓ Step 4.2: Test Login Failure (Invalid Credentials)
```
STEPS:
  1. Welcome screen → Tap "Sign In"
  2. Enter credentials:
     - Email: test@example.com
     - Password: WRONG_PASSWORD
  3. Tap "Sign In"

VERIFICATION:
  ☑ Toast error: "Invalid credentials"
  ☑ Stays on login screen (no crash)
  ☑ Network tab shows: POST /api/auth/login → 401 Unauthorized
  ☑ No UserRepository logs (no DB insert)
```

**✅ Check:** Error handled gracefully

---

## 📝 PHASE 5: MANUAL TESTING - TIER 2 (1.5 hours)

### ✓ Step 5.1: Create Subject Offline
```
SETUP:
  1. Logged in successfully
  2. Settings → Airplane Mode ON (or disable WiFi)
  3. React Native Debugger open

STEPS:
  1. Home → Subjects tab
  2. Tap "+" button
  3. Enter:
     - Name: "Spanish 101"
     - Code: "SPN101"
     - Credits: 4
  4. Tap "Save"

OFFLINE VERIFICATION:
  ☑ Subject appears in list immediately
  ☑ Badge "_isPending" or offline icon visible
  ☑ Network tab empty (NO request)
  ☑ Console: "[SyncService] Encolando CREATE subject"
  ☑ SQLite (check with DevTools):
     - Row exists in subjects table
     - id = UUID format: 550e8400-...
     - user_id = your user UUID

SYNC VERIFICATION:
  5. Settings → Airplane Mode OFF
  6. Wait 2-3 seconds (listener triggers)

ONLINE VERIFICATION:
  ☑ Network tab: POST /api/subjects
  ☑ Badge disappears
  ☑ Console: "[SyncService] ✅ subject/{UUID} sincronizado"
  ☑ Refresh browser: Subject persists in backend
```

**✅ Check:** Offline create → Online sync works

---

### ✓ Step 5.2: Update Subject Offline
```
STEPS:
  1. Airplane Mode ON
  2. Tap "Spanish 101" subject
  3. Edit name to "Spanish 201"
  4. Tap "Save"
  5. Airplane Mode OFF
  6. Wait for sync

VERIFICATION:
  ☑ Offline: Local shows "Spanish 201"
  ☑ Online: UPDATE /api/subjects/{UUID} succeeds
  ☑ Server reflects change
  ☑ Console: No conflict warnings (first edit)
```

**✅ Check:** Update offline → sync online works

---

### ✓ Step 5.3: Delete Subject Offline
```
STEPS:
  1. Airplane Mode ON
  2. Tap subject → swipe left or long-press
  3. Tap "Delete" → Confirm
  4. Airplane Mode OFF
  5. Wait for sync

VERIFICATION:
  ☑ Offline: Subject deleted from UI
  ☑ SQLite: Row removed from subjects table
  ☑ Online: DELETE /api/subjects/{UUID} succeeds
  ☑ Backend: SELECT * FROM subjects WHERE id={UUID} → empty
```

**✅ Check:** Delete offline → sync online works

---

## 🔄 PHASE 6: CONFLICT RESOLUTION TEST (30 minutes)

### ✓ Step 6.1: Multi-Device Conflict
```
PRECONDITION:
  - 2 devices/emulators with same user logged in
  - Both connected to backend

DEVICE A:
  1. Airplane Mode ON
  2. Tap "Spanish 101"
  3. Change name to "Spanish 201"
  4. Tap "Save"
  5. Keep Airplane Mode ON

DEVICE B:
  1. Tap "Spanish 101"
  2. Change name to "Spanish Advanced"
  3. Tap "Save"
  4. Airplane Mode OFF
  5. Wait for sync

DEVICE A:
  6. Airplane Mode OFF
  7. Wait for sync

VERIFICATION:
  ☑ Device B: PUT /api/subjects/... → 200 (first)
  ☑ Device B: updated_at = T2
  ☑ Device A: PUT /api/subjects/... → 200 (second)
  ☑ Device A receives: name = "Spanish Advanced", updated_at = T2
  ☑ Device A Console: "[SyncService] Conflicto: last-write-wins decidió por REMOTE"
  ☑ BOTH DEVICES NOW SHOW: "Spanish Advanced"
  ☑ Database: ONE row (no duplication)
```

**✅ Check:** Conflict resolved correctly (last-write-wins)

---

## ✨ PHASE 7: FINAL VERIFICATION (30 minutes)

### ✓ Step 7.1: SQLite Integrity Check
```powershell
# Open Expo DevTools
# Storage tab → SQLite

# Run these queries:

# 1. Verify users table exists
SELECT * FROM users LIMIT 1;
# Expected: id (UUID), email, token, etc.

# 2. Verify subjects have UUIDs
SELECT COUNT(*) FROM subjects WHERE id LIKE '%-%-%-%-';
# Expected: > 0

# 3. Verify sync_queue is empty (all processed)
SELECT COUNT(*) FROM sync_queue WHERE status='pending';
# Expected: 0

# 4. Verify no orphaned records
SELECT * FROM sync_queue ORDER BY created_at DESC LIMIT 5;
# Expected: All with status='completed'
```

**✅ Check:** SQLite data is clean and valid

---

### ✓ Step 7.2: Backend Data Verification
```powershell
# If using PostgreSQL:
psql -U postgres -d threshold_db

# 1. Verify UUIDs in subjects
SELECT COUNT(*) FROM subjects WHERE id ~ '^[0-9a-f]{8}-[0-9a-f]{4}';
# Expected: > 0

# 2. Verify foreign keys are valid
SELECT * FROM subjects WHERE id NOT IN (SELECT id FROM users);
# Expected: 0 (no orphaned)

# 3. Verify timestamps are ISO 8601
SELECT updated_at FROM subjects LIMIT 1;
# Expected: 2026-06-04T16:45:00.000Z format
```

**✅ Check:** Backend data is valid

---

### ✓ Step 7.3: Review Console Logs
```
During all tests, verify these logs appear:

✅ App Start:
   [DatabaseProvider] Inicializando BD local...
   [DatabaseProvider] BD lista ✅

✅ Login:
   [Auth] Login attempt: {email}
   [Auth] Login success: user_id={UUID}
   [UserRepository] User saved: {id: UUID}

✅ Create Offline:
   [SyncService] Encolando CREATE subject

✅ Sync Online:
   [SyncService] Iniciando sync
   [SyncService] ✅ subject/{UUID} sincronizado

✅ Conflict:
   [SyncService] Conflicto: last-write-wins decidió por REMOTE|LOCAL

⚠️ NO LOGS (indicates problem):
   [SyncService] ❌ (error during sync)
   TypeErrors or uncaught exceptions
```

**✅ Check:** Console logs are clean and informative

---

## 📋 FINAL CHECKLIST

### Testing Completion
```
☑ Phase 0: Pre-flight checks passed
☑ Phase 1: Unit tests (25+) passed
☑ Phase 2: Integration checks (20) passed
☑ Phase 3: App built and launched successfully
☑ Phase 4: Login tests (success + failure) passed
☑ Phase 5: CRUD offline → sync online passed
☑ Phase 6: Conflict resolution tested
☑ Phase 7: SQLite + Backend integrity verified
```

### Code Quality
```
☑ TypeScript: 0 errors
☑ Runtime: 0 crashes
☑ Network: All requests successful
☑ Database: All UUIDs valid
☑ Logs: No error messages
```

### Documentation
```
☑ Read: PHASE_6_QUICK_START.md
☑ Reference: PHASE_6_VERIFICATION_GUIDE.md
☑ Understand: UUID migration approach
☑ Know: Conflict resolution strategy
```

---

## 🎉 SUCCESS - NEXT STEPS

If all checks pass:

### 1. Document Results
```markdown
# Phase 6 Testing Results
Date: 2026-06-04
Tester: [Your name]

## Summary
- ✅ All unit tests passed
- ✅ All integration checks passed
- ✅ All manual tests passed
- ✅ No crashes or errors
- ✅ UUID migration working correctly

## Test Cases Completed
- [x] Login success
- [x] Login failure
- [x] Create offline → sync
- [x] Update offline → sync
- [x] Delete offline → sync
- [x] Conflict resolution
- [x] Data integrity
- [x] SQLite verification
- [x] Backend verification

## Performance
- Sync speed: ~ 200ms per operation
- Memory usage: Stable (< 50MB increase)
- Database size: ~2MB (expected for test data)
```

### 2. Create GitHub PR
```
Title: "Phase 6: UUID Migration Complete - Ready for Production"

Description:
- 4 critical fixes implemented
- 25+ unit tests (all pass)
- 20 integration checks (all pass)
- Manual testing complete
- Zero known issues
- Performance benchmarks: [paste if available]
```

### 3. Deploy
```
1. Merge PR to main
2. Deploy backend
3. Deploy mobile (Play Store / App Store)
4. Monitor for 24 hours
```

---

## ❌ TROUBLESHOOTING

### If any step fails, refer to:
**Documentation:** PHASE_6_VERIFICATION_GUIDE.md → Section "🐛 DEBUGGING COMMANDS"

**Quick Fix Reference:**
- Tests fail → Check: jest.config.js in mobile/
- Build fails → Run: npm run clean && npm install
- SQLite error → Check: database migration schema
- Login error → Verify: backend is running and credentials exist
- UUID error → Run: isValidUUID() in console to test

---

## 📞 SUPPORT

- Documentation: `/Threshold/MASTER_INDEX_PHASE6.md`
- Quick Start: `/Threshold/PHASE_6_QUICK_START.md`
- Detailed Guide: `/Threshold/PHASE_6_VERIFICATION_GUIDE.md`
- Current Status: `/Threshold/PHASE_6_STATE_FINAL.md`

---

**Estimated Total Time:** 4-6 hours (from Phase 0 to completion)

**Current Status:** ✅ ALL SYSTEMS READY

**Let's begin! 🚀**



---
**Tags:** #logs
