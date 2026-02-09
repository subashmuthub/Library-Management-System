# Testing Guide - Smart Library Automation System

This guide provides step-by-step instructions to test every feature of the system.

---

## Prerequisites

- Server running: `npm run dev`
- Database populated with seed data
- Tools: PowerShell, Browser, or Postman

---

## Quick Test (5 minutes)

### 1. Health Check
```powershell
Invoke-RestMethod -Uri http://localhost:3000/health
```

**Expected:**
```json
{
  "status": "OK",
  "mode": "DEMO",
  "environment": "development"
}
```

### 2. Run Automated Test Suite
```powershell
node tests/api-test.js
```

**Expected:** All 13 tests pass ✓

---

## Detailed Feature Testing

### Feature 1: User Authentication

#### Register New User
```powershell
$body = @{
    email = "testuser@university.edu"
    password = "password123"
    firstName = "John"
    lastName = "Doe"
    role = "student"
    studentId = "STU999"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/register -Method Post -Body $body -ContentType "application/json"
```

**Expected:**
```json
{
  "message": "User registered successfully",
  "userId": 9,
  "email": "testuser@university.edu",
  "role": "student"
}
```

#### Login
```powershell
$loginBody = @{
    email = "testuser@university.edu"
    password = "password123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/login -Method Post -Body $loginBody -ContentType "application/json"
$token = $response.token
```

**Expected:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 9,
    "email": "testuser@university.edu",
    "firstName": "John",
    "lastName": "Doe",
    "role": "student"
  }
}
```

#### Get Profile
```powershell
$headers = @{ "Authorization" = "Bearer $token" }
Invoke-RestMethod -Uri http://localhost:3000/api/v1/users/profile -Method Get -Headers $headers
```

---

### Feature 2: Entry/Exit Logging

#### Test 1: High Confidence Entry (Auto-log)
```powershell
$entryBody = @{
    entryType = "entry"
    latitude = 37.7749
    longitude = -122.4194
    wifiSSID = "LibraryWiFi"
    speedKmh = 2.5
    manualConfirm = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/v1/entry/log -Method Post -Body $entryBody -ContentType "application/json" -Headers $headers
```

**Expected:**
```json
{
  "success": true,
  "confidence": {
    "total": 100,
    "gps": 40,
    "wifi": 40,
    "motion": 20
  },
  "message": "Entry logged automatically (high confidence)"
}
```

#### Test 2: Low Confidence Entry (Rejected)
```powershell
$lowConfidenceBody = @{
    entryType = "entry"
    latitude = 37.8
    longitude = -122.5
    wifiSSID = "OtherNetwork"
    speedKmh = 15
    manualConfirm = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/v1/entry/log -Method Post -Body $lowConfidenceBody -ContentType "application/json" -Headers $headers
```

**Expected:** Status 400, error message about low confidence

#### Test 3: Medium Confidence with Manual Confirmation
```powershell
$mediumConfidenceBody = @{
    entryType = "entry"
    latitude = 37.7749
    longitude = -122.4194
    wifiSSID = "LibraryWiFi"
    speedKmh = 15
    manualConfirm = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/v1/entry/log -Method Post -Body $mediumConfidenceBody -ContentType "application/json" -Headers $headers
```

**Expected:** Success with manual confirmation message

#### View Entry History
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/v1/entry/history -Method Get -Headers $headers
```

---

### Feature 3: Book Search & Information

#### Search Books by Title
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/books/search?q=Pride" -Method Get -Headers $headers
```

**Expected:** List of books matching "Pride"

#### Search Books by Category
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/books/search?category=Fiction" -Method Get -Headers $headers
```

**Expected:** All fiction books

#### Get Book Details
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/books/1" -Method Get -Headers $headers
```

**Expected:**
```json
{
  "id": 1,
  "title": "Pride and Prejudice",
  "author": "Jane Austen",
  "currentLocation": {
    "shelfCode": "A1",
    "zone": "A",
    "section": "Fiction"
  },
  "rfidTag": "RFID-000001"
}
```

#### Get Book Location History
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/books/1/history" -Method Get -Headers $headers
```

**Expected:** List of all scans for this book

---

### Feature 4: RFID Scanning (DEMO MODE)

First, login as librarian:
```powershell
$librarianLogin = @{
    email = "librarian1@library.edu"
    password = "password123"
} | ConvertTo-Json

$libResponse = Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/login -Method Post -Body $librarianLogin -ContentType "application/json"
$libToken = $libResponse.token
$libHeaders = @{ "Authorization" = "Bearer $libToken" }
```

#### Scan Book (Manual Shelf Selection)
```powershell
$scanBody = @{
    tagId = "RFID-000001"
    shelfId = 5
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/v1/rfid/scan -Method Post -Body $scanBody -ContentType "application/json" -Headers $libHeaders
```

**Expected:**
```json
{
  "success": true,
  "book": {
    "title": "Pride and Prejudice",
    "author": "Jane Austen"
  },
  "location": {
    "shelfCode": "A5",
    "zone": "A"
  },
  "scanInfo": {
    "mode": "DEMO"
  }
}
```

#### Verify Book Moved
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/books/1" -Method Get -Headers $headers
```

**Expected:** `currentLocation.shelfCode` should now be "A5"

#### List All RFID Tags
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/rfid/tags" -Method Get -Headers $libHeaders
```

---

### Feature 5: Shelves & Organization

#### List All Shelves
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/shelves" -Method Get -Headers $headers
```

**Expected:** 15 shelves (A1-A5, B1-B5, C1-C5)

#### Get Shelf Details
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/shelves/1" -Method Get -Headers $headers
```

#### Get Books on Specific Shelf
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/shelves/1/books" -Method Get -Headers $headers
```

**Expected:** List of books currently on shelf A1

#### Filter Shelves by Zone
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/shelves?zone=A" -Method Get -Headers $headers
```

**Expected:** Only Zone A shelves (A1-A5)

---

### Feature 6: Indoor Navigation

#### Find Book Location
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/navigation/find/1" -Method Get -Headers $headers
```

**Expected:**
```json
{
  "book": {
    "title": "Pride and Prejudice"
  },
  "location": {
    "shelfCode": "A1",
    "zone": "A",
    "floor": 1
  },
  "navigation": {
    "beacon": {
      "uuid": "f7826da6-4fa2-4e98-8024-bc5b71e0893e",
      "major": 100,
      "minor": 1
    },
    "instructions": "Go to Zone A on Floor 1..."
  }
}
```

#### List All Beacons
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/beacons" -Method Get -Headers $headers
```

**Expected:** 3 beacons (Zone A, B, C)

#### Get Beacon by Zone
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/beacons/zone/A" -Method Get -Headers $headers
```

---

### Feature 7: Library Occupancy

Login as librarian, then:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/entry/occupancy" -Method Get -Headers $libHeaders
```

**Expected:**
```json
{
  "currentOccupancy": 3,
  "occupants": [
    {
      "firstName": "David",
      "lastName": "Student",
      "entryTime": "2026-02-05T09:00:00.000Z"
    }
  ]
}
```

---

## Testing Mode Switching

### Switch to Production Mode

1. Stop the server (Ctrl+C)

2. Edit `.env`:
```
DEMO_MODE=false
```

3. Restart server:
```powershell
npm run dev
```

4. Test RFID scan with reader ID:
```powershell
$prodScanBody = @{
    tagId = "RFID-000001"
    readerId = 2
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/v1/rfid/scan -Method Post -Body $prodScanBody -ContentType "application/json" -Headers $libHeaders
```

**Expected:** Book location auto-detected from reader location

5. Verify mode:
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/v1/rfid/mode -Method Get -Headers $headers
```

**Expected:**
```json
{
  "mode": "PRODUCTION",
  "isProductionMode": true,
  "requireReaderMapping": true
}
```

---

## Error Testing

### Test Invalid Token
```powershell
$badHeaders = @{ "Authorization" = "Bearer invalid_token" }
Invoke-RestMethod -Uri http://localhost:3000/api/v1/users/profile -Method Get -Headers $badHeaders
```

**Expected:** 401 Unauthorized

### Test Missing Required Field
```powershell
$badBody = @{
    email = "test@test.com"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/register -Method Post -Body $badBody -ContentType "application/json"
```

**Expected:** 400 Validation Error

### Test Non-Existent Book
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/books/9999" -Method Get -Headers $headers
```

**Expected:** 404 Not Found

### Test Rate Limiting
Run this loop (will trigger rate limit):
```powershell
1..150 | ForEach-Object {
    try {
        Invoke-RestMethod -Uri http://localhost:3000/health
    } catch {
        Write-Host "Rate limit hit at request $_"
    }
}
```

**Expected:** 429 Too Many Requests after 100 requests

---

## Performance Testing

### Test 1: Database Query Speed
```powershell
Measure-Command {
    Invoke-RestMethod -Uri "http://localhost:3000/api/v1/books/search?q=Pride" -Method Get -Headers $headers
}
```

**Expected:** < 100ms

### Test 2: Concurrent Requests
```powershell
$jobs = 1..10 | ForEach-Object {
    Start-Job -ScriptBlock {
        Invoke-RestMethod -Uri http://localhost:3000/health
    }
}

$jobs | Wait-Job | Receive-Job
```

**Expected:** All jobs complete successfully

---

## Test Checklist

- [ ] Health check returns OK
- [ ] User registration works
- [ ] User login returns JWT token
- [ ] JWT authentication works
- [ ] High confidence entry auto-logs
- [ ] Low confidence entry is rejected
- [ ] Book search returns results
- [ ] Book details include location
- [ ] RFID scan updates location (DEMO mode)
- [ ] RFID scan updates location (PRODUCTION mode)
- [ ] Shelves list correctly
- [ ] Navigation returns beacon info
- [ ] Occupancy tracking works
- [ ] Invalid token returns 401
- [ ] Missing fields return 400
- [ ] Rate limiting works
- [ ] Mode switching works

---

## Troubleshooting Tests

### If tests fail:

1. **Check server is running:**
   ```powershell
   Get-NetTCPConnection -LocalPort 3000
   ```

2. **Check database connection:**
   ```powershell
   mysql -u root -p -e "USE smart_library; SELECT COUNT(*) FROM users;"
   ```

3. **Check logs:**
   Look at terminal where server is running

4. **Reset database:**
   ```powershell
   node database/setup.js
   ```

5. **Clear test data:**
   ```sql
   DELETE FROM users WHERE email LIKE 'test%';
   DELETE FROM entry_logs WHERE id > 100;
   ```

---

## Next Steps

After testing:

1. **Review API Documentation**: `docs/API_CONTRACTS.md`
2. **Understand Algorithms**: `docs/ALGORITHMS.md`
3. **Try Postman Collection**: Import endpoints for GUI testing
4. **Build Mobile App**: Use API endpoints
5. **Deploy to Production**: Follow deployment guide

---

**All tests passing? Your Smart Library system is working perfectly! 🎉**
