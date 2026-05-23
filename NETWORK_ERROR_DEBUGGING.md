# Network Error Debugging Guide

## Current Status
✅ **Backend server is running** on `http://localhost:3000`

## Network Errors Summary
Your mobile app is experiencing network connectivity issues with these endpoints:
- `/analytics/global/gpa/:userId` → grades.tsx:54
- `/flashcard-decks` → flashcards.ts:31
- `/flashcard-decks/{deckId}/cards` → flashcards.ts:109
- `/photos/{subjectId}` → photos.ts:80
- `/scanned_documents/subject/{subjectId}` → documents.ts:30

**Good News**: Your app gracefully falls back to cached data, so users can continue working offline.

---

## Diagnostic Steps

### 1. **Verify Backend Server is Accessible**

From your PC's terminal:
```bash
curl http://localhost:3000/api/status
```

Expected response:
```json
{
  "status": "API funcionando correctamente",
  "db": "SQLite",
  "env": "development"
}
```

### 2. **Find Your PC's Local IP Address**

From Windows PowerShell:
```powershell
ipconfig | Select-String -Pattern "IPv4" | Select-Object -First 1
```

Look for an IP like `192.168.x.x` or `10.x.x.x` (NOT `127.0.0.1`)

### 3. **Test API from Mobile Device**

1. Open your phone's browser or terminal
2. Navigate to: `http://<YOUR_PC_IP>:3000/api/status`
   - Replace `<YOUR_PC_IP>` with the IP from step 2
3. If you get a response, your network connection is OK

### 4. **Check Mobile App Configuration**

The mobile app should automatically detect the server IP. Verify in `mobile/src/services/api/client.ts`:

```typescript
// The app tries these URLs in order:
// 1. http://{DETECTED_IP}:3000/api
// 2. http://{DETECTED_IP}:3001/api
// 3. Process.env.EXPO_PUBLIC_API_URL (if set)
```

### 5. **Network Connectivity Issues**

If the backend is running but the mobile app can't reach it:

**Possible causes:**
- ❌ Mobile device on different WiFi network than PC
- ❌ Firewall blocking port 3000
- ❌ Wrong IP address detected by the app
- ❌ VPN active on either device

**Solutions:**
1. Ensure mobile device and PC are on **same WiFi network**
2. Disable VPN/proxy on mobile device
3. Windows Firewall: Allow port 3000 for `node.exe`
   - Run: `netsh advfirewall firewall add rule name="Node.js Port 3000" dir=in action=allow protocol=tcp localport=3000`

### 6. **Check JWT Token**

The app requires a valid JWT token. If token is expired/invalid:

1. Force logout and login again in the mobile app
2. Check that auth token is being stored correctly
3. Verify in browser DevTools (if using web version):
   ```javascript
   localStorage.getItem('jwt_token') // Should exist
   ```

---

## Improved Error Logging (Applied)

I've updated `photos.ts` and `documents.ts` to log proper error messages instead of "undefined". This will help identify the actual issue when you reload the app.

---

## Common Error Patterns

| Error | Cause | Solution |
|-------|-------|----------|
| `Error al obtener...` (network error) | Server unreachable | Check IP/port connectivity |
| `HTTP 401` | Invalid JWT token | Force logout/login |
| `HTTP 404` | Endpoint doesn't exist | Check backend routes |
| `HTTP 500` | Server error | Check backend logs |
| `Connection timeout` | Network unreachable | Same WiFi network? |

---

## Next Steps

1. **Restart both backend and mobile app**
   ```bash
   # Terminal 1: Backend
   cd backend && npm start
   
   # Terminal 2: Mobile (if using Expo)
   cd mobile && npx expo start
   ```

2. **Check the improved error logs**
   - Open mobile app console (Expo DevTools)
   - Look for `[getPhotosBySubject]` or `[getScannedDocumentsBySubject]` with actual error messages

3. **Verify network connectivity**
   - Follow diagnostic steps 2-3 above
   - Ensure both devices on same WiFi

4. **Monitor server logs**
   - Watch the backend terminal for any error messages
   - Check response status codes

---

## Additional Resources

- **Backend Status Endpoint**: `http://<YOUR_IP>:3000/api/status`
- **Swagger Docs**: `http://<YOUR_IP>:3000/api-docs`
- **Backend Routes**: See `backend/routes/*.js`
- **Mobile API Client**: `mobile/src/services/api/client.ts`

---

## If Issues Persist

1. Check browser/Expo console for detailed error messages
2. Review backend terminal output for server errors
3. Try connecting to `http://localhost:3000` from PC browser to confirm server is responsive
4. Check firewall settings
5. Verify WiFi connectivity between devices
