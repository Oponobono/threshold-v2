# Debugging Grading Systems Not Appearing in Edit Profile

## Problem Summary
The "Sistema de Calificación" title appears in Settings → Edit Profile modal, but the grading system selector buttons are not visible.

## Backend Status ✅ VERIFIED
- Backend endpoint `/api/grading-systems` is **working correctly**
- Returns 4 grading systems with all required fields
- Authentication middleware is properly configured
- Tests confirm: database, queries, and API all functioning

## Where to Debug: Frontend

### Step 1: Enable Console Logs in Expo
1. **In your running app:**
   - Open Expo client or emulator
   - Navigate to Settings screen
   - Click "Edit Profile"
   
2. **Check console logs:**
   - In Expo Dev Tools, look for logs starting with:
     - `[API]` - API client logs
     - `[useSettingsLogic]` - Hook state logs
   
### Step 2: Look for These Log Messages

**If systems load successfully:**
```
[API] Fetching grading systems...
[API] Grading systems response status: 200
[API] Parsed grading systems data: {systems: [...]}
[API] Returning 4 grading systems
[useSettingsLogic] Loaded systems: [...]
[useSettingsLogic] Setting selected system to: X
```

**If there's an authentication error:**
```
[API] Fetching grading systems...
[API] Grading systems response status: 401
[useSettingsLogic] Failed to load grading systems Error: Failed to fetch grading systems (401)
```

**If there's a network error:**
```
[API] Fetching grading systems...
[✗ API] Fallo conectando a ...
[useSettingsLogic] Failed to load grading systems Error: ...
```

### Step 3: What Each Error Means

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| Status 401 | No JWT token or token expired | Login again, ensure token is being saved |
| Status 403 | Token invalid or tampered | Clear app cache, login again |
| Status 500 | Backend error | Check backend logs |
| Network error | Can't reach backend | Verify IP address and port are correct |
| Empty array | Systems loaded but empty | Check database has data (run diagnostics) |

### Step 4: Backend Logging

The backend now logs all requests to `/api/grading-systems`. To see them:

1. **Start backend with logging:**
   ```bash
   cd backend
   node server.js
   ```

2. **Look for logs like:**
   ```
   127.0.0.1 - GET /api/grading-systems 200 - 12 ms
   [GradingController] GET /grading-systems
   [GradingController] req.user: {id: 1, email: "user@example.com", ...}
   [GradingController] ✓ Devolviendo 4 sistemas
   ```

### Step 5: Verify Token is Being Sent

Check if JWT token is in localStorage/secure storage:

Add this test to check token:
```typescript
// In useSettingsLogic or EditProfileModal
const token = await storageService.getSecure('jwt_token');
console.log('[DEBUG] JWT Token:', token ? 'Present' : 'MISSING');
console.log('[DEBUG] Token preview:', token?.substring(0, 30) + '...');
```

## Files Modified for Debugging
- `backend/controllers/gradingController.js` - Added detailed logging
- `mobile/src/services/api/grading.ts` - Added console logs
- `mobile/src/hooks/useSettingsLogic.ts` - Added console logs

## Next Steps After Debugging

Once you identify the error message:
1. Share the **exact** error message from the console
2. Share the backend logs output
3. Share the status code (200, 401, 403, 500, network error, etc.)

This will help identify the exact issue and fix it.
