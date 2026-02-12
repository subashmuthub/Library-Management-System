# Smart Library System - Complete Guide

## Project Overview

The **Smart Library Automation System** consists of two main components:

### Backend (Node.js + Express + MySQL)
- RESTful API with 30+ endpoints
- JWT authentication & authorization
- Hybrid GPS entry tracking with confidence scoring
- Real-time RFID book location tracking
- Indoor navigation with BLE beacons
- Mode switching (DEMO/PRODUCTION)

### Frontend (React + Vite + Tailwind)
- Modern single-page application
- Responsive design (mobile, tablet, desktop)
- Real-time data visualization
- Mode-aware RFID scanning
- Indoor navigation interface
- User profile management

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React Frontend (Port 3001)                          │   │
│  │  - Pages: Dashboard, Books, RFID, Navigation         │   │
│  │  - Contexts: Auth, Mode                              │   │
│  │  - Services: API integration with Axios              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────┐
│                       APPLICATION TIER                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express API Server (Port 3000)                      │   │
│  │  - Routes: /auth, /books, /rfid, /navigation         │   │
│  │  - Controllers: Business logic                       │   │
│  │  - Middleware: Auth, Validation, Error handling      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓ SQL Queries
┌─────────────────────────────────────────────────────────────┐
│                         DATA TIER                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MySQL Database (Port 3306)                          │   │
│  │  - 8 normalized tables                               │   │
│  │  - Composite indexes for performance                 │   │
│  │  - Stored procedures & views                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Complete Setup Guide

### Step 1: Prerequisites

**Required Software:**
- Node.js 16+ ([download](https://nodejs.org/))
- MySQL 8.0+ ([download](https://dev.mysql.com/downloads/))
- Git (optional, for version control)

**Verify Installation:**
```powershell
node --version    # Should show v16.x.x or higher
npm --version     # Should show 7.x.x or higher
mysql --version   # Should show 8.0.x or higher
```

### Step 2: Database Setup

1. **Start MySQL Server:**
   ```powershell
   # Windows Service Manager or:
   net start MySQL80
   ```

2. **Create Database:**
   ```powershell
   cd d:\library
   node database\setup.js
   ```

   This script will:
   - Create `smart_library` database
   - Execute schema (8 tables + indexes + procedures)
   - Populate seed data (8 users, 25 books, 15 shelves)
   - Verify setup

   **Expected Output:**
   ```
   ✓ Database created successfully
   ✓ Schema loaded
   ✓ Seed data inserted
   ✓ Setup complete
   ```

### Step 3: Backend Setup

1. **Install Dependencies:**
   ```powershell
   cd d:\library
   npm install
   ```

2. **Configure Environment:**
   ```powershell
   # Edit .env file if needed (already configured with defaults)
   notepad .env
   ```

   Key settings:
   - `DB_PASSWORD` - Your MySQL root password
   - `JWT_SECRET` - Change for production!
   - `DEMO_MODE` - true for handheld, false for fixed readers

3. **Start Backend Server:**
   ```powershell
   npm run dev
   ```

   **Expected Output:**
   ```
   ✓ Database connected successfully
   ✓ Mode: DEMO
   ✓ Server running on port 3000
   ✓ Health check: http://localhost:3000/health
   ```

### Step 4: Frontend Setup

1. **Install Dependencies:**
   ```powershell
   cd d:\library\frontend
   npm install
   ```

2. **Configure Environment:**
   ```powershell
   # .env is already configured, edit if needed
   notepad .env
   ```

3. **Start Frontend Server:**
   ```powershell
   npm run dev
   ```

   **Expected Output:**
   ```
   VITE v5.0.8  ready in 453 ms
   
   ➜  Local:   http://localhost:3001/
   ➜  Network: use --host to expose
   ```

4. **Open Browser:**
   ```
   http://localhost:3001
   ```

### Step 5: First Login

**Student Account:**
- Email: `alice@example.com`
- Password: `password123`

**Librarian Account:**
- Email: `carol@example.com`
- Password: `password123`

## Testing the System

### 1. Authentication Test
1. Open http://localhost:3001/login
2. Login with alice@example.com / password123
3. Should redirect to dashboard
4. Verify user name appears in sidebar

### 2. Book Search Test
1. Click "Books" in sidebar
2. Search for "gatsby"
3. Should see "The Great Gatsby" in results
4. Click on book to view details

### 3. RFID Scanner Test (DEMO Mode)

**Prerequisites:** Ensure `DEMO_MODE=true` in backend `.env`

1. Click "RFID Scanner" in sidebar
2. Enter Tag ID: `TAG-00001`
3. Select Shelf: `A1 - Fiction (Floor 1)`
4. Click "Scan Tag"
5. Should show success: "The Great Gatsby" on Shelf A1

### 4. Navigation Test
1. Click "Navigation" in sidebar
2. Search for "1984"
3. Click on the book in results
4. Should show directions to shelf location
5. Should display beacon UUID for BLE scanning

### 5. Entry Log Test
1. Click "Entry Log" in sidebar
2. Fill in GPS coordinates:
   - Latitude: `37.7749` (near library)
   - Longitude: `-122.4194`
3. WiFi SSID: `LibraryWiFi`
4. Motion Speed: `3.5` km/h
5. Click "Log Entry"
6. Should show high confidence (90-100%)

## Mode Switching

### Switch to PRODUCTION Mode

1. **Stop both servers** (Ctrl+C)

2. **Backend: Edit .env**
   ```env
   DEMO_MODE=false
   ```

3. **Frontend: Edit .env**
   ```env
   VITE_DEMO_MODE=false
   ```

4. **Restart servers**
   ```powershell
   # Backend
   cd d:\library
   npm run dev
   
   # Frontend (new terminal)
   cd d:\library\frontend
   npm run dev
   ```

5. **Test RFID in PRODUCTION mode:**
   - Navigate to RFID Scanner
   - Notice UI changed to "PRODUCTION Mode"
   - Enter Tag ID: `TAG-00002`
   - Enter Reader ID: `3` (fixed reader)
   - Click Scan
   - System automatically detects shelf from reader location

## API Testing (Optional)

Test API directly using PowerShell:

```powershell
# Login
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"alice@example.com","password":"password123"}'
$token = $response.token

# Search books
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/books/search?query=gatsby" -Headers $headers

# Log entry
$body = @{
    action = "entry"
    gps_latitude = 37.7749
    gps_longitude = -122.4194
    wifi_ssid = "LibraryWiFi"
    motion_speed_kmh = 3.5
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/entry/log" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```

## Troubleshooting

### Backend Won't Start

**Error: Database connection failed**
```
Solution:
1. Verify MySQL is running: net start MySQL80
2. Check DB_PASSWORD in .env matches MySQL password
3. Verify database exists: mysql -u root -p -e "SHOW DATABASES;"
```

**Error: Port 3000 already in use**
```
Solution:
1. Find process: netstat -ano | findstr :3000
2. Kill process: taskkill /PID <pid> /F
3. Or change PORT in .env
```

### Frontend Won't Start

**Error: Module not found**
```
Solution:
cd d:\library\frontend
Remove-Item -Recurse node_modules
npm install
```

**Error: Cannot connect to API**
```
Solution:
1. Verify backend is running on port 3000
2. Check VITE_API_URL in frontend .env
3. Check browser console for CORS errors
```

### RFID Scanner Not Working

**Issue: "Tag not found"**
```
Solution:
1. Use sample tag IDs: TAG-00001 to TAG-00025
2. Verify seed data was loaded: Check database
3. Check mode matches (DEMO vs PRODUCTION)
```

**Issue: "Reader not found" (PRODUCTION mode)**
```
Solution:
1. Use reader IDs 2-16 (reader 1 is handheld)
2. Verify readers table has data
```

### GPS Entry Always Low Confidence

**Issue: Confidence < 50%**
```
Solution:
1. Use coordinates near library (37.7749, -122.4194)
2. Add WiFi SSID: "LibraryWiFi" (+40 points)
3. Add motion speed: 2-5 km/h (+20 points)
4. Check GPS_PROXIMITY_THRESHOLD in .env
```

## Development Workflow

### Making Changes

1. **Backend Changes:**
   ```powershell
   # Edit files in src/
   # Server auto-restarts (nodemon)
   # Check terminal for errors
   ```

2. **Frontend Changes:**
   ```powershell
   # Edit files in frontend/src/
   # Browser auto-refreshes (Vite HMR)
   # Check browser console for errors
   ```

3. **Database Changes:**
   ```powershell
   # Edit database/schema.sql
   # Re-run setup:
   node database/setup.js
   ```

### Adding New Features

**Example: Add "Book Reservations" feature**

1. **Database:**
   - Add `reservations` table in schema.sql
   - Create seed data

2. **Backend:**
   - Create `src/routes/reservation.routes.js`
   - Create `src/controllers/reservation.controller.js`
   - Mount route in `src/app.js`

3. **Frontend:**
   - Create `src/pages/Reservations.jsx`
   - Add route in `src/App.jsx`
   - Add nav link in `src/components/Layout.jsx`
   - Create API service in `src/services/index.js`

## Production Deployment

### Backend Deployment

1. **Environment:**
   - Set `NODE_ENV=production`
   - Change `JWT_SECRET` to secure random string
   - Set strong `DB_PASSWORD`
   - Disable `DEMO_MODE` if needed

2. **Process Manager (PM2):**
   ```powershell
   npm install -g pm2
   cd d:\library
   pm2 start src/app.js --name library-api
   pm2 startup
   pm2 save
   ```

3. **Reverse Proxy (Nginx):**
   ```nginx
   server {
       listen 80;
       server_name api.library.example.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Frontend Deployment

1. **Build:**
   ```powershell
   cd d:\library\frontend
   npm run build
   ```

2. **Nginx Config:**
   ```nginx
   server {
       listen 80;
       server_name library.example.com;
       root /var/www/library-frontend/dist;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

3. **Environment:**
   - Update `VITE_API_URL` to production API URL
   - Rebuild after changing .env

## Documentation

- **Backend API:** `docs/API_CONTRACTS.md`
- **Algorithms:** `docs/ALGORITHMS.md`
- **Architecture:** `docs/ARCHITECTURE_DIAGRAM.md`
- **Installation:** `docs/INSTALLATION.md`
- **Testing:** `docs/TESTING_GUIDE.md`
- **Deployment:** `docs/DEPLOYMENT.md`

## Project Statistics

- **Total Files:** 60+ files
- **Code Lines:** ~8,000 lines
- **Documentation:** ~3,500 lines
- **API Endpoints:** 30+
- **Database Tables:** 8
- **React Components:** 15+

## Support & Contribution

For questions or issues:
1. Check documentation in `docs/` folder
2. Review troubleshooting section above
3. Check browser/terminal console for errors
4. Verify environment variables are correct

---

**System Status:**
- ✅ Backend: Fully implemented and tested
- ✅ Frontend: Fully implemented and tested
- ✅ Database: Schema and seed data ready
- ✅ Documentation: Complete
- ✅ Production Ready: Yes

**Last Updated:** February 5, 2026
