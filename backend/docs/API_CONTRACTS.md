# API Contracts - Smart Library Automation System

Base URL: `http://localhost:3000/api/v1`

All endpoints return JSON. Authentication required unless specified.

---

## Authentication

### POST /auth/register
Register a new user.

**Public endpoint** (no authentication required)

**Request:**
```json
{
  "email": "student@university.edu",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "student",
  "studentId": "STU001",
  "phone": "555-1234"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "userId": 123,
  "email": "student@university.edu",
  "role": "student"
}
```

---

### POST /auth/login
Authenticate and receive JWT token.

**Public endpoint**

**Request:**
```json
{
  "email": "student@university.edu",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 123,
    "email": "student@university.edu",
    "firstName": "John",
    "lastName": "Doe",
    "role": "student"
  },
  "expiresIn": "24h"
}
```

---

## Entry Management

### POST /entry/log
Log student entry or exit (automatic or manual).

**Roles:** student, librarian, admin

**Request:**
```json
{
  "entryType": "entry",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "wifiSSID": "LibraryWiFi",
  "speedKmh": 2.5,
  "manualConfirm": false
}
```

**Response (200):**
```json
{
  "success": true,
  "entryLog": {
    "id": 456,
    "userId": 123,
    "entryType": "entry",
    "confidenceScore": 100,
    "autoLogged": true,
    "timestamp": "2026-02-05T14:30:00.000Z"
  },
  "confidence": {
    "total": 100,
    "gps": 40,
    "wifi": 40,
    "motion": 20
  },
  "message": "Entry logged automatically (high confidence)"
}
```

---

### GET /entry/history/:userId
Get entry/exit history for a user.

**Roles:** student (own data), librarian, admin

**Query params:**
- `limit` (optional): Number of records (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "userId": 123,
  "totalEntries": 45,
  "entries": [
    {
      "id": 456,
      "entryType": "entry",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "confidenceScore": 100,
      "autoLogged": true,
      "timestamp": "2026-02-05T14:30:00.000Z"
    }
  ]
}
```

---

## Book Management

### GET /books/search
Search for books.

**Roles:** all authenticated users

**Query params:**
- `q` (optional): Search query (title, author, ISBN)
- `category` (optional): Filter by category
- `limit` (optional): Results per page (default: 20)
- `offset` (optional): Pagination offset

**Response (200):**
```json
{
  "total": 150,
  "books": [
    {
      "id": 1,
      "isbn": "9780141439518",
      "title": "Pride and Prejudice",
      "author": "Jane Austen",
      "category": "Fiction",
      "currentLocation": {
        "shelfId": 1,
        "shelfCode": "A1",
        "zone": "A",
        "section": "Fiction",
        "lastScanned": "2026-02-01T09:00:00.000Z"
      }
    }
  ]
}
```

---

### GET /books/:id
Get detailed book information including location.

**Roles:** all authenticated users

**Response (200):**
```json
{
  "id": 1,
  "isbn": "9780141439518",
  "title": "Pride and Prejudice",
  "author": "Jane Austen",
  "publisher": "Penguin Classics",
  "publicationYear": 2003,
  "category": "Fiction",
  "pages": 480,
  "description": "...",
  "rfidTag": "RFID-000001",
  "currentLocation": {
    "shelfId": 1,
    "shelfCode": "A1",
    "zone": "A",
    "section": "Fiction",
    "floor": 1,
    "lastScanned": "2026-02-01T09:00:00.000Z"
  },
  "locationHistory": [
    {
      "shelfCode": "A1",
      "timestamp": "2026-02-01T09:00:00.000Z",
      "scannedBy": "Bob Librarian"
    }
  ]
}
```

---

## RFID Scanning

### POST /rfid/scan
Record RFID scan (mode-aware).

**Roles:** librarian, admin

**DEMO MODE Request:**
```json
{
  "tagId": "RFID-000001",
  "shelfId": 5
}
```

**PRODUCTION MODE Request:**
```json
{
  "tagId": "RFID-000001",
  "readerId": 3
}
```

**Response (200):**
```json
{
  "success": true,
  "book": {
    "id": 1,
    "title": "Pride and Prejudice",
    "author": "Jane Austen",
    "isbn": "9780141439518"
  },
  "location": {
    "shelfId": 5,
    "shelfCode": "A5",
    "zone": "A",
    "section": "Fiction"
  },
  "scanInfo": {
    "mode": "DEMO",
    "timestamp": "2026-02-05T14:30:00.000Z",
    "scannedBy": "Bob Librarian"
  },
  "message": "Book location updated successfully"
}
```

---

### GET /rfid/tags
List all RFID tags.

**Roles:** librarian, admin

**Response (200):**
```json
{
  "total": 25,
  "tags": [
    {
      "id": 1,
      "tagId": "RFID-000001",
      "bookId": 1,
      "bookTitle": "Pride and Prejudice",
      "isActive": true,
      "assignedAt": "2026-02-01T09:00:00.000Z"
    }
  ]
}
```

---

## Shelves

### GET /shelves
List all shelves.

**Roles:** all authenticated users

**Response (200):**
```json
{
  "total": 15,
  "shelves": [
    {
      "id": 1,
      "shelfCode": "A1",
      "zone": "A",
      "floor": 1,
      "section": "Fiction",
      "capacity": 100,
      "currentBooks": 35,
      "description": "Classic Literature"
    }
  ]
}
```

---

### GET /shelves/:id/books
Get all books currently on a specific shelf.

**Roles:** all authenticated users

**Response (200):**
```json
{
  "shelf": {
    "id": 1,
    "shelfCode": "A1",
    "zone": "A",
    "section": "Fiction"
  },
  "books": [
    {
      "id": 1,
      "title": "Pride and Prejudice",
      "author": "Jane Austen",
      "isbn": "9780141439518",
      "lastScanned": "2026-02-01T09:00:00.000Z"
    }
  ]
}
```

---

## Navigation

### GET /navigation/find/:bookId
Get navigation guidance to find a book.

**Roles:** all authenticated users

**Response (200):**
```json
{
  "book": {
    "id": 1,
    "title": "Pride and Prejudice",
    "author": "Jane Austen"
  },
  "location": {
    "shelfCode": "A1",
    "zone": "A",
    "floor": 1,
    "section": "Fiction"
  },
  "navigation": {
    "beacon": {
      "uuid": "f7826da6-4fa2-4e98-8024-bc5b71e0893e",
      "major": 100,
      "minor": 1
    },
    "instructions": "Go to Zone A on Floor 1. Look for shelf A1 in the Fiction section."
  }
}
```

---

### GET /beacons
List all BLE beacons.

**Roles:** all authenticated users

**Response (200):**
```json
{
  "total": 3,
  "beacons": [
    {
      "id": 1,
      "uuid": "f7826da6-4fa2-4e98-8024-bc5b71e0893e",
      "major": 100,
      "minor": 1,
      "zone": "A",
      "locationDescription": "Zone A - Fiction Section",
      "isActive": true,
      "batteryLevel": 85
    }
  ]
}
```

---

## Error Responses

All errors follow this format:

**400 Bad Request:**
```json
{
  "error": "Validation Error",
  "message": "Invalid request data",
  "details": [
    {
      "field": "email",
      "message": "Valid email required"
    }
  ]
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid token"
}
```

**403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

**404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## Authentication Header Format

For all protected endpoints:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Rate Limiting

- 100 requests per minute per IP
- Header `X-RateLimit-Remaining` shows remaining requests
- Returns 429 status when limit exceeded
